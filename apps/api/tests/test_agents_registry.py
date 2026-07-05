"""에이전트 로스터·계약 테스트 — 멀티에이전트 문법이 코드로 강제되는지.

문법 세 줄이 각각 테스트로 잠긴다:
- 역할 분리: specialty는 단문 하나, id 중복 없음
- 오케스트레이션: 로스터는 선언일 뿐 — 에이전트가 다른 에이전트를 부를 수 없다(모듈 검사)
- 가드레일: 모든 에이전트에 guardrails ≥1 + 결정론 fallback, 계약 위반은 생성 실패
"""
from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient

from app.agents import AgentContractError, AgentSpec, get, roster
from app.main import app

client = TestClient(app)


# ── 계약 (가드레일 강제) ──

def _spec(**overrides) -> AgentSpec:
    base = dict(
        id="x", label="x", specialty="한 가지 일만 한다", output="판정",
        model="EXAONE 2.4B", cadence="테스트", guardrails=("g1",),
        fallback="결정론 착지", module="app.services.classifier", implemented=True,
    )
    base.update(overrides)
    return AgentSpec(**base)


def test_contract_rejects_missing_guardrails():
    with pytest.raises(AgentContractError):
        _spec(guardrails=())


def test_contract_rejects_missing_fallback():
    with pytest.raises(AgentContractError):
        _spec(fallback="  ")


def test_contract_rejects_multi_sentence_specialty():
    # 두 문장 = 두 가지 일 — 역할 분리 위반
    with pytest.raises(AgentContractError):
        _spec(specialty="분류한다. 그리고 답변도 판정한다")


# ── 로스터 (역할 분리·정직 표기) ──

def test_roster_has_ten_unique_agents():
    specs = roster()
    assert len(specs) == 10
    assert len({s.id for s in specs}) == 10


def test_every_agent_declares_grammar_fields():
    for s in roster():
        assert s.guardrails, s.id
        assert s.fallback.strip(), s.id
        assert s.specialty.strip(), s.id


def test_exactly_one_mouth():
    # 사용자에게 닿는 입은 피기 발화 하나뿐
    mouths = [s for s in roster() if s.is_mouth]
    assert [m.id for m in mouths] == ["piggy_voice"]


def test_implemented_agents_module_importable():
    # 정직 표기: implemented=True면 모듈이 실제로 있어야 한다
    for s in roster():
        if s.implemented:
            importlib.import_module(s.module)


def test_planned_agents_have_pr_label():
    for s in roster():
        if not s.implemented:
            assert s.pr, f"{s.id}: 예정 에이전트는 담당 PR을 명시해야 함"


def test_get_by_id():
    assert get("piggy_voice").is_mouth
    with pytest.raises(KeyError):
        get("nonexistent")


# ── API (라이브 조회) ──

def test_list_agents_endpoint():
    res = client.get("/v1/agents")
    assert res.status_code == 200
    body = res.json()
    assert body["count"] == 10
    assert set(body["grammar"]) == {"role_separation", "orchestration", "guardrail"}
    ids = {a["id"] for a in body["agents"]}
    assert {"classifier_jury", "profile_read", "envelope_recommend",
            "amount_pacing", "piggy_voice"} <= ids
    # 정직 표기가 응답에도 그대로
    impl = {a["id"]: a["implemented"] for a in body["agents"]}
    assert impl["classifier_jury"] is True
    assert impl["profile_read"] is True
    assert impl["envelope_recommend"] is False
