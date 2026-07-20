"""V2 개인화 번역층 테스트 — 구조 2 + 금융 대응 3이 '번역'이지 '새 판정'이 아님을 지킨다.

검증 4묶음:
- 매핑이 결정론으로 맞는가 (안전자금·자금 페이스 3버킷 · 관리 강도 규칙표 전조합)
- 불가침이 지켜지는가 (confidence 부재 · F14 방향 제외 · 보류는 정직하게)
- 오버라이드가 권장을 덮어쓰지 않는가 (별도 보관 · 최신 이벤트 우선 · 무효 값은 해제)
- 기존 소비 계약이 불변인가 (배분 컨텍스트가 v2에 독립 · 라우트 422 게이트)
"""
from __future__ import annotations

import dataclasses

from fastapi.testclient import TestClient

from app.main import app
from app.engines.facts import Fact
from app.engines.gig_profile import GigProfile
from app.profile import personalization_v2 as v2
from app.profile.user_profile import build_user_profile
from app.store import db

client = TestClient(app)


def _axis(value: float, fallback: bool = False,
          evidence: tuple[str, ...] = ("F12",)) -> dict:
    return {
        "value": value, "fallback": fallback, "evidence": list(evidence),
        "reason": "", "polarity": {}, "gate_failures": [], "retried": False,
    }


def _axes(risk: float = 0.5, sc: float = 0.5, pl: float = 0.5, **kw) -> dict:
    return {
        "risk_tolerance": _axis(risk, **kw),
        "self_control": _axis(sc, **kw),
        "planning": _axis(pl, **kw),
        "time_preference": _axis(0.5, **kw),
    }


FRESH = {"stale": False, "new_txns": 0, "threshold": 5}
STALE = {"stale": True, "new_txns": 9, "threshold": 5}


def _fact(fid: str, value: float | None, n: int = 10) -> Fact:
    return Fact(id=fid, label=fid, value=value,
                display=str(value), band="", definition="", n=n)


def _sheet(**overrides) -> list[Fact]:
    values = {"F01": 0.8, "F02": 0.5, "F03": 30.0, "F04": 45.0,
              "F09": 0.1, "F12": 50000.0, "F13": 3.0, "F14": 5.0}
    values.update(overrides)
    return [_fact(fid, val) for fid, val in values.items()]


def _gig() -> GigProfile:
    return GigProfile(
        volatility="고변동", volatility_cv=1.64,
        concentration="소수 집중", top_source_share=0.6,
        rhythm="플랫폼 정기형", is_multi_gig=False,
        phase="성장기", archetype="테스트형 긱워커",
    )


def _build(axes=None, staleness=None, events=None, sheet=None):
    return v2.build_personalization_v2(
        factsheet=sheet or _sheet(), gig=_gig(),
        snapshot_axes=axes, staleness=staleness, events=events or [],
    )


def _decision(p: v2.PersonalizationV2, key: str) -> v2.V2Decision:
    return next(d for d in p.financial_response if d.key == key)


# ── 안전자금 운용 방향: 3버킷 매핑 (골든셋 채점과 동일 경계) ──

def test_safety_buckets_map_all_menu_values():
    expect = {0.1: "확보 우선", 0.3: "확보 우선", 0.5: "균형",
              0.7: "활용 우선", 0.9: "활용 우선"}
    for value, level in expect.items():
        d = _decision(_build(axes=_axes(risk=value), staleness=FRESH), v2.SAFETY_KEY)
        assert d.level == level, f"risk={value}"
        assert d.decision_status == v2.CONFIRMED


def test_safety_insufficient_when_fallback_stale_or_missing():
    cases = [
        (_axes(risk=0.1, fallback=True), FRESH, "failed"),   # 게이트 폴백
        (_axes(risk=0.1), STALE, "passed"),                  # 판독은 됐지만 낡음
        (None, None, "not_read"),                            # 판독 자체가 없음
    ]
    for axes, staleness, gate in cases:
        d = _decision(_build(axes=axes, staleness=staleness), v2.SAFETY_KEY)
        assert d.decision_status == v2.INSUFFICIENT
        assert d.level == "균형"          # 보류의 안전 기본값 — 지어내지 않음
        assert d.evidence["gate"] == gate


