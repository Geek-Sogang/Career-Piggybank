"""금액 페이싱 라우트 — 오케스트레이션(흐름=코드): 측정 → 판단(⑤b) → 번역 → 확인 게이트.

propose: 팩트·페르소나·목표를 모아 ⑤b가 우선순위·스탠스를 판단하고, pacing 엔진이
원화로 번역해 '제안'으로 저장한다. 이 시점에 돈은 1원도 움직이지 않는다.
decision: 사람이 confirm해야 버퍼·목표 봉투 잔액이 실제로 이동한다 (가드레일).
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents import amount_pacing
from app.api.routes.bank import _boot
from app.profile import build_user_profile
from app.engines import pacing as pacing_svc
from app.store import db

router = APIRouter(prefix="/v1/pacing", tags=["pacing"])


class ProposeRequest(BaseModel):
    available: float = Field(gt=0, description="이번에 나눌 여윳돈 슬라이스 (순차 배분의 여윳돈)")
    buffer_shortfall: float = Field(default=0.0, ge=0,
                                    description="버퍼 목표 부족분 — 배분 제안 meta의 buffer_target 기준")
    today: str = Field(description="기준일 ISO — 기한까지 남은 입금 횟수 계산용")
    # 돈의 출처 — 회계가 달라진다:
    #   deposit(기본) = 아직 봉투에 안 담긴 새 돈 → confirm 시 목표·버퍼 모두 '추가'
    #   buffer       = 이미 버퍼에 있는 돈을 목표로 재배치 → confirm 시 목표 추가 + 버퍼 차감
    #                  (합계 보존 — 새 돈을 찍어내지 않는다)
    source: str = Field(default="deposit", description="deposit | buffer")


class DecisionRequest(BaseModel):
    action: str  # confirm | reject


@router.post("/propose")
def propose(req: ProposeRequest) -> dict:
    _boot()
    if req.source not in ("deposit", "buffer"):
        raise HTTPException(status_code=422, detail="source must be deposit|buffer")
    if req.source == "buffer" and req.available > db.envelope_balances()["buffer"] + 0.01:
        raise HTTPException(status_code=422, detail="available exceeds buffer balance")
    goals = db.list_goals()
    up = build_user_profile()                                   # 배분·추천과 같은 프로필 SSOT
    sheet = list(up.factsheet)
    axes = up.persona_axes
    staleness = up.persona_staleness

    judgment = amount_pacing.judge(goals, sheet, axes)          # 판단 (⑤b — 번호만)

    gap = next((f.value for f in sheet if f.id == "F03"), None)  # 입금 리듬 — 산수의 입력
    plan = pacing_svc.translate(                                 # 번역 (엔진 — 합계 보존)
        available=req.available, goals=goals,
        priorities=list(judgment.priorities) or [g["id"] for g in goals],
        stances=judgment.stances,
        buffer_shortfall=req.buffer_shortfall,
        today=req.today, gap_days=gap,
    )
    pid = db.insert_pacing(req.available, plan.split(), meta={
        "judgment": judgment.as_dict(),
        "reasons": list(plan.reasons),
        "goals": [{"id": g.goal_id, "name": g.name, "base": g.base,
                   "stance": g.stance, "amount": g.amount} for g in plan.goals],
        "buffer_first": plan.buffer_first,
        "persona_staleness": staleness,
        "source": req.source,
    })
    return {"id": pid, "status": "proposed", "available": req.available,
            "split": plan.split(), "reasons": list(plan.reasons),
            "judgment": judgment.as_dict(),
            "goals": [{"id": g.goal_id, "name": g.name, "base": g.base,
                       "stance": g.stance, "amount": g.amount} for g in plan.goals],
            "source": req.source,
            "persona_staleness": staleness}


@router.post("/{pid}/decision")
def decide(pid: str, req: DecisionRequest) -> dict:
    """확인 게이트 — confirm만 잔액을 움직인다 (AI는 제안까지, 실행은 사람)."""
    _boot()
    stored = db.get_pacing(pid)
    if stored is None:
        raise HTTPException(status_code=404, detail="pacing proposal not found")
    if stored["status"] != "proposed":
        raise HTTPException(status_code=409, detail=f"already decided: {stored['status']}")
    if req.action not in ("confirm", "reject"):
        raise HTTPException(status_code=422, detail="action must be confirm|reject")

    # source=buffer면 목표로 가는 총액이 지금 버퍼에 실제로 있어야 한다 (초과 인출 가드)
    from_buffer = stored["meta"].get("source") == "buffer"
    goal_total = round(sum(v for k, v in stored["split"].items() if k != "buffer" and v > 0), 2)
    if req.action == "confirm" and from_buffer and \
            db.envelope_balances()["buffer"] + 0.01 < goal_total:
        raise HTTPException(status_code=409, detail="buffer balance changed — insufficient for goals")

    # 상태 전이를 원자적으로 먼저 따내고(레이스 가드), 성공한 쪽만 잔액을 움직인다
    status = "confirmed" if req.action == "confirm" else "rejected"
    if not db.decide_pacing(pid, status):
        raise HTTPException(status_code=409, detail="already decided (concurrent)")
    if req.action == "confirm":
        for key, amount in stored["split"].items():
            if amount <= 0 or key == "buffer":
                continue
            db.goal_add_balance(key, amount)
        if from_buffer:
            # 재배치 회계: 목표로 간 만큼만 버퍼에서 차감 (남긴 슬라이스는 버퍼에 이미 있음)
            db.envelope_add({"buffer": -goal_total})
        else:
            # 새 돈 회계: 남는 슬라이스를 버퍼에 추가 (기존 동작 그대로)
            db.envelope_add({"buffer": stored["split"].get("buffer", 0.0)})

    db.log_event("pacing_decided", ref_id=pid, payload={"action": req.action})
    return {"id": pid, "status": "confirmed" if req.action == "confirm" else "rejected"}
