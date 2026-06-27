"""세금봉투 결정론 엔진 단위 테스트."""
from __future__ import annotations

from app.services import tax_envelope as engine


def test_income_tax_brackets():
    # 과세표준 21,000,000 → 15% 구간, 누진공제 1,260,000
    assert engine.income_tax(21_000_000) == 21_000_000 * 0.15 - 1_260_000
    # 0 이하는 0
    assert engine.income_tax(0) == 0
    assert engine.income_tax(-100) == 0


def test_estimate_annual_tax_known_value():
    # 연매출 3천만, 경비율 30% → 과세표준 2,100만
    # 소득세 1,890,000 · 지방세 189,000 · 합계 2,079,000
    # 원천징수 990,000 → 추가납부 1,089,000
    r = engine.estimate_annual_tax(30_000_000, expense_rate=0.30)
    assert r.taxable == 21_000_000
    assert r.income_tax == 1_890_000
    assert r.local_tax == 189_000
    assert r.total_tax == 2_079_000
    assert r.already_withheld == 990_000
    assert r.additional_due == 1_089_000


def test_split_deposit_conserves_amount():
    # 4봉투 합 == 입금액 (반올림 오차 1원 이내)
    e = engine.split_deposit(500_000, annual_gross=30_000_000)
    total = e.tax + e.expense + e.buffer + e.spendable
    assert abs(total - e.deposit) <= 1.0
    # 세금봉투는 양수, 가정값 노출
    assert e.tax > 0
    assert e.assumptions["expense_rate"] == 0.30


def test_split_deposit_clamps_when_refund():
    # 고경비율로 과세표준이 낮아 산출세액 < 3.3% 선납 → 추가납부 음수 → 세금봉투 0 클램프
    e = engine.split_deposit(300_000, annual_gross=3_000_000, expense_rate=0.9)
    assert e.tax == 0


def test_api_endpoints_work():
    from fastapi.testclient import TestClient

    from app.main import app

    c = TestClient(app)

    health = c.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    res = c.post(
        "/v1/tax-envelope/split",
        json={"deposit": 500_000, "annual_gross": 30_000_000},
    )
    assert res.status_code == 200
    b = res.json()
    assert abs((b["tax"] + b["expense"] + b["buffer"] + b["spendable"]) - b["deposit"]) <= 1
