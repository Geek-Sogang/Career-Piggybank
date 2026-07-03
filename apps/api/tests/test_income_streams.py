"""소득 스트림 분해 — 플랫폼 주기·발주처 리듬·착수금→잔금 추적·도착률."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services.income_streams import composite_next, decompose
from app.store.seed import ensure_seed

client = TestClient(app)


def txn(d: str, cp: str, amount: float = 500_000, subtype: str | None = "settlement") -> dict:
    return {"date": d, "counterparty": cp, "amount": amount, "subtype": subtype}


# ---------- A. 플랫폼 정산 주기 ----------

def test_platform_channel_rhythm() -> None:
    s = decompose([
        txn("2025-01-10", "크몽 정산"), txn("2025-02-09", "크몽 정산"), txn("2025-03-11", "크몽 정산"),
    ], months_observed=3)
    assert s.platform_channels == 1
    c = next(c for c in s.candidates if c.source == "platform")
    assert c.label == "크몽 정산"
    assert c.expected_date == "2025-04-10"  # 3-11 + 중앙 간격 30일


# ---------- B. 반복 발주처 리듬 ----------

def test_repeat_client_rhythm() -> None:
    s = decompose([
        txn("2025-01-05", "㈜브릿지웍스"), txn("2025-03-06", "㈜브릿지웍스"),
        txn("2025-02-01", "일회성클라이언트"),
    ], months_observed=3)
    assert s.repeat_clients == 1
    c = next(c for c in s.candidates if c.source == "repeat_client")
    assert c.label == "㈜브릿지웍스"
    assert c.expected_date == "2025-05-05"  # 3-06 + 60일


# ---------- C. 착수금 → 잔금 추적 (원장이 아는 미래) ----------

def test_advance_opens_pending_settlement() -> None:
    s = decompose([txn("2025-05-01", "㈜비욘드", 3_000_000, subtype="advance")], months_observed=1)
    assert len(s.pending_settlements) == 1
    p = s.pending_settlements[0]
    assert p.counterparty == "㈜비욘드"
    assert p.expected_date == "2025-05-31"  # 기본 lag 30일 (콜드스타트)
    assert any(c.source == "pending_settlement" for c in s.candidates)


def test_later_income_closes_pending() -> None:
    s = decompose([
        txn("2025-05-01", "㈜비욘드", 3_000_000, subtype="advance"),
        txn("2025-06-10", "㈜비욘드", 2_000_000, subtype="settlement"),
    ], months_observed=2)
    assert s.pending_settlements == []


def test_advance_lag_learned_from_history() -> None:
    """과거 착수금→잔금 쌍이 있으면 그 실측 간격으로 예상한다."""
    s = decompose([
        txn("2025-01-01", "A사", 1_000_000, subtype="advance"),
        txn("2025-01-15", "A사", 1_000_000, subtype="settlement"),   # 실측 lag 14일
        txn("2025-05-01", "B사", 2_000_000, subtype="advance"),      # 미결
    ], months_observed=5)
    p = s.pending_settlements[0]
    assert p.expected_date == "2025-05-15"
    assert "14일" in p.basis


# ---------- D. 신규/일회성 도착률 ----------

def test_one_off_arrival_rate() -> None:
    s = decompose([
        txn("2025-01-05", "신규A"), txn("2025-02-20", "신규B"), txn("2025-03-15", "신규C"),
    ], months_observed=3)
    assert s.one_off_per_month == 1.0
    assert any("신규 발주는 원장에 신호가 없어요" in r for r in s.reasons)


# ---------- 합성 ----------

def test_composite_picks_earliest_future() -> None:
    s = decompose([
        txn("2025-01-10", "크몽 정산"), txn("2025-02-09", "크몽 정산"),   # 다음 3-11
        txn("2025-02-20", "㈜비욘드", 3_000_000, subtype="advance"),     # 잔금 3-22
    ], months_observed=2)
    c = composite_next(s, after="2025-02-20")
    assert c is not None
    assert c.expected_date == "2025-03-11"  # 플랫폼 주기가 잔금 예상보다 이름


def test_cold_start_has_no_candidates() -> None:
    s = decompose([txn("2025-01-05", "일회성A"), txn("2025-02-01", "일회성B")], months_observed=2)
    assert s.candidates == []
    assert composite_next(s, after="2025-02-01") is None
    assert any("폴백" in r for r in s.reasons)


# ---------- 라우트: 착수금 입금 → 예보에 진행 중 계약이 뜬다 ----------

def test_forecast_streams_after_advance_deposit() -> None:
    ensure_seed()
    res = client.post("/v1/bank/deposit", json={
        "date": "2025-05-20", "amount": 3_000_000, "counterparty": "㈜비욘드테크",
    })
    assert res.json()["transaction"]["subtype"] == "advance"  # 사업자 형태 룰

    body = client.get("/v1/forecast").json()
    st = body["streams"]
    assert st["platform_channels"] >= 2  # 위시켓·크몽 정산
    pend = [p for p in st["pending_settlements"] if p["counterparty"] == "㈜비욘드테크"]
    assert len(pend) == 1
    assert any(c["source"] == "pending_settlement" for c in st["candidates"])
    assert any("물줄기 분해" in r for r in st["reasons"])


# ---------- 지연된 계약 — 예측 오염 대신 코치 질문으로 전환 ----------

def test_stale_advance_becomes_question_not_candidate() -> None:
    """lag×2가 지나도 잔금이 없으면 후보에서 빠지고 질문이 된다."""
    s = decompose(
        [txn("2025-01-01", "㈜비욘드", 3_000_000, subtype="advance")],
        months_observed=4, as_of="2025-04-01",  # 기본 lag 30일 × 2 = 60일 훌쩍 경과
    )
    assert s.pending_settlements == []
    assert not any(c.source == "pending_settlement" for c in s.candidates)
    assert len(s.stale_settlements) == 1
    assert "오래 걸리고" in s.stale_settlements[0].question
    assert any("지연된 계약" in r for r in s.reasons)


def test_fresh_advance_stays_pending() -> None:
    s = decompose(
        [txn("2025-05-01", "㈜비욘드", 3_000_000, subtype="advance")],
        months_observed=1, as_of="2025-05-20",  # 아직 60일 안 지남
    )
    assert len(s.pending_settlements) == 1
    assert s.stale_settlements == []
