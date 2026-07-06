"""예정 수입 이벤트 수집 — 파싱만 LLM, 검증(금액 접지·미래 날짜)·반영은 결정론."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import event_capture
from app.services.event_capture import capture
from app.store import db
from app.store.seed import ensure_seed

client = TestClient(app)
TODAY = "2025-05-27"


def mock_parser(monkeypatch: pytest.MonkeyPatch, out: dict | None) -> None:
    monkeypatch.setattr(event_capture.llm, "chat_json", lambda *a, **k: out)


def test_valid_event_with_unit_conversion(monkeypatch: pytest.MonkeyPatch) -> None:
    """'200만원' → 2,000,000 단위 환산은 접지로 인정."""
    mock_parser(monkeypatch, {"has_event": True, "date": "2025-06-03", "amount": 2_000_000, "label": "잔금"})
    ev = capture("다음 주에 잔금 200만원 들어와요", TODAY)
    assert ev is not None
    assert (ev.date, ev.amount, ev.label) == ("2025-06-03", 2_000_000, "잔금")


def test_hallucinated_amount_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    """메시지에 없는 금액을 지어내면 이벤트 자체를 폐기."""
    mock_parser(monkeypatch, {"has_event": True, "date": "2025-06-03", "amount": 3_500_000, "label": "잔금"})
    assert capture("다음 주에 잔금 200만원 들어와요", TODAY) is None


def test_past_date_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_parser(monkeypatch, {"has_event": True, "date": "2025-05-01", "amount": None, "label": "정산"})
    assert capture("지난주에 정산 받았어요", TODAY) is None


def test_too_far_future_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_parser(monkeypatch, {"has_event": True, "date": "2027-01-01", "amount": None, "label": "언젠가"})
    assert capture("언젠가 큰 계약이 올 거예요", TODAY) is None


def test_no_event_and_llm_down(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_parser(monkeypatch, {"has_event": False, "date": None, "amount": None, "label": ""})
    assert capture("세금봉투가 뭐예요?", TODAY) is None
    mock_parser(monkeypatch, None)
    assert capture("다음 주 잔금 200만원", TODAY) is None  # LLM 다운 → 조용히 무시


def test_amount_optional(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_parser(monkeypatch, {"has_event": True, "date": "2025-06-10", "amount": None, "label": "정산 예정"})
    ev = capture("다음 달 초에 정산 있어요", TODAY)
    assert ev is not None and ev.amount is None


# ---------- 챗 라우트 → 저장 → 예측 반영 (전체 루프) ----------

def test_chat_captures_event_and_forecast_reflects_it(monkeypatch: pytest.MonkeyPatch) -> None:
    ensure_seed()
    mock_parser(monkeypatch, {"has_event": True, "date": "2025-06-03", "amount": 2_000_000, "label": "잔금"})
    monkeypatch.setattr("app.services.coach.llm.chat_text", lambda *a, **k: None)  # 코치는 폴백

    res = client.post("/v1/coach/chat", json={"message": "다음 주에 잔금 200만원 들어와요"})
    body = res.json()
    assert body["captured_event"] == {"date": "2025-06-03", "amount": 2_000_000, "label": "잔금"}
    assert "예정 수입으로 기억해둘게요" in body["reply"]
    assert len(db.list_expected_events()) == 1

    fc = client.get("/v1/forecast").json()
    reported = [c for c in fc["streams"]["candidates"] if c["source"] == "user_reported"]
    assert len(reported) == 1
    assert reported[0]["expected_date"] == "2025-06-03"
    assert "직접 알려주신" in reported[0]["basis"]


def test_month_overflow_date_is_corrected(monkeypatch: pytest.MonkeyPatch) -> None:
    """LLM의 달 경계 산수 실수('2025-05-33')를 달력이 교정 — 검증에서 발견된 실사례."""
    mock_parser(monkeypatch, {"has_event": True, "date": "2025-05-33", "amount": 1_500_000, "label": "잔금"})
    ev = capture("다음 주에 잔금 150만원 들어와요", "2025-05-26")
    assert ev is not None and ev.date == "2025-06-02"
