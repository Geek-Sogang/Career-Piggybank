"""확인 질문 에이전트 — 질문만 만들고, 선택지는 코드가, 숫자는 검증기가 지킨다."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.agents import clarify
from app.store.seed import ensure_seed

client = TestClient(app)


def mock_llm(monkeypatch: pytest.MonkeyPatch, out: dict | None) -> None:
    monkeypatch.setattr(clarify.llm, "chat_json", lambda *a, **k: out)


def test_llm_question_passes_when_grounded(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_llm(monkeypatch, {"question": "김하늘님이 보낸 150,000원, 진행 중인 일의 대금인가요?"})
    q = clarify.make_question(150_000, "김하늘", "웹사이트 수정 건", ["개인 이름 형태 입금자"])
    assert q.source == "llm"
    assert q.question.endswith("?")


def test_hallucinated_number_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    """질문 속 숫자가 거래 컨텍스트에 없으면(지어냈으면) 결정론 폴백으로 교체."""
    mock_llm(monkeypatch, {"question": "김하늘님이 보낸 999,999원, 일의 대금인가요?"})
    q = clarify.make_question(150_000, "김하늘", "", [])
    assert q.source == "fallback"
    assert "150,000" in q.question


def test_llm_down_falls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_llm(monkeypatch, None)
    q = clarify.make_question(250_000, "토스페이 정산", "", [])
    assert q.source == "fallback"
    assert "토스페이 정산" in q.question and "250,000" in q.question


def test_options_are_code_defined_tag_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    """선택지는 LLM 출력과 무관하게 코드가 정한다 — 탭 = 수기 태그 경로."""
    mock_llm(monkeypatch, {"question": "이상한 답변?"})
    q = clarify.make_question(50_000, "박지영", "", [])
    kinds = [o["kind"] for o in q.options]
    assert kinds == ["income", "living", "expense"]


def test_overlong_question_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_llm(monkeypatch, {"question": "가" * 100 + "?"})
    q = clarify.make_question(50_000, "박지영", "", [])
    assert q.source == "fallback"


# ---------- 라우트 ----------

def test_deposit_needs_review_carries_clarify(monkeypatch: pytest.MonkeyPatch) -> None:
    """미분류 입금 → 응답에 해소 질문이 실린다 (배분 제안은 없음)."""
    ensure_seed()
    mock_llm(monkeypatch, None)  # CI: LLM 없음 → 폴백 질문
    res = client.post("/v1/bank/deposit", json={
        "date": "2025-05-25", "amount": 300_000, "counterparty": "박준형",
    })
    body = res.json()
    assert body["allocation"] is None
    assert body["clarify"] is not None
    assert body["clarify"]["source"] == "fallback"
    assert len(body["clarify"]["options"]) == 3


def test_clarify_endpoint_for_seeded_unclassified(monkeypatch: pytest.MonkeyPatch) -> None:
    """시드의 미분류 행(토스페이 정산)에 대해 같은 질문을 조회할 수 있다."""
    ensure_seed()
    mock_llm(monkeypatch, None)
    txns = client.get("/v1/bank/transactions").json()
    pending = next(t for t in txns if t["needs_review"])
    res = client.get(f"/v1/bank/transactions/{pending['id']}/clarify")
    assert res.status_code == 200
    assert res.json()["question"].endswith("?")


def test_clarify_conflict_when_already_classified() -> None:
    ensure_seed()
    txns = client.get("/v1/bank/transactions").json()
    done = next(t for t in txns if not t["needs_review"])
    res = client.get(f"/v1/bank/transactions/{done['id']}/clarify")
    assert res.status_code == 409
