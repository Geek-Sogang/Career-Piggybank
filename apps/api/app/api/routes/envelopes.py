"""목표 봉투 라우트 — 잠긴 prefix(세금·경비) 뒤의 취향 층.

봉투 집합은 고정 4개가 아니다: 세금·경비(법·사실, 기존 envelopes 유지)는 잠겨 있고,
그 뒤는 사용자 목표 봉투(자유 생성) + 에이전트 추천(⑤a — 판정만, 개설은 사람).
호출 주기: 추천은 온보딩·소득 변화 때만 부른다 — 매 입금(그건 페이싱)이 아니다.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents import envelope_recommend
from app.api.routes.bank import _boot
from app.services import facts as facts_svc
from app.store import db

router = APIRouter(prefix="/v1/envelopes", tags=["envelopes"])


class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=20)
    target_amount: float = Field(gt=0)
    target_date: str | None = None
    source: str = "user"      # user(직접) / ai_recommend(추천을 승인해 개설)


@router.get("/goals")
def goals() -> list[dict]:
    _boot()
    return db.list_goals()


@router.post("/goals")
def create_goal(req: GoalCreate) -> dict:
    """목표 봉투 개설 — 사람의 행동이다 (에이전트는 추천까지만)."""
    _boot()
    if req.source not in ("user", "ai_recommend"):
        raise HTTPException(status_code=422, detail="source must be user|ai_recommend")
    goal_id = db.insert_goal(req.name, req.target_amount, req.target_date, req.source)
    db.log_event("goal_created", ref_id=goal_id,
                 payload={"name": req.name, "source": req.source})
    return db.get_goal(goal_id)  # type: ignore[return-value]


@router.post("/recommend")
def recommend() -> dict:
    """봉투 추천(⑤a) — 팩트+페르소나 근거의 후보 목록. 개설은 사용자가 /goals로."""
    _boot()
    txns = db.list_txns()
    sheet = facts_svc.build_factsheet(txns, db.list_allocations(), db.list_events())
    snap = db.latest_snapshot()
    axes = snap["axes"] if snap else None
    ideas = envelope_recommend.recommend(sheet, axes, db.list_goals())
    return {
        "recommendations": [i.as_dict() for i in ideas],
        "persona_used": axes is not None,
        "persona_staleness": facts_svc.snapshot_staleness(snap, len(txns)),
        "note": "추천은 판정일 뿐 — 개설(POST /v1/envelopes/goals)은 사용자의 결정",
    }
