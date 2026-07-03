"""피기 코치 테스트 — 숫자 검증 가드레일 중심 (LLM은 목)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import coach

CONTEXT = {
    "proposed": {"tax": 108900, "expense": 400000, "spendable": 1200000, "buffer": 1291100},
    "reasons": [
        "세금봉투 108,900원: 실효 추가세율 3.6%를 먼저 떼어 5월 종소세에 대비해요",
        "여윳돈 1,291,100원: 버퍼 목표까지 더 모아요",
    ],
}


def set_llm_reply(monkeypatch: pytest.MonkeyPatch, reply: str | None) -> list[str]:
    prompts: list[str] = []

    def fake_chat_text(system: str, user: str, temperature: float = 0.4) -> str | None:
        prompts.append(user)
        return reply

    monkeypatch.setattr(coach.llm, "chat_text", fake_chat_text)
    return prompts


# ---------- 정상 경로: 컨텍스트 숫자만 인용 ----------

def test_grounded_reply_passes(monkeypatch: pytest.MonkeyPatch) -> None:
    prompts = set_llm_reply(
        monkeypatch, "이번 달은 여윳돈에 1,291,100원을 담아봤어요. 이대로 반영할까요?"
    )
    r = coach.chat("이번 입금 왜 이렇게 나눴어?", CONTEXT)
    assert r.source == "llm"
    assert r.verified is True
    assert "1291100" in prompts[0].replace(",", "")  # 컨텍스트가 프롬프트에 주입됨


def test_small_numbers_are_exempt(monkeypatch: pytest.MonkeyPatch) -> None:
    """개월·나이·% 같은 두 자리 이하 숫자는 검증 면제."""
    set_llm_reply(monkeypatch, "약 3개월치 버퍼를 먼저 채우는 걸 추천드려요!")
    r = coach.chat("버퍼가 뭐야?", CONTEXT)
    assert r.source == "llm"


# ---------- 가드레일: 지어낸 숫자 차단 ----------

def test_fabricated_number_is_blocked(monkeypatch: pytest.MonkeyPatch) -> None:
    """컨텍스트에 없는 2,900,000원을 지어내면 → 결정론 폴백으로 교체."""
    set_llm_reply(monkeypatch, "여윳돈에 2,900,000원을 넣어드렸어요!")
    r = coach.chat("얼마 넣었어?", CONTEXT)
    assert r.source == "fallback"
    assert r.verified is False
    assert "2,900,000" not in r.reply           # 할루시네이션 금액이 사용자에게 닿지 않음
    assert "108,900" in r.reply                 # 폴백은 실제 근거를 전달


def test_llm_down_uses_reason_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    set_llm_reply(monkeypatch, None)
    r = coach.chat("설명해줘", CONTEXT)
    assert r.source == "fallback"
    assert r.verified is True
    assert "세금봉투" in r.reply


def test_llm_down_without_context(monkeypatch: pytest.MonkeyPatch) -> None:
    set_llm_reply(monkeypatch, None)
    r = coach.chat("안녕?", None)
    assert r.source == "fallback"
    assert r.reply  # 빈 응답 금지


# ---------- 라우트 ----------

client = TestClient(app)


def test_chat_route(monkeypatch: pytest.MonkeyPatch) -> None:
    set_llm_reply(monkeypatch, "세금봉투에 108,900원을 먼저 챙겨뒀어요. 이대로 갈까요?")
    res = client.post("/v1/coach/chat", json={"message": "왜 이렇게 나눴어?", "context": CONTEXT})
    assert res.status_code == 200
    body = res.json()
    assert body["source"] == "llm"
    assert body["verified"] is True


def test_chat_route_rejects_empty_message() -> None:
    assert client.post("/v1/coach/chat", json={"message": ""}).status_code == 422
