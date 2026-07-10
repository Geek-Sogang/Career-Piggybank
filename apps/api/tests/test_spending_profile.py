"""프로필 예측기(spending_profile) 테스트."""
from __future__ import annotations

import statistics

from fastapi.testclient import TestClient

from app.main import app
from app.engines.allocator import propose
from app.engines.spending_profile import (
    COLD_START_MONTHS,
    PERSONA_PRESETS,
    Txn,
    estimate,
)


def month_txns(month: str, income: float = 0, expense: float = 0, living: float = 0) -> list[Txn]:
    out = []
    if income:
        out.append(Txn(date=f"{month}-15", amount=income, kind="income"))
    if expense:
        out.append(Txn(date=f"{month}-05", amount=expense, kind="expense"))
    if living:
        out.append(Txn(date=f"{month}-20", amount=living, kind="living"))
    return out


# 4개월 이력 — 3월에 이상치(대박 일감 + 장비 지출)
HISTORY = (
    month_txns("2026-01", income=1_500_000, expense=300_000, living=1_100_000)
    + month_txns("2026-02", income=800_000, expense=350_000, living=1_150_000)
    + month_txns("2026-03", income=6_000_000, expense=2_500_000, living=1_200_000)  # 이상치
    + month_txns("2026-04", income=1_200_000, expense=320_000, living=1_100_000)
)


# ---------- 개인 데이터 구간 (3개월 이상 → 프리셋 혼합 없음) ----------

def test_full_personal_data_after_cold_start() -> None:
    est = estimate(HISTORY)
    assert est.months_observed == 4
    assert est.blend_weight == 1.0


def test_median_is_robust_to_outlier_month() -> None:
    """3월 대박(경비 250만)이 있어도 예상 월경비는 평상 수준에 머문다."""
    est = estimate(HISTORY)
    assert est.profile.expected_monthly_expense == statistics.median(
        [300_000, 350_000, 2_500_000, 320_000]
    )  # 335,000 — 평균(867,500)이었다면 2.6배 부풀었을 것
    assert est.profile.expected_monthly_expense < 400_000


def test_income_cv_from_monthly_incomes() -> None:
    incomes = [1_500_000, 800_000, 6_000_000, 1_200_000]
    expected_cv = statistics.pstdev(incomes) / statistics.mean(incomes)
    assert estimate(HISTORY).profile.income_cv == round(expected_cv, 4)


def test_avg_deposit_is_median_of_deposits() -> None:
    est = estimate(HISTORY)
    assert est.profile.avg_deposit == statistics.median([1_500_000, 800_000, 6_000_000, 1_200_000])


def test_tax_annual_gross_is_annualized_sum_not_median() -> None:
    """세금용 연매출은 합계 연환산 — 큰 대금이 가끔 오는 왜곡 소득에서 중앙값×12는 과소.

    [100만×5 + 700만] 6개월: median×12 = 1,200만(절반) vs 합계 연환산 2,400만.
    세금봉투가 절반만 쌓여 5월 종소세에 모자라던 버그를 막는다.
    """
    txns = [Txn(date=f"2026-0{m}-10", amount=(7_000_000 if m == 6 else 1_000_000), kind="income")
            for m in range(1, 7)]
    est = estimate(txns)
    assert est.blend_weight == 1.0                    # 6개월 → 프리셋 혼합 없음
    assert est.profile.annual_gross == 24_000_000     # 합 1,200만 ÷ 6 × 12 (중앙값 기준 1,200만 아님)


def test_living_still_median_robust_to_income_skew() -> None:
    """소득이 왜곡돼도 생활비 프로필은 중앙값 유지 (세금만 합계, 생활은 평소)."""
    txns = [Txn(date=f"2026-0{m}-10", amount=(7_000_000 if m == 6 else 1_000_000), kind="income")
            for m in range(1, 7)]
    txns += [Txn(date=f"2026-0{m}-20", amount=1_000_000, kind="living") for m in range(1, 7)]
    est = estimate(txns)
    assert est.profile.expected_monthly_living == 1_000_000   # 중앙값 유지


# ---------- 콜드스타트 (프리셋 혼합) ----------

def test_no_history_uses_pure_preset() -> None:
    est = estimate([], persona="designer")
    assert est.blend_weight == 0.0
    assert est.profile == PERSONA_PRESETS["designer"]
    assert est.notes  # 혼합 사유가 설명됨


def test_partial_history_blends_toward_personal() -> None:
    one_month = month_txns("2026-01", income=1_500_000, expense=300_000, living=1_100_000)
    est = estimate(one_month, persona="developer")
    assert est.blend_weight == round(1 / COLD_START_MONTHS, 4)
    preset = PERSONA_PRESETS["developer"]
    # 관측(월 150만→연 1800만)과 프리셋(연 3600만) 사이 가중 평균
    assert preset.annual_gross > est.profile.annual_gross > 1_500_000 * 12


def test_unknown_persona_falls_back_to_default() -> None:
    assert estimate([], persona="astronaut").persona == "developer"


# ---------- 데모 장면: 같은 입금, 다른 제안 (개인화 증명) ----------

def test_same_deposit_different_proposal_over_time() -> None:
    """가입 첫날(프리셋) vs 4개월 후(개인 통계) — 같은 300만원인데 배분이 달라진다."""
    day_one = propose(3_000_000, estimate([]).profile)
    month_four = propose(3_000_000, estimate(HISTORY).profile)
    assert day_one.expense != month_four.expense
    assert day_one.buffer != month_four.buffer


# ---------- API 라우트 ----------

client = TestClient(app)


def test_estimate_route_feeds_allocator() -> None:
    txns = [
        {"date": t.date, "amount": t.amount, "kind": t.kind} for t in HISTORY
    ]
    res = client.post("/v1/profile/estimate", json={"transactions": txns, "persona": "developer"})
    assert res.status_code == 200
    body = res.json()
    assert body["months_observed"] == 4

    # 응답 profile을 그대로 배분 제안에 연결할 수 있어야 한다 (파이프라인 계약)
    res2 = client.post(
        "/v1/allocations/propose",
        json={"deposit": 3_000_000, "profile": body["profile"]},
    )
    assert res2.status_code == 200
    assert res2.json()["status"] == "proposed"


def test_estimate_route_rejects_bad_date() -> None:
    res = client.post(
        "/v1/profile/estimate",
        json={"transactions": [{"date": "01-15-2026", "amount": 1000, "kind": "income"}]},
    )
    assert res.status_code == 422