def test_goal_pacing_maps_time_preference_without_touching_protected_money():
    expect = {0.1: "현재 우선", 0.3: "현재 우선", 0.5: "균형",
              0.7: "미래 우선", 0.9: "미래 우선"}
    for value, level in expect.items():
        axes = _axes()
        axes["time_preference"] = _axis(value, evidence=("F06", "F12"))
        d = _decision(_build(axes=axes, staleness=FRESH), v2.PACING_KEY)
        assert d.level == level
        assert d.source_axes == ("time_preference",)
        assert "목표 기한과 사용 가능 금액" in d.basis


# ── 권장 관리 강도: 규칙표 전조합 + 방향 원칙 ──

def test_management_rule_table_all_combinations():
    b2v = {"low": 0.1, "neutral": 0.5, "high": 0.9}
    for (sc_b, pl_b), level in v2._MANAGEMENT_TABLE.items():
        d = _decision(
            _build(axes=_axes(sc=b2v[sc_b], pl=b2v[pl_b]), staleness=FRESH),
            v2.MANAGEMENT_KEY,
        )
        assert d.level == level, f"({sc_b},{pl_b})"
    # 방향 원칙: 자기관리 약함 → 개입 강함
    assert v2._MANAGEMENT_TABLE[("low", "low")] == "적극 관리"
    assert v2._MANAGEMENT_TABLE[("high", "high")] == "자율"


def test_management_insufficient_when_either_axis_fallback():
    axes = _axes(sc=0.9, pl=0.9)
    axes["planning"] = _axis(0.9, fallback=True)
    d = _decision(_build(axes=axes, staleness=FRESH), v2.MANAGEMENT_KEY)
    assert d.decision_status == v2.INSUFFICIENT
    assert d.level == v2.MANAGEMENT_DEFAULT


# ── 불가침: 번역층 재가중 없음 · F14 레거시 차단 · confidence 부재 ──

def test_data_quality_display_never_reweights_existing_axes():
    base = _decision(
        _build(axes=_axes(sc=0.9, pl=0.9), staleness=FRESH, sheet=_sheet()),
        v2.MANAGEMENT_KEY,
    )
    varied = _decision(
        _build(axes=_axes(sc=0.9, pl=0.9), staleness=FRESH,
               sheet=_sheet(F13=None, F14=0.0)),
        v2.MANAGEMENT_KEY,
    )
    assert base.level == varied.level == "자율"
    assert varied.evidence["data_quality"] == {
        "career_sources": None, "engagement_weeks": 0.0,
    }


def test_f13_is_allowed_but_legacy_f14_any_axis_forces_reread():
    """F13은 긱 행동으로 유지하고, 어느 축이든 F14를 쓴 과거 판독은 확정 번역하지 않는다."""
    f13_axes = _axes(sc=0.9, pl=0.9)
    f13_axes["planning"] = _axis(0.9, evidence=("F13",))
    f13 = _decision(_build(axes=f13_axes, staleness=FRESH), v2.MANAGEMENT_KEY)
    assert f13.level == "자율" and f13.decision_status == v2.CONFIRMED

    legacy_axes = _axes(sc=0.9, pl=0.9)
    legacy_axes["planning"] = _axis(0.9, evidence=("F13", "F14"))
    legacy = _decision(_build(axes=legacy_axes, staleness=FRESH), v2.MANAGEMENT_KEY)
    assert legacy.level == v2.MANAGEMENT_DEFAULT
    assert legacy.decision_status == v2.INSUFFICIENT
    assert "재판독" in legacy.basis

    legacy_self = _axes(sc=0.9, pl=0.9)
    legacy_self["self_control"] = _axis(0.9, evidence=("F06", "F14"))
    legacy_mgmt = _decision(_build(axes=legacy_self, staleness=FRESH), v2.MANAGEMENT_KEY)
    assert legacy_mgmt.decision_status == v2.INSUFFICIENT

    legacy_risk = _axes(risk=0.1)
    legacy_risk["risk_tolerance"] = _axis(0.1, evidence=("F12", "F14"))
    legacy_safety = _decision(_build(axes=legacy_risk, staleness=FRESH), v2.SAFETY_KEY)
    assert legacy_safety.decision_status == v2.INSUFFICIENT


