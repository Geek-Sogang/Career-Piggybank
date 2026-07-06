"""에이전트 계약 — 멀티에이전트 문법을 코드로 강제한다.

문법 세 줄 (헌법):
- **역할 분리**: 에이전트마다 하나의 일. specialty는 단문 하나 — 두 가지 일을 하면 둘로 쪼갠다.
- **오케스트레이션**: 흐름은 코드가 제어(조건 분기). 에이전트끼리 직접 대화(A2A) 금지 —
  누가 언제 불리는지는 orchestration 코드에 적혀 있다(감사 가능).
- **가드레일**: 위험한 판단은 AI가 '판정만', 실행은 사람. 모든 에이전트는 guardrails ≥ 1개와
  결정론 fallback을 반드시 선언한다 — 없으면 생성 자체가 실패한다.

이 파일은 '무엇이 에이전트인가'의 단일 정의다. 새 에이전트는 registry에 선언부터 한다.
"""
from __future__ import annotations

from dataclasses import dataclass, field


class AgentContractError(ValueError):
    """계약 위반 — 로스터에 선언될 수 없는 에이전트."""


@dataclass(frozen=True)
class AgentSpec:
    """에이전트 1종의 선언 — 판정만 하고 실행하지 않는다.

    필드가 곧 문법이다: specialty(역할 하나) · guardrails(최소 1) · fallback(결정론 착지 필수).
    """

    id: str                      # 코드 식별자 (예: "profile_read")
    label: str                   # 한국어 이름 (예: "프로필 판독")
    specialty: str               # 딱 한 가지 일 — 단문 하나 (역할 분리)
    output: str                  # 무엇을 '판정'해 내놓나 (실행 아님)
    model: str                   # "EXAONE 7.8B" / "EXAONE 2.4B ×3 + 판정" / "룰(현재) → LLM 승격"
    cadence: str                 # 호출 주기 — 오케스트레이션 코드가 언제 부르나
    guardrails: tuple[str, ...]  # 최소 1개 (가드레일)
    fallback: str                # 실패 시 결정론 착지 — 필수
    module: str                  # 구현 위치 (예정이면 태어날 자리)
    implemented: bool            # 정직 표기 — 예정을 구현으로 부풀리지 않는다
    pr: str | None = None        # 예정이면 담당 PR 라벨
    is_mouth: bool = False       # 사용자에게 닿는 유일한 입(피기 발화)인가
    notes: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if not self.specialty.strip():
            raise AgentContractError(f"{self.id}: specialty 없음 — 역할 분리 위반")
        # 역할 하나 = 단문 하나. 문장 구분자가 들어가면 두 가지 일을 하고 있다는 신호.
        if any(sep in self.specialty for sep in (". ", "\n")):
            raise AgentContractError(f"{self.id}: specialty가 여러 문장 — 에이전트를 쪼갤 것")
        if not self.guardrails:
            raise AgentContractError(f"{self.id}: guardrails 없음 — 가드레일 위반")
        if not self.fallback.strip():
            raise AgentContractError(f"{self.id}: fallback 없음 — 결정론 착지 필수")

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "specialty": self.specialty,
            "output": self.output,
            "model": self.model,
            "cadence": self.cadence,
            "guardrails": list(self.guardrails),
            "fallback": self.fallback,
            "module": self.module,
            "implemented": self.implemented,
            "pr": self.pr,
            "is_mouth": self.is_mouth,
            "notes": list(self.notes),
        }


GRAMMAR = {
    "role_separation": "에이전트마다 하나의 일 — 분류와 판정을 따로, 추천(집합)과 페이싱(금액)을 따로",
    "orchestration": "흐름은 코드가 제어(조건 분기) — 에이전트 간 직접 대화(A2A) 금지, 호출 순서는 orchestration 코드에 명시",
    "guardrail": "위험한 판단은 AI가 판정만, 실행은 사람 — 모든 에이전트는 가드레일·결정론 폴백 필수",
}
