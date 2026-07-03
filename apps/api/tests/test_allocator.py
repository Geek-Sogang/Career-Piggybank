"""봉투 배분 엔진(allocator) + 제안/승인 라우트 테스트."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.allocator import (
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
