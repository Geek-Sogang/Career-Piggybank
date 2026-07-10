"""상품 훅 — 선택은 룰, 문구는 결정론 템플릿 (하나 상품만, 숫자는 제안 인용만)."""
from __future__ import annotations

from app.services import product_match
from app.services.allocator import AllocationContext, EnvelopeBalances, SpendingProfile, propose

PROFILE = SpendingProfile(
    annual_gross=30_000_000, expected_monthly_expense=400_000,
    expected_monthly_living=1_200_000, income_cv=0.4, avg_deposit=800_000,
)


def test_tax_envelope_suggests_parking() -> None:
    p = propose(3_000_000, PROFILE)
    hooks = product_match.hooks_for(p)
    assert any(h["product_id"] == "parking" for h in hooks)
    parking = next(h for h in hooks if h["product_id"] == "parking")
    assert f"{p.tax:,.0f}원" in parking["line"]          # 숫자는 제안 인용만
    assert "하나" in parking["name"]                     # 하나 브랜드 불가침


def test_invest_available_suggests_isa_first() -> None:
    # 버퍼가 이미 목표를 넘긴 상태 → invest_available > 0
    p = propose(5_000_000, PROFILE, EnvelopeBalances(buffer=4_000_000))
    assert p.invest_available > 0
    hooks = product_match.hooks_for(p)
    assert hooks[0]["product_id"] == "isa"
    assert f"{p.invest_available:,.0f}원" in hooks[0]["line"]


def test_long_gap_suggests_bridge_only_with_confirmed_income() -> None:
    ctx = AllocationContext(expected_gap_days=45)
    p = propose(1_000_000, PROFILE, context=ctx)
    # 확정 예정 수입 있음 → 브릿지 안내 (공백만 메우면 되는 상황)
    assert any(h["product_id"] == "emergency" for h in product_match.hooks_for(p, ctx, True))
    # 확정 예정 수입 없음 → 대출 권하지 않음 (부채 유도 방지, 준모 피드백)
    assert not any(h["product_id"] == "emergency" for h in product_match.hooks_for(p, ctx, False))


def test_early_decline_suggests_irp() -> None:
    ctx = AllocationContext(early_decline=True)
    p = propose(3_000_000, PROFILE, context=ctx)
    hooks = product_match.hooks_for(p, ctx)
    assert any(h["product_id"] == "irp" for h in hooks)


def test_hooks_capped_at_two() -> None:
    # 신호를 다 켜도 훅은 2개까지 — 배분 확인이 주인공
    ctx = AllocationContext(expected_gap_days=60, early_decline=True)
    p = propose(3_000_000, PROFILE, context=ctx)
    assert len(product_match.hooks_for(p, ctx)) <= product_match.MAX_HOOKS


def test_all_hooks_are_hana_catalog() -> None:
    ctx = AllocationContext(expected_gap_days=60, early_decline=True)
    p = propose(5_000_000, PROFILE, EnvelopeBalances(buffer=4_000_000), ctx)
    for h in product_match.hooks_for(p, ctx):
        assert h["product_id"] in product_match.CATALOG
        assert h["name"] == product_match.CATALOG[h["product_id"]]
