"""V2 개인화 계약 — 검증된 측정·판독 위의 결정론 번역층 (새 AI 판정 없음).

발표·화면의 2+2 모델을 제품 계약으로 노출한다:
- 긱 구조 2 (항상 결정론): 소득 안정성 · 소득원 구조 — gig_profile 재표현
- 금융 대응 2 (기존 4축 번역): 안전자금 운용 방향(risk_tolerance) ·
  권장 관리 강도(self_control + planning 규칙표)

불가침 — 이 파일이 지키는 계약:
- 새 EXAONE 프롬프트·판정을 만들지 않는다. 기존 스냅샷 축의 결정론 번역만 한다.
- confidence 숫자를 만들지 않는다. 사실만 노출한다(인용 팩트·표본·게이트·폴백·신선도).
- F13/F14(커리어 소스·앱 참여)는 방향을 결정하지 않는다 — 데이터 충실도 표시에만 쓴다.
  (관여도는 관리가 필요한 성향이 아니고, planning 판독에 이미 반영돼 이중 가중 위험.)
- 배분·밴딧은 계속 raw 연속 축을 소비한다. 여기의 3단계 값은 화면·설명·코치 톤 전용.
- '권장'이지 '선호'가 아니다 — 관측 행동 기반 권장 개입 수준이며, 사용자 오버라이드는
  별도 보관하고 권장값을 덮어쓰지 않는다. 실행 승인 게이트(HITL)에는 어떤 영향도 없다.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from app.engines.facts import Fact
from app.engines.gig_profile import GigProfile

# 골든셋 eval(run_persona_eval)과 동일한 3버킷 경계 — 검증된 채점 기준을 그대로 재사용한다.
BUCKET_LOW = 0.3
BUCKET_HIGH = 0.7

CONFIRMED = "confirmed"
INSUFFICIENT = "insufficient_evidence"

SAFETY_KEY = "safety_fund_strategy"
SAFETY_LABEL = "안전자금 운용 방향"
_SAFETY_BY_BUCKET = {"low": "확보 우선", "neutral": "균형", "high": "활용 우선"}

MANAGEMENT_KEY = "management_support"
MANAGEMENT_LABEL = "권장 관리 강도"
MANAGEMENT_LEVELS = ("자율", "가이드", "적극 관리")
MANAGEMENT_DEFAULT = "가이드"          # 근거 부족 시 안전 기본값 — 화면은 '판단 보류'를 함께 표시
OVERRIDE_EVENT = "management_support_override"

# 권장 관리 강도 규칙표 — (self_control 버킷, planning 버킷) 전조합 명시.
# 방향 원칙(불가침): 관측된 자기관리가 약할수록 개입을 높인다 (자기통제↓ → 개입↑).
_MANAGEMENT_TABLE: dict[tuple[str, str], str] = {
    ("low", "low"): "적극 관리",
    ("low", "neutral"): "적극 관리",
    ("neutral", "low"): "적극 관리",
    ("low", "high"): "가이드",
    ("high", "low"): "가이드",
    ("neutral", "neutral"): "가이드",
    ("neutral", "high"): "가이드",
    ("high", "neutral"): "가이드",
    ("high", "high"): "자율",
}

STABILITY_KEY = "income_stability"
STABILITY_LABEL = "소득 안정성"
STRUCTURE_KEY = "income_source_structure"
STRUCTURE_LABEL = "소득원 구조"


def _bucket(value: float) -> str:
    if value <= BUCKET_LOW:
        return "low"
    if value >= BUCKET_HIGH:
        return "high"
    return "neutral"


@dataclass(frozen=True)
class V2Structure:
    """긱 구조 축 1개 — 원장에서 잰 사실의 재표현 (판독 불필요, 항상 존재)."""

    key: str
    label: str
    level: str             # gig_profile의 검증된 라벨 그대로 (새 어휘를 만들지 않는다)
    detail: str            # 사람이 읽는 부연 한 줄
    fact_ids: tuple[str, ...]

    def as_dict(self) -> dict:
        return {
            "key": self.key, "label": self.label, "level": self.level,
            "detail": self.detail, "fact_ids": list(self.fact_ids),
        }


@dataclass(frozen=True)
class V2Decision:
    """금융 대응 축 1개 — 기존 축 판독의 결정론 번역. 점수 없이 사실만 싣는다."""

    key: str
    label: str
    level: str                     # 보류여도 안전 기본값을 유지한다 (소비자 단순화)
    decision_status: str           # confirmed | insufficient_evidence
    source_axes: tuple[str, ...]   # 어느 축에서 번역됐나 (감사)
    evidence: dict                 # fact_ids · sample_size · gate · fallback_used · stale
    basis: str                     # 번역 근거 한 줄 (규칙표·버킷 — 사람이 검산 가능)

    def as_dict(self) -> dict:
        return {
            "key": self.key, "label": self.label, "level": self.level,
            "decision_status": self.decision_status,
            "source_axes": list(self.source_axes),
            "evidence": self.evidence, "basis": self.basis,
        }


@dataclass(frozen=True)
class PersonalizationV2:
    """제품이 소비하는 2+2 계약 — 긱 구조(측정) + 금융 대응(번역) + 사용자 오버라이드."""

    gig_structure: tuple[V2Structure, ...]
    financial_response: tuple[V2Decision, ...]
    management_override: str | None    # 사용자가 직접 고른 관리 강도 (권장과 별도 보관)

    @property
    def effective_management(self) -> str:
        """코치가 실제로 따를 관리 강도 — 사용자 선택이 항상 권장을 이긴다."""
        if self.management_override:
            return self.management_override
        for d in self.financial_response:
            if d.key == MANAGEMENT_KEY:
                return d.level
        return MANAGEMENT_DEFAULT

    def as_dict(self) -> dict:
        return {
            "gig_structure": [s.as_dict() for s in self.gig_structure],
            "financial_response": [d.as_dict() for d in self.financial_response],
            "management_override": self.management_override,
            "effective_management": self.effective_management,
        }


def _fact_map(factsheet: Sequence[Fact]) -> dict[str, Fact]:
    return {f.id: f for f in factsheet}


def _axis_fresh(axis: dict | None, staleness: dict | None) -> bool:
    """이 축 판독을 번역 근거로 쓸 수 있나 — PR #80의 신선도 게이트와 같은 규칙.

    스냅샷이 없거나(stale=None 포함) 오래됐거나 그 축이 폴백이면 False.
    """
    if not axis or axis.get("fallback"):
        return False
    if not staleness or staleness.get("stale") is not False:
        return False
    return isinstance(axis.get("value"), (int, float))


def _evidence(axes: list[dict | None], staleness: dict | None,
              facts: dict[str, Fact]) -> dict:
    """근거 메타데이터 — 확률처럼 보이는 점수 없이 사실만.

    sample_size는 인용 팩트 중 최소 표본(약한 고리 기준 — 보수적).
    """
    fact_ids: list[str] = []
    fallback_used = False
    read = False
    for a in axes:
        if a is None:
            continue
        read = True
        fallback_used = fallback_used or bool(a.get("fallback"))
        for fid in a.get("evidence", []):
            if fid not in fact_ids:
                fact_ids.append(fid)
    ns = [facts[fid].n for fid in fact_ids if fid in facts]
    return {
        "fact_ids": fact_ids,
        "sample_size": min(ns) if ns else None,
        "gate": ("passed" if read and not fallback_used
                 else "failed" if read else "not_read"),
        "fallback_used": fallback_used,
        "stale": staleness.get("stale") if staleness else None,
    }


def _safety(axes: dict | None, staleness: dict | None,
            facts: dict[str, Fact]) -> V2Decision:
    """안전자금 운용 방향 ← risk_tolerance 3버킷 (낮은 위험감내 = 확보 우선)."""
    axis = (axes or {}).get("risk_tolerance")
    if _axis_fresh(axis, staleness):
        bucket = _bucket(float(axis["value"]))
        return V2Decision(
            key=SAFETY_KEY, label=SAFETY_LABEL,
            level=_SAFETY_BY_BUCKET[bucket], decision_status=CONFIRMED,
            source_axes=("risk_tolerance",),
            evidence=_evidence([axis], staleness, facts),
            basis=f"위험감내 {axis['value']} → {bucket} 버킷 (골든셋 채점과 동일 경계 0.3/0.7)",
        )
    return V2Decision(
        key=SAFETY_KEY, label=SAFETY_LABEL,
        level=_SAFETY_BY_BUCKET["neutral"], decision_status=INSUFFICIENT,
        source_axes=("risk_tolerance",),
        evidence=_evidence([axis], staleness, facts),
        basis="판독이 없거나 오래됐거나 게이트 미통과 — 중립 기본값 유지 (지어내지 않음)",
    )


def _management(axes: dict | None, staleness: dict | None,
                facts: dict[str, Fact]) -> V2Decision:
    """권장 관리 강도 ← self_control + planning 규칙표.

    F13/F14는 방향에 불개입 — 데이터 충실도로만 evidence에 병기한다.
    """
    sc = (axes or {}).get("self_control")
    pl = (axes or {}).get("planning")
    evidence = _evidence([sc, pl], staleness, facts)
    f13, f14 = facts.get("F13"), facts.get("F14")
    evidence["data_quality"] = {   # 표시용 사실 — level 결정에 쓰지 않는다
        "career_sources": f13.value if f13 else None,
        "engagement_weeks": f14.value if f14 else None,
    }
    if _axis_fresh(sc, staleness) and _axis_fresh(pl, staleness):
        buckets = (_bucket(float(sc["value"])), _bucket(float(pl["value"])))
        return V2Decision(
            key=MANAGEMENT_KEY, label=MANAGEMENT_LABEL,
            level=_MANAGEMENT_TABLE[buckets], decision_status=CONFIRMED,
            source_axes=("self_control", "planning"),
            evidence=evidence,
            basis=f"자기통제 {buckets[0]} × 계획성 {buckets[1]} → 규칙표 (개입은 관측된 자기관리의 역방향)",
        )
    return V2Decision(
        key=MANAGEMENT_KEY, label=MANAGEMENT_LABEL,
        level=MANAGEMENT_DEFAULT, decision_status=INSUFFICIENT,
        source_axes=("self_control", "planning"),
        evidence=evidence,
        basis="판독이 없거나 오래됐거나 게이트 미통과 — 기본 가이드 유지 (지어내지 않음)",
    )


def _structures(gig: GigProfile, facts: dict[str, Fact]) -> tuple[V2Structure, ...]:
    """긱 구조 2축 — gig_profile의 검증된 라벨을 그대로 노출한다 (재계산·재해석 없음)."""
    f01, f04 = facts.get("F01"), facts.get("F04")
    stability_detail = " · ".join(
        p for p in (
            f"변동 {f01.display}" if f01 and f01.value is not None else "",
            f"최장 공백 {f04.display}" if f04 and f04.value is not None else "",
        ) if p
    ) or "관측 부족"
    structure_detail = f"{gig.rhythm}" + (" · N잡" if gig.is_multi_gig else "")
    return (
        V2Structure(
            key=STABILITY_KEY, label=STABILITY_LABEL,
            level=gig.volatility, detail=stability_detail,
            fact_ids=("F01", "F03", "F04"),
        ),
        V2Structure(
            key=STRUCTURE_KEY, label=STRUCTURE_LABEL,
            level=gig.concentration, detail=structure_detail,
            fact_ids=("F02",),
        ),
    )


def latest_management_override(events: list[dict]) -> str | None:
    """사용자가 마지막으로 고른 관리 강도 — 최신 이벤트가 결정하고, 무효 값은 해제로 본다."""
    for e in reversed(events):
        if e["type"] == OVERRIDE_EVENT:
            level = (e.get("payload") or {}).get("level")
            return level if level in MANAGEMENT_LEVELS else None
    return None


def build_personalization_v2(
    factsheet: Sequence[Fact],
    gig: GigProfile,
    snapshot_axes: dict | None,
    staleness: dict | None,
    events: list[dict],
) -> PersonalizationV2:
    """2+2 계약 조립 — 전부 결정론. 같은 입력이면 언제나 같은 출력이다."""
    facts = _fact_map(factsheet)
    return PersonalizationV2(
        gig_structure=_structures(gig, facts),
        financial_response=(
            _safety(snapshot_axes, staleness, facts),
            _management(snapshot_axes, staleness, facts),
        ),
        management_override=latest_management_override(events),
    )
