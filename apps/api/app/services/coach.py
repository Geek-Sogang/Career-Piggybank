"""피기 코치 — 로컬 LLM이 결정론 엔진의 결과를 '말'로 전달한다.

멀티에이전트 문법 적용:
- **역할 분리**: 코치는 말만 한다. 분류·예측·배분·실행은 각자의 엔진 몫.
- **가드레일 — 숫자 계산 절대 금지**: 모든 금액은 결정론 엔진이 계산해 [컨텍스트]로 주입되고,
  코치는 그 숫자만 그대로 인용한다. 응답의 숫자가 컨텍스트에 없으면(지어냈으면)
  **결정론 숫자 검증기**가 걸러내고 템플릿 폴백으로 교체한다 — 할루시네이션 금액이
  사용자에게 닿는 경로를 차단.
- LLM 다운 시에도 근거(reasons)로 만든 결정론 답변을 준다 — 코치가 죽어도 서비스는 산다.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from app.services import llm

_SYSTEM = """너는 '피기' — Career Piggybank(커리어 저금통)의 돼지 마스코트 코치다. 긱워커의 돈 관리를 돕는다.
규칙:
- 한국어 존댓말, 2~4문장으로 짧고 따뜻하게. 이모지는 최대 1개.
- 숫자는 [컨텍스트]에 있는 것만 그대로 인용한다. 절대 새로 계산하거나 지어내지 않는다.
- 배분·투자의 실행 결정은 항상 사용자 몫 — 단정하지 말고 "~할까요?" 톤으로 확인을 구한다.
- 특정 종목 추천, 수익 보장, 세무·법률 단정은 금지. 깊은 세무 상담은 전문가를 권한다."""

_NUM_TOKEN = re.compile(r"\d[\d,.]*")
_SMALL_NUM_OK = 2  # 두 자리 이하 숫자(개월·나이·% 등 단위 수)는 검증 면제


@dataclass(frozen=True)
class CoachReply:
    reply: str
    source: str                 # "llm" | "fallback"
    verified: bool              # 숫자 검증 통과 여부 (fallback은 항상 True — 결정론이므로)
    signals: list[str] = field(default_factory=list)


def _digit_tokens(text: str) -> list[str]:
    return [re.sub(r"[,.]", "", t) for t in _NUM_TOKEN.findall(text)]


def _numbers_grounded(reply: str, context_text: str) -> bool:
    """응답의 모든 (3자리 이상) 숫자가 컨텍스트 숫자의 부분열인지 결정론 검증."""
    ctx_tokens = _digit_tokens(context_text)
    for token in _digit_tokens(reply):
        if len(token) <= _SMALL_NUM_OK:
            continue
        if not any(token in ctx for ctx in ctx_tokens):
            return False
    return True


def _fallback_reply(context: dict | None) -> str:
    """LLM 없이 근거(reasons/signals)로 만드는 결정론 답변."""
    reasons = []
    if context:
        reasons = context.get("reasons") or context.get("signals") or []
    if reasons:
        lines = "\n".join(f"· {r}" for r in reasons[:5])
        return f"제안 근거를 그대로 전해드릴게요.\n{lines}\n이대로 반영할까요?"
    return "지금은 코치 연결이 원활하지 않아요. 제안 내용은 화면의 근거를 확인해 주세요."


def chat(message: str, context: dict | None = None) -> CoachReply:
    """사용자 메시지 + 결정론 엔진 컨텍스트 → 코치 답변 (순수 함수)."""
    context_text = json.dumps(context, ensure_ascii=False) if context else "(없음)"
    user = f"[컨텍스트]\n{context_text}\n\n[사용자 메시지]\n{message}"

    reply = llm.chat_text(_SYSTEM, user)
    if reply is None:
        return CoachReply(
            reply=_fallback_reply(context), source="fallback", verified=True,
            signals=["로컬 LLM 응답 없음 → 결정론 폴백"],
        )

    if not _numbers_grounded(reply, context_text):
        return CoachReply(
            reply=_fallback_reply(context), source="fallback", verified=False,
            signals=["숫자 검증 실패 — 컨텍스트에 없는 숫자를 지어냄 → 결정론 폴백으로 교체"],
        )

    return CoachReply(reply=reply, source="llm", verified=True, signals=["숫자 검증 통과"])
