"""분류기 LLM 폴백 — 멀티에이전트 오케스트레이션·가드레일 테스트 (LLM은 목으로 대체)."""
from __future__ import annotations

import pytest

from app.services import classifier_llm
from app.services.classifier import TxnInput
from app.services.classifier_llm import classify_with_fallback


def txn(amount: float, counterparty: str, direction: str = "in") -> TxnInput:
    return TxnInput(date="2026-05-15", amount=amount, direction=direction,  # type: ignore[arg-type]
                    counterparty=counterparty)


def mock_llm(monkeypatch: pytest.MonkeyPatch, classify_out: dict | None, judge_out: dict | None):
    """분류/판정 에이전트 호출을 순서대로 기록하고 정해진 답을 돌려주는 목."""
    calls: list[str] = []

    def fake_chat_json(system: str, user: str) -> dict | None:
        if "판정 에이전트다" in system:
            calls.append("judge")
            return judge_out
        calls.append("classify")
        return classify_out

    monkeypatch.setattr(classifier_llm.llm, "chat_json", fake_chat_json)
    return calls


# ---------- 오케스트레이션: 흐름은 코드가 정한다 ----------

def test_rule_hit_never_calls_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    """룰이 잡은 거래(3.3% 역산)는 LLM을 호출조차 하지 않는다."""
    def boom(*a, **k):  # noqa: ANN002, ANN003
        raise AssertionError("LLM must not be called")
    monkeypatch.setattr(classifier_llm.llm, "chat_json", boom)

    c = classify_with_fallback(txn(483_500, "새거래처"))
    assert (c.kind, c.subtype) == ("income", "settlement")


def test_unknown_flows_classify_then_judge(monkeypatch: pytest.MonkeyPatch) -> None:
    """unknown만 분류 에이전트 → 판정 에이전트 순으로 흐른다."""
    calls = mock_llm(
        monkeypatch,
        {"kind": "living", "subtype": None, "confidence": 0.8, "rationale": "더치페이로 보임"},
        {"approve": True, "reason": "거래 정보와 모순 없음"},
    )
    c = classify_with_fallback(txn(45_000, "김민수"))
    assert calls == ["classify", "judge"]
    assert c.kind == "living"
    assert c.needs_review is False
    assert any("분류 에이전트" in s for s in c.signals)
    assert any("판정 에이전트: 승인" in s for s in c.signals)


# ---------- 가드레일 ----------

def test_llm_confidence_is_capped(monkeypatch: pytest.MonkeyPatch) -> None:
    """LLM이 확신 0.99를 주장해도 상한 0.75 — 룰 신호보다 높을 수 없다."""
    mock_llm(
        monkeypatch,
        {"kind": "income", "subtype": "advance", "confidence": 0.99, "rationale": "계약금 같음"},
        {"approve": True, "reason": "모순 없음"},
    )
    c = classify_with_fallback(txn(500_001, "김민수"))
    assert c.confidence <= classifier_llm.LLM_CONFIDENCE_CAP


def test_judge_rejection_forces_review(monkeypatch: pytest.MonkeyPatch) -> None:
    """판정 에이전트가 반려하면 자동 반영 금지 → 수기 태그."""
    mock_llm(
        monkeypatch,
        {"kind": "income", "subtype": "settlement", "confidence": 0.7, "rationale": "매출로 추정"},
        {"approve": False, "reason": "개인 간 거래 가능성이 높음"},
    )
    c = classify_with_fallback(txn(300_000, "김민수"))
    assert c.needs_review is True
    assert any("반려" in s for s in c.signals)


def test_large_amount_always_asks_user(monkeypatch: pytest.MonkeyPatch) -> None:
    """고액(100만원↑)은 판정 에이전트가 승인해도 무조건 사용자에게 직접 물어본다."""
    mock_llm(
        monkeypatch,
        {"kind": "income", "subtype": "advance", "confidence": 0.7, "rationale": "계약금 추정"},
        {"approve": True, "reason": "모순 없음"},
    )
    c = classify_with_fallback(txn(2_500_000, "박준형"))
    assert c.needs_review is True
    assert any("고액 거래" in s and "직접 확인" in s for s in c.signals)


def test_llm_down_falls_back_to_rules(monkeypatch: pytest.MonkeyPatch) -> None:
    """LLM 다운(None) → 룰 결과(unknown, 수기 태그)로 안전 폴백 — 데모가 죽지 않는다."""
    mock_llm(monkeypatch, None, None)
    c = classify_with_fallback(txn(250_000, "토스페이 정산"))
    assert c.kind == "unknown"
    assert c.needs_review is True
    assert any("응답 없음" in s for s in c.signals)


def test_invalid_llm_schema_treated_as_down(monkeypatch: pytest.MonkeyPatch) -> None:
    """스키마 위반(kind 오타 등)은 응답 없음과 동일하게 처리."""
    mock_llm(monkeypatch, {"kind": "revenue", "confidence": 0.9}, {"approve": True, "reason": ""})
    c = classify_with_fallback(txn(250_000, "토스페이 정산"))
    assert c.kind == "unknown"
    assert c.needs_review is True


def test_judge_failure_is_conservative_rejection(monkeypatch: pytest.MonkeyPatch) -> None:
    """판정 에이전트만 죽으면 보수적으로 반려 취급 → 수기 태그."""
    mock_llm(
        monkeypatch,
        {"kind": "living", "subtype": None, "confidence": 0.7, "rationale": "생활비로 보임"},
        None,
    )
    c = classify_with_fallback(txn(45_000, "김민수"))
    assert c.needs_review is True
