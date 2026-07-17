"""상품 매칭 라우트 — ⑥ 에이전트의 명시 트리거 (핫패스 아님).

입금 시트의 즉시 훅(meta.product_hooks)은 룰이 그대로 담당하고, 이 라우트는
페르소나·팩트를 읽는 LLM 매칭을 사용자가/코치가 부를 때만 돈다 (상품 탭·코치 제안).
가입은 언제나 사람 — 여기는 판정과 근거까지만.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.agents import product_match as product_match_agent
from app.api.routes.bank import _boot
from app.engines import product_match
from app.profile import build_user_profile
from app.store import db

router = APIRouter(prefix="/v1/products", tags=["products"])


@router.post("/match")
def match() -> dict:
    """적합성 veto(결정론) → 후보 메뉴 → LLM 선택(게이트 3종) → 룰 폴백."""
    _boot()
    up = build_user_profile()
    verification = up.career.as_dict()
    allocations = db.list_allocations()
    if not allocations:
        return {
            "matches": [], "vetoed": {}, "persona_used": False, "persona_staleness": None,
            "verification": verification,
            "note": "배분 이력이 없어 상품 매칭을 할 수 없어요 — 첫 입금 배분 후 다시 불러요",
        }

    latest = allocations[-1]
    invest_available = float(latest["meta"].get("invest_available", 0.0))
    tax_balance = db.envelope_balances()["tax"]
    candidates, vetoed = product_match.eligible(
        invest_available, tax_balance, up.allocation_context(), up.has_confirmed_incoming,
        verified_credit_limit=up.career.limit,
    )

    picks = product_match_agent.select(candidates, list(up.factsheet), up.persona_axes, db.list_goals())
    return {
        "matches": [p.as_dict() for p in picks],
        "candidates": [c.as_dict() for c in candidates],
        "vetoed": vetoed,   # 무엇이 왜 후보에서 빠졌는지 — 적합성 원칙의 감사 가능성
        "persona_used": up.persona_axes is not None,
        "persona_staleness": up.persona_staleness,
        "verification": verification,
        "note": "검증 한도는 결정론, 상품 선택은 판정일 뿐 — 가입은 사람의 결정",
    }
