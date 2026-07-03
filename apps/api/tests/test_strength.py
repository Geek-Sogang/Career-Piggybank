"""강점 한 줄 테스트 — 후보=결정론·LLM=선택만 가드레일 (LLM은 목)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import strength
from app.services.strength import CareerFacts, build_candidates, pick

FULL = CareerFacts(
    verified_count=12, months_active=24, repeat_client_rate=0.8,
    settlement_growth=3.0, top_skill="React 커머스",
)


def set_llm(monkeypatch: pytest.MonkeyPatch, out: dict | None) -> None:
    monkeypatch.setattr(strength.llm, "chat_json", lambda s, u: out)


# ---------- 후보 = 결정론 ----------

def test_candidates_contain_exact_numbers() -> None:
    cands = build_candidates(FULL)
    assert any("80%" in c for c in cands)          # 재의뢰율
    assert any("3배" in c for c in cands)          # 성장
    assert any("24개월" in c for c in cands)       # 연속 활동
    assert any("React 커머스" in c and "12건" in c for c in cands)


def test_no_facts_no_candidates() -> None:
    assert build_candidates(CareerFacts()) == []
    r = pick(CareerFacts())
    assert r.chosen_by == "fallback"
    assert "연결하면" in r.line  # 중립 문구, 지어낸 강점 없음


def test_missing_fact_skips_candidate() -> None:
    cands = build_candidates(CareerFacts(verified_count=12, months_active=24))
    assert not any("재의뢰율" in c for c in cands)  # 근거 없는 사실은 후보조차 안 만듦


# ---------- LLM은 선택만 ----------

def test_llm_choice_returns_candidate_verbatim(monkeypatch: pytest.MonkeyPatch) -> None:
    set_llm(monkeypatch, {"choice": 1, "reason": "성장세가 가장 인상적"})
    r = pick(FULL)
    assert r.chosen_by == "llm"
    assert r.line == build_candidates(FULL)[1]  # 원문 그대로 — 재작성 금지


def test_out_of_range_choice_falls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    set_llm(monkeypatch, {"choice": 99, "reason": "?"})
    r = pick(FULL)
    assert r.chosen_by == "fallback"
    assert r.line in build_candidates(FULL)


def test_llm_down_falls_back_to_priority_rule(monkeypatch: pytest.MonkeyPatch) -> None:
    set_llm(monkeypatch, None)
    r = pick(FULL)
    assert r.chosen_by == "fallback"
    assert "재의뢰율" in r.line  # 우선순위 1위 = 시장 검증 신호(2층)


# ---------- 라우트 ----------

client = TestClient(app)


def test_strength_route(monkeypatch: pytest.MonkeyPatch) -> None:
    set_llm(monkeypatch, {"choice": 0, "reason": "재의뢰율이 핵심"})
    res = client.post("/v1/strength", json={
        "verified_count": 12, "months_active": 24,
        "repeat_client_rate": 0.8, "settlement_growth": 3.0, "top_skill": "React 커머스",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["line"] in body["candidates"]
    assert body["chosen_by"] == "llm"
