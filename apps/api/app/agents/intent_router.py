"""⑧ 인텐트 라우터 — 사용자 발화를 어느 처리기로 보낼지 분기한다 (분기만, 실행은 사람).

역할 하나: "이 말이 무엇을 원하는가"의 라벨 하나. 처리(파서·조정·태그·매칭)는 각
엔진의 몫이고, 라우팅된 처리도 전부 사람 승인 게이트를 거친다.

분류기 캐스케이드 패턴 그대로(§6-2① 문법):
- 1층 = 룰 — 명백한 신호(키워드·숫자 패턴)는 결정론으로 즉답 (0ms, 감사 가능).
- 2층 = EXAONE 2.4B — 룰이 못 가른 발화만. **메뉴 게이트**: 인텐트 enum 밖 라벨은 폐기.
- 폴백 = qa — 어디로도 못 보내면 코치 Q&A로 (라우터가 죽어도 대화는 산다).
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.config import settings
from app.core import llm

INTENTS: tuple[str, ...] = (
    "report_income",     # 예정 수입 보고 → 예정 수입 파서(event_capture)
    "adjust_allocation", # 배분 조정 의사 → 배분 상태 컨텍스트 + 승인 게이트 안내
    "tag_txn",           # 태깅/분류 정정 → 미분류 행 컨텍스트 + 수기 태그 안내
    "ask_products",      # 상품 문의 → 적합성 후보(⑥의 결정론 층) 컨텍스트
    "qa",                # 그 외 전부 — 코치 Q&A (기본값이자 폴백)
)

# 룰 1층 — (인텐트, 패턴, 근거 라벨). 위에서부터 먼저 맞는 것이 이긴다.
_RULES: tuple[tuple[str, re.Pattern, str], ...] = (
    ("report_income", re.compile(r"(들어와|입금|잔금|정산|계약금|착수금).*(예정|기로|거예요|을거|올거|와요|온대)|"
                                 r"(다음\s*주|다다음|이번\s*달|월말|말일).*(만\s*원|만원|원)"), "예정 수입 신호(시점+금액/입금 어휘)"),
    ("adjust_allocation", re.compile(r"(배분|버퍼|여윳돈|봉투|생활비).*(조정|바꾸|늘리|늘려|줄이|줄여|옮기|옮겨)|"
                                     r"(조정|바꾸|늘려|줄여).*(배분|버퍼|봉투)"), "배분 조정 어휘"),
    ("tag_txn", re.compile(r"(태그|분류|카테고리).*(달아|바꾸|정정|해줘|해 줘)|이\s*(거래|건).*(뭐|무엇|분류)"), "태깅/분류 어휘"),
    ("ask_products", re.compile(r"(상품|ISA|isa|IRP|irp|파킹|통장|연금|대출).*(추천|어때|뭐가|가입|알려|괜찮)|"
                                r"(추천).*(상품|통장)"), "상품 문의 어휘"),
)

_SYSTEM = (
    "너는 긱워커 가계부 코치의 인텐트 라우터다. 사용자 발화를 다음 중 하나로만 분류한다.\n"
    "- report_income: 앞으로 들어올 돈(잔금·정산·계약금 등)을 알려주는 말\n"
    "- adjust_allocation: 배분·버퍼·봉투 금액을 바꾸고 싶다는 말\n"
    "- tag_txn: 거래 내역의 태그/분류를 정정하려는 말\n"
    "- ask_products: 금융상품(통장·ISA·IRP 등) 추천/문의\n"
    "- qa: 그 외 전부 (질문·인사·상담)\n"
    '출력은 JSON만: {"intent": "qa"}'
)


@dataclass(frozen=True)
class IntentDecision:
    intent: str    # INTENTS 중 하나
    source: str    # "rule" | "llm" | "fallback"
    signal: str    # 왜 이 인텐트인가 (감사용 — 룰 근거 또는 폴백 사유)

    def as_dict(self) -> dict:
        return {"intent": self.intent, "source": self.source, "signal": self.signal}


def route(message: str) -> IntentDecision:
    """발화 1건 → 인텐트 라벨 (순수 판정 — 상태 변경 없음)."""
    for intent, pattern, why in _RULES:
        if pattern.search(message):
            return IntentDecision(intent=intent, source="rule", signal=f"룰: {why}")

    out = llm.chat_json(_SYSTEM, message, model=settings.ollama_model_judgment)
    if isinstance(out, dict):
        label = str(out.get("intent", "")).strip()
        if label in INTENTS:  # 메뉴 게이트 — enum 밖 라벨은 폐기
            return IntentDecision(intent=label, source="llm", signal="2.4B 분류 (메뉴 게이트 통과)")

    return IntentDecision(intent="qa", source="fallback",
                          signal="룰 미매치 + LLM 무응답/메뉴 밖 → Q&A 폴백")
