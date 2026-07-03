"""분류기 LLM 배심원단 — 멀티에이전트 오케스트레이션·합의·가드레일 테스트 (LLM은 목으로 대체)."""
from __future__ import annotations

import pytest

from app.services import classifier_llm
from app.services.classifier import TxnInput
from app.services.classifier_llm import classify_with_fallback

JUROR_COUNT = len(classifier_llm._JURORS)


def txn(amount: float, counterparty: str, direction: str = "in") -> TxnInput:
    return TxnInput(date="2026-05-15", amount=amount, direction=direction,  # type: ignore[arg-type]
                    counterparty=counterparty)


def vote(kind: str, confidence: float = 0.7, subtype: str | None = None, rationale: str = "근거") -> dict:
    return {"kind": kind, "subtype": subtype, "confidence": confidence, "rationale": rationale}


def mock_llm(monkeypatch: pytest.MonkeyPatch, juror_outs: list[dict | None], judge_out: dict | None):
    """배심원 3인(순서대로)·판정 에이전트 호출을 기록하고 정해진 답을 돌려주는 목."""
    calls: list[str] = []
    remaining = list(juror_outs)

    def fake_chat_json(system: str, user: str) -> dict | None:
        if "판정 에이전트다" in system:
            calls.append("judge")
            return judge_out
        calls.append("juror")
        return remaining.pop(0) if remaining else None

    monkeypatch.setattr(classifier_llm.llm, "chat_json", fake_chat_json)
    return calls


def unanimous(kind: str = "living", confidence: float = 0.7) -> list[dict]:
    return [vote(kind, confidence) for _ in range(JUROR_COUNT)]


# ---------- 오케스트레이션: 흐름은 코드가 정한다 ----------

def test_rule_hit_never_calls_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    """룰이 잡은 거래(3.3% 역산)는 LLM을 호출조차 하지 않는다."""
    def boom(*a, **k):  # noqa: ANN002, ANN003
        raise AssertionError("LLM must not be called")
    monkeypatch.setattr(classifier_llm.llm, "chat_json", boom)

    c = classify_with_fallback(txn(483_500, "새거래처"))
    assert (c.kind, c.subtype) == ("income", "settlement")


def test_unknown_flows_jury_then_judge(monkeypatch: pytest.MonkeyPatch) -> None:
    """unknown만 배심원단 3인 → 판정 에이전트 순으로 흐른다."""
    calls = mock_llm(monkeypatch, unanimous("living"), {"approve": True, "reason": "모순 없음"})
    c = classify_with_fallback(txn(45_000, "김민수"))
    assert calls == ["juror"] * JUROR_COUNT + ["judge"]
    assert c.kind == "living"
    assert c.needs_review is False
    assert any("배심원단" in s and "만장일치" in s for s in c.signals)
    assert any("판정 에이전트: 승인" in s for s in c.signals)


# ---------- 합의 규칙: 집계는 코드가 한다 ----------

def test_unanimous_gets_higher_cap_but_below_rules(monkeypatch: pytest.MonkeyPatch) -> None:
    """만장일치 + 판정 승인 → 상한 0.85까지 허용 — 그래도 룰 신호(0.9~)보다 낮다."""
    mock_llm(monkeypatch, unanimous("living", 0.99), {"approve": True, "reason": "모순 없음"})
    c = classify_with_fallback(txn(45_000, "김민수"))
    assert c.confidence == classifier_llm.UNANIMOUS_CONFIDENCE_CAP
    assert c.confidence < 0.9


def test_majority_keeps_base_cap(monkeypatch: pytest.MonkeyPatch) -> None:
    """2:1 다수결은 만장일치가 아니므로 상한 0.75 유지."""
    mock_llm(
        monkeypatch,
        [vote("living", 0.9), vote("living", 0.9), vote("income", 0.9)],
        {"approve": True, "reason": "모순 없음"},
    )
    c = classify_with_fallback(txn(45_000, "김민수"))
    assert c.kind == "living"
    assert c.confidence <= classifier_llm.LLM_CONFIDENCE_CAP
    assert any("다수결 2/3" in s for s in c.signals)


