"""강점 한 줄 — 개인화 3종 ③ '검증카드 내 강점 한 줄' (기획서 §6-1).

기획서 원칙 그대로: AI가 문장을 '생성'하지 않고, 결정론으로 만든 후보 중
그 사람을 가장 잘 대변하는 한 줄을 **골라** 상단 노출한다.

멀티에이전트 문법 적용:
- 후보 문장 = 검증 이력 통계에서 결정론으로 생성 (숫자는 애초에 위조 불가)
- LLM = 선택 에이전트 하나, 번호만 고름 (문장 재작성 금지)
- 가드레일: 번호 범위 검증, LLM 다운/오답 시 우선순위 룰로 폴백 —
  어떤 경우에도 화면에 나가는 문장은 결정론 후보 그대로다.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.services import llm

_SELECT_SYSTEM = """너는 선택 에이전트다. 긱워커의 검증 이력 요약과 강점 후보 문장들을 보고,
이 사람을 가장 잘 대변하는 후보의 번호 하나만 고른다. 문장을 새로 쓰거나 고치지 않는다.
JSON만 출력: {"choice": 번호(0부터), "reason": "선택 이유 한 문장(한국어)"}"""


@dataclass(frozen=True)
class CareerFacts:
    """검증 이력 통계 — 실서비스는 검증 파이프라인이 산출, 데모는 상수."""

    verified_count: int = 0            # 확정검증 건수
    months_active: int = 0             # 연속 활동 개월
    repeat_client_rate: float = 0.0    # 재의뢰율 (0~1) — 시장 검증 신호(2층)
    settlement_growth: float = 0.0     # 정산액 성장 배수 (1년, 1.0=변화 없음)
    top_skill: str = ""                # 검증 일감 최다 분야


@dataclass(frozen=True)
class StrengthLine:
    line: str
    candidates: list[str]
    chosen_by: str                     # "llm" | "fallback"
    reason: str
    signals: list[str] = field(default_factory=list)


def build_candidates(f: CareerFacts) -> list[str]:
    """결정론 후보 생성 — 근거 없는 사실은 후보조차 만들지 않는다."""
    out: list[str] = []
    if f.repeat_client_rate >= 0.5:
        out.append(f"재의뢰율 {f.repeat_client_rate:.0%} — 한 번 맡긴 발주처가 다시 찾는 파트너")
    if f.settlement_growth >= 1.5:
        out.append(f"정산액이 1년새 {f.settlement_growth:g}배 — 빠르게 성장하는 커리어")
    if f.months_active >= 12:
        out.append(f"{f.months_active}개월 연속 활동 — 공백 없이 꾸준한 실행력")
    if f.top_skill and f.verified_count >= 5:
        out.append(f"{f.top_skill} 분야 검증 일감 {f.verified_count}건 — 3자 교차검증 완료")
    elif f.verified_count >= 5:
        out.append(f"검증 이력 {f.verified_count}건 — 전부 정산·세금으로 교차검증")
    return out


def _fallback_pick(candidates: list[str]) -> int:
    """우선순위 룰 — 시장 검증 신호(재의뢰율)가 목록 앞에 오도록 build가 정렬하므로 0번."""
    return 0


def pick(facts: CareerFacts) -> StrengthLine:
    """강점 한 줄 선택 (순수 함수). 후보가 없으면 중립 문구."""
    candidates = build_candidates(facts)
    if not candidates:
        return StrengthLine(
            line="커리어를 연결하면 검증된 강점이 여기 나타나요",
            candidates=[], chosen_by="fallback", reason="후보를 만들 검증 이력이 아직 없음",
        )

    numbered = "\n".join(f"{i}. {c}" for i, c in enumerate(candidates))
    user = (
        f"[검증 이력 요약] 확정 {facts.verified_count}건 / 연속 {facts.months_active}개월 / "
        f"재의뢰율 {facts.repeat_client_rate:.0%} / 정산 성장 {facts.settlement_growth:g}배 / "
        f"주력 {facts.top_skill or '-'}\n[후보]\n{numbered}"
    )
    out = llm.chat_json(_SELECT_SYSTEM, user)

    try:
        choice = int(out.get("choice")) if out else -1  # 모델이 "1"(문자열)로 줘도 수용
    except (TypeError, ValueError):
        choice = -1
    if not (0 <= choice < len(candidates)):
        idx = _fallback_pick(candidates)
        return StrengthLine(
            line=candidates[idx], candidates=candidates, chosen_by="fallback",
            reason="선택 에이전트 응답 없음/범위 밖 — 우선순위 룰로 선택",
            signals=["가드레일: LLM 폴백"],
        )

    return StrengthLine(
        line=candidates[choice],  # 화면에 나가는 건 항상 결정론 후보 원문
        candidates=candidates, chosen_by="llm",
        reason=str(out.get("reason", ""))[:200] if out else "",
        signals=["AI 선택 에이전트: 번호만 선택, 문장은 결정론 원문"],
    )