def test_evidence_carries_facts_only_no_confidence():
    d = _decision(_build(axes=_axes(risk=0.1), staleness=FRESH), v2.SAFETY_KEY)
    assert set(d.evidence) == {"fact_ids", "sample_size", "gate",
                               "fallback_used", "stale"}
    assert d.evidence["fact_ids"] == ["F12"]
    assert d.evidence["sample_size"] == 10   # 인용 팩트 중 최소 표본
    assert "confidence" not in d.as_dict()["evidence"]


# ── 긱 구조: 검증된 라벨 그대로 (새 어휘 없음) ──

def test_gig_structure_reuses_gig_profile_labels_verbatim():
    p = _build()
    by_key = {s.key: s for s in p.gig_structure}
    assert by_key[v2.STABILITY_KEY].level == "고변동"
    # 근거 줄은 판정 신호(F01 금액 출렁임)를 앞세우고 공백(F04)은 보조로 붙는다
    assert "금액 출렁임" in by_key[v2.STABILITY_KEY].detail
    assert "수입 공백" in by_key[v2.STABILITY_KEY].detail
    assert by_key[v2.STRUCTURE_KEY].level == "소수 집중"
    assert "플랫폼 정산" in by_key[v2.STRUCTURE_KEY].detail


# ── 오버라이드: 별도 보관 · 최신 우선 · 권장 불변 ──

def test_override_wins_but_recommendation_survives():
    events = [{"type": v2.OVERRIDE_EVENT, "payload": {"level": "자율"}}]
    p = _build(axes=_axes(sc=0.1, pl=0.1), staleness=FRESH, events=events)
    assert _decision(p, v2.MANAGEMENT_KEY).level == "적극 관리"  # 권장은 그대로
    assert p.management_override == "자율"
    assert p.effective_management == "자율"                     # 선택이 이긴다


def test_override_latest_wins_and_invalid_clears():
    events = [
        {"type": v2.OVERRIDE_EVENT, "payload": {"level": "자율"}},
        {"type": v2.OVERRIDE_EVENT, "payload": {"level": None}},
    ]
    p = _build(events=events)
    assert p.management_override is None
    assert p.effective_management == v2.MANAGEMENT_DEFAULT


# ── 기존 소비 계약 불변: 배분은 v2를 모른다 ──

def test_allocation_context_independent_of_v2():
    profile = build_user_profile()
    stripped = dataclasses.replace(profile, personalization_v2=None)
    assert profile.allocation_context() == stripped.allocation_context()


# ── 라우트: 항상 조회 가능 · 오버라이드 422 게이트 ──

def test_route_v2_available_even_without_persona_read():
    res = client.get("/v1/profile/v2")
    assert res.status_code == 200
    body = res.json()
    assert {d["key"] for d in body["financial_response"]} == {
        v2.SAFETY_KEY, v2.MANAGEMENT_KEY, v2.PACING_KEY,
    }
    assert all(d["decision_status"] == v2.INSUFFICIENT
               for d in body["financial_response"])   # 판독 전 — 보류를 정직하게


def test_route_override_validates_and_persists():
    assert client.post("/v1/profile/v2/management-override",
                       json={"level": "아무거나"}).status_code == 422
    res = client.post("/v1/profile/v2/management-override", json={"level": "가이드"})
    assert res.status_code == 200
    assert res.json()["management_override"] == "가이드"
    assert any(e["type"] == v2.OVERRIDE_EVENT for e in db.list_events())
