"""봉투 배분 엔진(allocator) + 제안/승인 라우트 테스트."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.engines.allocator import (
    EnvelopeBalances,
    SpendingProfile,
    buffer_target_months,
    propose,
    validate_adjustment,
)

PROFILE = SpendingProfile(
    annual_gross=30_000_000,
    expected_monthly_expense=400_000,
    expected_monthly_living=1_200_000,
    income_cv=0.4,
    avg_deposit=800_000,
)


# ---------- 폭포수 룰 불변식 ----------

@pytest.mark.parametrize("deposit", [1_000, 50_000, 483_500, 800_000, 3_000_000, 12_345_678])
def test_sum_preserved_and_non_negative(deposit: float) -> None:
    p = propose(deposit, PROFILE)
    parts = [p.tax, p.expense, p.spendable, p.buffer]
    assert all(v >= 0 for v in parts)
    assert sum(parts) == pytest.approx(p.deposit, abs=0.02)


def test_deposit_must_be_positive() -> None:
    with pytest.raises(ValueError):
        propose(0, PROFILE)


def test_tax_first_matches_deterministic_rate() -> None:
    """세금봉투는 결정론 실효세율 × 입금액 — AI/휴리스틱 개입 없음."""
    p = propose(1_000_000, PROFILE)
    assert p.tax == pytest.approx(1_000_000 * p.assumptions["effective_tax_rate"], abs=0.01)


# ---------- "많이 들어온 달은 여윳돈 비중이 커진다" ----------

def test_windfall_flows_to_buffer() -> None:
    small = propose(500_000, PROFILE)
    big = propose(3_000_000, PROFILE)
    assert big.buffer / big.deposit > small.buffer / small.deposit


def test_filled_envelopes_skip_to_buffer() -> None:
    """경비·생활비가 이미 차 있으면 세금 제외 전액이 여윳돈으로."""
    full = EnvelopeBalances(expense=400_000, spendable=1_200_000)
    p = propose(1_000_000, PROFILE, full)
    assert p.expense == 0
    assert p.spendable == 0
    assert p.buffer == pytest.approx(p.deposit - p.tax, abs=0.02)


def test_gap_filling_respects_existing_balance() -> None:
    """경비봉투에 30만 있으면 예상경비 40만까지 10만만 채운다."""
    p = propose(2_000_000, PROFILE, EnvelopeBalances(expense=300_000))
    assert p.expense == pytest.approx(100_000, abs=0.01)


# ---------- 버퍼 목표 · 투자 가능액 ----------

def test_buffer_months_scales_with_volatility() -> None:
    assert buffer_target_months(0.0) == 1.0
    assert buffer_target_months(0.4) == pytest.approx(2.6)
    assert buffer_target_months(9.9) == 6.0  # 상한


def test_invest_available_only_above_target() -> None:
    poor = propose(1_000_000, PROFILE, EnvelopeBalances(buffer=0))
    rich = propose(5_000_000, PROFILE, EnvelopeBalances(buffer=5_000_000))
    assert poor.invest_available == 0
    assert rich.invest_available > 0


# ---------- 코치 확인(needs_confirmation) ----------

def test_cold_start_always_asks() -> None:
    cold = SpendingProfile(
        annual_gross=30_000_000, expected_monthly_expense=400_000,
        expected_monthly_living=1_200_000, avg_deposit=0,
    )
    assert propose(500_000, cold).needs_confirmation is True


def test_normal_deposit_auto_applies_but_windfall_asks() -> None:
    normal = propose(800_000, PROFILE)   # 평균과 같음 → 자동
    windfall = propose(1_300_000, PROFILE)  # 평균의 1.6배 → 확인
    assert normal.needs_confirmation is False
    assert windfall.needs_confirmation is True
    assert windfall.windfall_ratio == pytest.approx(1.63, abs=0.01)


# ---------- 조정 검증 ----------

def test_validate_adjustment_rejects_bad_sums() -> None:
    with pytest.raises(ValueError):
        validate_adjustment(1_000_000, 100_000, 200_000, 300_000, 500_000)  # 합계 110만
    with pytest.raises(ValueError):
        validate_adjustment(1_000_000, -1, 200_000, 300_000, 500_001)  # 음수
    validate_adjustment(1_000_000, 100_000, 200_000, 300_000, 400_000)  # OK


# ---------- 제안 → 결정 API 흐름 ----------

client = TestClient(app)

REQ = {
    "deposit": 1_000_000,
    "profile": {
        "annual_gross": 30_000_000,
        "expected_monthly_expense": 400_000,
        "expected_monthly_living": 1_200_000,
        "income_cv": 0.4,
        "avg_deposit": 800_000,
    },
}


def _propose() -> dict:
    res = client.post("/v1/allocations/propose", json=REQ)
    assert res.status_code == 200
    return res.json()


def test_propose_then_confirm() -> None:
    body = _propose()
    assert body["status"] == "proposed"
    assert body["final"] is None
    assert len(body["reasons"]) >= 4

    res = client.post(f"/v1/allocations/{body['id']}/decision", json={"action": "confirm"})
    confirmed = res.json()
    assert res.status_code == 200
    assert confirmed["status"] == "confirmed"
    assert confirmed["final"] == confirmed["proposed"]
    assert all(v == 0 for v in confirmed["adjustment_delta"].values())


def test_adjust_records_feedback_delta() -> None:
    body = _propose()
    p = body["proposed"]
    # 사용자가 즉시가용에서 10만을 빼 여윳돈으로 옮김 (버퍼를 더 채우는 성향)
    adjusted = {
        "tax": p["tax"], "expense": p["expense"],
        "spendable": p["spendable"] - 100_000, "buffer": p["buffer"] + 100_000,
    }
    res = client.post(
        f"/v1/allocations/{body['id']}/decision",
        json={"action": "adjust", "adjusted": adjusted},
    )
    out = res.json()
    assert res.status_code == 200
    assert out["status"] == "adjusted"
    assert out["adjustment_delta"]["spendable"] == pytest.approx(-100_000)
    assert out["adjustment_delta"]["buffer"] == pytest.approx(100_000)


def test_adjust_with_bad_sum_is_422() -> None:
    body = _propose()
    res = client.post(
        f"/v1/allocations/{body['id']}/decision",
        json={"action": "adjust", "adjusted": {"tax": 0, "expense": 0, "spendable": 0, "buffer": 1}},
    )
    assert res.status_code == 422


def test_double_decision_is_409_and_reject_flow() -> None:
    body = _propose()
    client.post(f"/v1/allocations/{body['id']}/decision", json={"action": "reject"})
    res = client.post(f"/v1/allocations/{body['id']}/decision", json={"action": "confirm"})
    assert res.status_code == 409

    got = client.get(f"/v1/allocations/{body['id']}")
    assert got.json()["status"] == "rejected"
    assert got.json()["final"] is None


def test_unknown_id_is_404() -> None:
    assert client.get("/v1/allocations/nope").status_code == 404


# ---------- 컨텍스트 인식 배분 (수주 주기·커리어 추세·조정 성향) ----------

from app.engines.allocator import (  # noqa: E402
    BIAS_CAP_FRACTION,
    BUFFER_MONTHS_MAX,
    CONCENTRATION_EXTRA_MONTHS,
    EARLY_DECLINE_EXTRA_MONTHS,
    LIVING_MONTHS_MAX,
    AllocationContext,
)


def test_no_context_is_backward_compatible() -> None:
    """context 미지정 = 기존 동작 그대로 (하위 호환)."""
    base = propose(3_000_000, PROFILE)
    neutral = propose(3_000_000, PROFILE, context=AllocationContext())
    assert (base.tax, base.expense, base.spendable, base.buffer) == \
           (neutral.tax, neutral.expense, neutral.spendable, neutral.buffer)


def test_long_income_gap_secures_more_living() -> None:
    """수주 공백 45일 → 생활비를 1.5개월치까지 확보 (§6-2④)."""
    p = propose(3_000_000, PROFILE, context=AllocationContext(expected_gap_days=45))
    assert p.assumptions["living_months"] == pytest.approx(1.5)
    assert p.spendable == pytest.approx(PROFILE.expected_monthly_living * 1.5)
    assert any("다음 수입까지" in r for r in p.reasons)
    assert p.tax + p.expense + p.spendable + p.buffer == pytest.approx(p.deposit, abs=0.02)


def test_short_gap_never_reduces_living() -> None:
    """공백이 짧아도(24일) 생활비 확보는 1개월치 밑으로 줄이지 않는다."""
    p = propose(3_000_000, PROFILE, context=AllocationContext(expected_gap_days=24))
    assert p.assumptions["living_months"] == 1.0


def test_gap_capped_at_two_months() -> None:
    p = propose(10_000_000, PROFILE, context=AllocationContext(expected_gap_days=120))
    assert p.assumptions["living_months"] == LIVING_MONTHS_MAX


def test_early_decline_thickens_buffer_target() -> None:
    """커리어 신호 악화 → 버퍼 목표 +1개월 (상한 6개월 클램프)."""
    base = propose(3_000_000, PROFILE)
    declined = propose(3_000_000, PROFILE, context=AllocationContext(early_decline=True))
    assert declined.assumptions["buffer_target_months"] == pytest.approx(
        min(BUFFER_MONTHS_MAX, base.assumptions["buffer_target_months"] + EARLY_DECLINE_EXTRA_MONTHS)
    )
    assert any("감속 추세" in r for r in declined.reasons)


def test_single_source_dependence_thickens_buffer_not_split() -> None:
    """긱 구조: 단일 의존 → 버퍼 목표 +1개월(쿠션). 분할액은 안 바뀐다(폭포수 잔여 구조)."""
    base = propose(3_000_000, PROFILE)
    conc = propose(3_000_000, PROFILE, context=AllocationContext(single_source_dependence=True))
    # 버퍼 '목표'(투자 가능액 기준선)는 두꺼워진다
    assert conc.assumptions["buffer_target_months"] == pytest.approx(
        min(BUFFER_MONTHS_MAX, base.assumptions["buffer_target_months"] + CONCENTRATION_EXTRA_MONTHS)
    )
    assert conc.assumptions["single_source_dependence"] == 1.0
    # 실제 봉투 분할은 동일 — 목표만 올라 '아직 투자 말고 쌓아라'로 나타난다
    assert (conc.tax, conc.expense, conc.spendable, conc.buffer) == \
           (base.tax, base.expense, base.spendable, base.buffer)
    assert conc.invest_available <= base.invest_available
    assert any("한 곳에 몰려" in r for r in conc.reasons)


def test_buffer_bias_shifts_spendable_to_buffer() -> None:
    """조정 성향(행동): 버퍼를 늘려온 습관을 선반영 — 세금·경비는 불가침."""
    base = propose(3_000_000, PROFILE)
    biased = propose(3_000_000, PROFILE, context=AllocationContext(buffer_bias=200_000))
    assert biased.tax == base.tax and biased.expense == base.expense
    assert biased.spendable == pytest.approx(base.spendable - 200_000)
    assert biased.buffer == pytest.approx(base.buffer + 200_000)
    assert biased.assumptions["buffer_bias_applied"] == pytest.approx(200_000)
    assert any("미리 여윳돈으로" in r for r in biased.reasons)


def test_buffer_bias_is_capped() -> None:
    """선반영 상한 = 입금액의 20% — 습관이 커도 제안이 폭주하지 않는다."""
    p = propose(1_000_000, PROFILE, context=AllocationContext(buffer_bias=900_000))
    assert p.assumptions["buffer_bias_applied"] <= 1_000_000 * BIAS_CAP_FRACTION + 0.01
    assert p.tax + p.expense + p.spendable + p.buffer == pytest.approx(p.deposit, abs=0.02)
