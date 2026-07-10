"""목표 봉투 라우트 — 잠긴 prefix(세금·경비) 뒤의 취향 층.

봉투 집합은 고정 4개가 아니다: 세금·경비(법·사실, 기존 envelopes 유지)는 잠겨 있고,
그 뒤는 사용자 목표 봉투(자유 생성) + 에이전트 추천(⑤a — 판정만, 개설은 사람).
호출 주기: 추천은 온보딩·소득 변화 때만 부른다 — 매 입금(그건 페이싱)이 아니다.

추천 소스는 둘: ⑤a(내 팩트, LLM) + 또래(같은 직군·유사 페르소나의 개설 관찰, 결정론).
개설은 또래 풀에 기여한다 — 카탈로그는 사용자 관찰로 자란다.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents import envelope_recommend
from app.api.routes.bank import _boot
from app.services import bank_flow
from app.services import facts as facts_svc
from app.services import peer_envelopes
from app.store import db

router = APIRouter(prefix="/v1/envelopes", tags=["envelopes"])

MY_JOB = "developer"   # 데모 = 조대흠 (spending_profile 프리셋과 동일 키 — 실서비스는 프로필)


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
    # 개설이 또래 풀에 기여 — 내 페르소나 축과 함께 저장돼 다음 사람의 유사도 매칭 재료가
    # 된다. 내게는 기존 이름 제외 규칙으로 되돌아오지 않는다.
    snap = db.latest_snapshot()
    db.insert_peer_envelope(MY_JOB, req.name, req.target_amount,
                            snap["axes"] if snap else None, origin="user")
    return db.get_goal(goal_id)  # type: ignore[return-value]


@router.post("/recommend")
def recommend() -> dict:
    """봉투 추천(⑤a) — 팩트+페르소나 근거의 후보 목록. 개설은 사용자가 /goals로."""
    _boot()
    txns = db.list_txns()
    sheet = facts_svc.build_factsheet(txns, db.list_allocations(), db.list_events())
    snap = db.latest_snapshot()
    axes = snap["axes"] if snap else None
    goals_now = db.list_goals()
    ideas = envelope_recommend.recommend(sheet, axes, goals_now)
    # 월 여윳돈 = 월소득 − 생활비 − 경비 (또래 금액의 도달 개월수·감당 가능액 계산용).
    # 또래 중앙값이 그 사람 형편을 안 보고 내밀리지 않도록(유철 피드백) 산수로 함께 낸다.
    est = bank_flow.profile_from_store()
    monthly_surplus = max(0.0, est.profile.annual_gross / 12.0
                          - est.profile.expected_monthly_living
                          - est.profile.expected_monthly_expense)
    # 또래 소스(결정론) — 같은 직군·유사 페르소나의 개설 관찰. LLM 소스와 이름이 겹치면
    # 내 팩트 근거(⑤a)를 우선하고 또래 항목은 뺀다(중복 추천 방지)
    ai_names = {i.name for i in ideas}
    peers = [
        p for p in peer_envelopes.recommend(
            MY_JOB, axes, {g["name"] for g in goals_now}, db.list_peer_envelopes(),
            monthly_surplus=monthly_surplus,
        ) if p.name not in ai_names
    ]
    return {
        "recommendations": [i.as_dict() for i in ideas],
        "peers": [p.as_dict() for p in peers],
        "persona_used": axes is not None,
        "persona_staleness": facts_svc.snapshot_staleness(snap, len(txns)),
        "note": "추천은 판정일 뿐 — 개설(POST /v1/envelopes/goals)은 사용자의 결정",
    }
