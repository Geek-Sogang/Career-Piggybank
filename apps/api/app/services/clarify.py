"""확인 질문 에이전트 — 분류가 확신 없을 때 '해소에 필요한 단 하나의 질문'을 만든다 (§6-2⑥).

코치는 확인 게이트다: 시스템이 모르면 "확인해주세요"가 아니라 **답하기 쉬운 구체 질문**으로
먼저 말을 건다. 답변(탭)은 기존 수기 태그 API로 흘러가 사전 학습·배분 트리거까지 이어진다.

멀티에이전트 문법:
- **역할 분리**: 이 에이전트는 질문 문장만 만든다 — 분류·배분·실행은 남의 일.
- **오케스트레이션**: 코드가 needs_review 입금에만 호출하고, **선택지는 코드가 정한다**
  (LLM은 답변 경로를 만들 수 없다 — 탭 한 번이 곧 수기 태그).
- **가드레일**: 질문 속 숫자는 거래 컨텍스트 대조(코치와 같은 숫자검증기),
  길이 상한, LLM 다운/검증 실패 시 결정론 템플릿 폴백.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.services import llm
from app.services.coach import _numbers_grounded

MAX_QUESTION_CHARS = 80

_SYSTEM = """너는 긱워커 가계부의 확인 질문 에이전트다. 질문 한 문장만 만든다 — 분류·조언·설명은 네 일이 아니다.
입금 정보와 AI 판단 근거를 보고, 사용자가 한 번의 탭으로 답할 수 있는 확인 질문을 한국어 존댓말로 만든다.
JSON만 출력한다: {"question": "질문 한 문장"}
규칙:
- 60자 이내, 물음표로 끝난다.
- 금액·상대명은 주어진 것만 그대로 인용한다. 새 숫자를 만들지 마라.
- "일감 대금인지"를 확인하는 방향으로 묻는다 — 단정하지 마라.
예시: {"question": "김하늘님이 보낸 150,000원, 진행 중인 일의 대금인가요?"}"""


@dataclass(frozen=True)
class ClarifyQuestion:
    question: str
    options: list[dict] = field(default_factory=list)  # {kind, label} — 코드가 정한 답변 경로
    source: str = "fallback"                           # "llm" | "fallback"


def _options() -> list[dict]:
    """답변 선택지 — 결정론. 탭 = 수기 태그(POST /transactions/{id}/tag)와 1:1."""
    return [
        {"kind": "income", "label": "일감 대금이에요"},
        {"kind": "living", "label": "개인 돈이에요"},
        {"kind": "expense", "label": "경비 환급이에요"},
    ]


def _fallback_question(amount: float, counterparty: str) -> str:
    return f"{counterparty}에서 온 {amount:,.0f}원 — 일감 대금인가요, 개인 간 돈인가요?"


def make_question(
    amount: float, counterparty: str, memo: str, signals: list[str],
) -> ClarifyQuestion:
    """needs_review 입금 1건 → 해소 질문 (순수 함수). LLM 실패·검증 실패 시 결정론 폴백."""
    context = (
        f"입금 {amount:,.0f}원 / 상대: {counterparty}"
        + (f" / 메모: {memo}" if memo else "")
        + "\nAI 판단 근거:\n" + "\n".join(f"- {s}" for s in signals[:5])
    )
    options = _options()

    out = llm.chat_json(_SYSTEM, context)
    q = str(out.get("question", "")).strip() if out else ""
    if (
        q
        and q.endswith("?")
        and len(q) <= MAX_QUESTION_CHARS
        and _numbers_grounded(q, context)  # 가드레일: 지어낸 숫자가 있으면 폐기
    ):
        return ClarifyQuestion(question=q, options=options, source="llm")

    return ClarifyQuestion(
        question=_fallback_question(amount, counterparty), options=options, source="fallback",
    )