def test_full_split_forces_review(monkeypatch: pytest.MonkeyPatch) -> None:
    """배심원 전원이 다른 답 → 합의 실패, 자동 반영 금지."""
    mock_llm(
        monkeypatch,
        [vote("living", 0.8), vote("income", 0.8), vote("expense", 0.8)],
        {"approve": True, "reason": "모순 없음"},
    )
    c = classify_with_fallback(txn(45_000, "김민수"))
    assert c.needs_review is True
    assert any("의견 분열" in s for s in c.signals)


def test_single_valid_vote_is_not_consensus(monkeypatch: pytest.MonkeyPatch) -> None:
    """배심원 2인이 죽고 1표만 유효 → 합의가 아니므로 사람 확인."""
    mock_llm(monkeypatch, [vote("living", 0.8), None, None], {"approve": True, "reason": "모순 없음"})
    c = classify_with_fallback(txn(45_000, "김민수"))
    assert c.kind == "living"
    assert c.needs_review is True


# ---------- 가드레일 ----------

def test_judge_rejection_forces_review(monkeypatch: pytest.MonkeyPatch) -> None:
    """판정 에이전트가 반려하면 만장일치여도 자동 반영 금지 → 수기 태그."""
    mock_llm(monkeypatch, unanimous("income", 0.7), {"approve": False, "reason": "개인 간 거래 가능성"})
    c = classify_with_fallback(txn(300_000, "김민수"))
    assert c.needs_review is True
    assert any("반려" in s for s in c.signals)


def test_large_amount_always_asks_user(monkeypatch: pytest.MonkeyPatch) -> None:
    """고액(100만원↑)은 만장일치·판정 승인이어도 무조건 사용자에게 직접 물어본다."""
    mock_llm(monkeypatch, unanimous("income", 0.7), {"approve": True, "reason": "모순 없음"})
    c = classify_with_fallback(txn(2_500_000, "박준형"))
    assert c.needs_review is True
    assert any("고액 거래" in s and "직접 확인" in s for s in c.signals)


def test_llm_income_verdict_never_auto_applies(monkeypatch: pytest.MonkeyPatch) -> None:
    """LLM의 매출(income) 판정은 소액·만장일치·판정 승인이어도 자동 반영 금지."""
    mock_llm(monkeypatch, unanimous("income", 0.7), {"approve": True, "reason": "모순 없음"})
    c = classify_with_fallback(txn(300_000, "정하늘"))
    assert c.kind == "income"
    assert c.needs_review is True
    assert any("자동 반영하지 않아요" in s for s in c.signals)


def test_llm_down_falls_back_to_rules(monkeypatch: pytest.MonkeyPatch) -> None:
    """LLM 전원 다운(None) → 룰 결과(unknown, 수기 태그)로 안전 폴백 — 데모가 죽지 않는다."""
    mock_llm(monkeypatch, [None, None, None], None)
    c = classify_with_fallback(txn(250_000, "토스페이 정산"))
    assert c.kind == "unknown"
    assert c.needs_review is True
    assert any("응답 없음" in s for s in c.signals)


def test_invalid_llm_schema_treated_as_down(monkeypatch: pytest.MonkeyPatch) -> None:
    """스키마 위반(kind 오타 등)은 응답 없음과 동일하게 처리."""
    bad = {"kind": "revenue", "confidence": 0.9}
    mock_llm(monkeypatch, [bad, bad, bad], {"approve": True, "reason": ""})
    c = classify_with_fallback(txn(250_000, "토스페이 정산"))
    assert c.kind == "unknown"
    assert c.needs_review is True


def test_judge_failure_is_conservative_rejection(monkeypatch: pytest.MonkeyPatch) -> None:
    """판정 에이전트만 죽으면 보수적으로 반려 취급 → 수기 태그."""
    mock_llm(monkeypatch, unanimous("living", 0.7), None)
    c = classify_with_fallback(txn(45_000, "김민수"))
    assert c.needs_review is True
