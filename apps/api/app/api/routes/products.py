"""상품 매칭 라우트 — ⑥ 에이전트의 명시 트리거 (핫패스 아님).

입금 시트의 즉시 훅(meta.product_hooks)은 룰이 그대로 담당하고, 이 라우트는
페르소나·팩트를 읽는 LLM 매칭을 사용자가/코치가 부를 때만 돈다 (상품 탭·코치 제안).
가입은 언제나 사람 — 여기는 판정과 근거까지만.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.agents import product_match as product_match_agent
from app.api.routes.bank import _boot
from app.orchestration import bank_flow
from app.engines import facts as facts_svc
from app.engines import product_match
from app.store import db

router = APIRouter(prefix="/v1/products", tags=["products"])


@router.post("/match")
def match() -> dict:
    """적합성 veto(결정론) → 후보 메뉴 → LLM 선택(게이트 3종) → 룰 폴백."""
    _boot()
    allocations = db.list_allocations()
    if not allocations:
        return {
            "matches": [], "vetoed": {}, "persona_used": False, "persona_staleness": None,
            "note": "배분 이력이 없어 상품 매칭을 할 수 없어요 — 첫 입금 배분 후 다시 불러요",
        }

    latest = allocations[-1]
    invest_available = float(latest["meta"].get("invest_available", 0.0))
    tax_balance = db.envelope_balances()["tax"]
    ctx = bank_flow.context_from_store()
    candidates, vetoed = product_match.eligible(
        invest_available, tax_balance, ctx, bank_flow.has_confirmed_incoming())

    txns = db.list_txns()
    sheet = facts_svc.build_factsheet(txns, allocations, db.list_events())
    snap = db.latest_snapshot()
    axes = snap["axes"] if snap else None

    picks = product_match_agent.select(candidates, sheet, axes, db.list_goals())
    return {
        "matches": [p.as_dict() for p in picks],
        "candidates": [c.as_dict() for c in candidates],
        "vetoed": vetoed,   # 무엇이 왜 후보에서 빠졌는지 — 적합성 원칙의 감사 가능성
        "persona_used": axes is not None,
        "persona_staleness": facts_svc.snapshot_staleness(snap, len(txns)),
        "note": "매칭은 판정일 뿐 — 가입은 사람의 결정 (심사·한도 개인화 없음)",
    }
