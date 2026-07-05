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
from app.services import facts as facts_svc
from app.services import pacing as pacing_svc
from app.store import db

router = APIRouter(prefix="/v1/pacing", tags=["pacing"])


class ProposeRequest(BaseModel):
    available: float = Field(gt=0, description="이번에 나눌 여윳돈 슬라이스 (순차 배분의 여윳돈)")
    buffer_shortfall: float = Field(default=0.0, ge=0,
                                    description="버퍼 목표 부족분 — 배분 제안 meta의 buffer_target 기준")
    today: str = Field(description="기준일 ISO — 기한까지 남은 입금 횟수 계산용")


class DecisionRequest(BaseModel):
    action: str  # confirm | reject


@router.post("/propose")
def propose(req: ProposeRequest) -> dict:
    _boot()
    goals = db.list_goals()
    txns = db.list_txns()
    sheet = facts_svc.build_factsheet(txns, db.list_allocations(), db.list_events())
    snap = db.latest_snapshot()
    axes = snap["axes"] if snap else None
    staleness = facts_svc.snapshot_staleness(snap, len(txns))

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
    })
    return {"id": pid, "status": "proposed", "available": req.available,
            "split": plan.split(), "reasons": list(plan.reasons),
            "judgment": judgment.as_dict(),
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

    # 상태 전이를 원자적으로 먼저 따내고(레이스 가드), 성공한 쪽만 잔액을 움직인다
    status = "confirmed" if req.action == "confirm" else "rejected"
    if not db.decide_pacing(pid, status):
        raise HTTPException(status_code=409, detail="already decided (concurrent)")
    if req.action == "confirm":
        for key, amount in stored["split"].items():
            if amount <= 0:
                continue
            if key == "buffer":
                db.envelope_add({"buffer": amount})
            else:
                db.goal_add_balance(key, amount)

    db.log_event("pacing_decided", ref_id=pid, payload={"action": req.action})
    return {"id": pid, "status": "confirmed" if req.action == "confirm" else "rejected"}
