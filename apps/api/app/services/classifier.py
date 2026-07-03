"""거래 분류기 — 결정론 시그널 캐스케이드 (1단계: 룰만).

역할은 분류뿐이다: 거래 1건 → 라벨 + 확신도 + 근거. 배분·예측·설명은 하지 않는다.

긱워커는 발주처가 매번 바뀌므로 '전에 본 상호명' 사전이 아니라 구조적 신호를 쓴다:
- **3.3% 역산**: 프리랜서 대금은 원천징수 3.3%를 떼고 입금된다.
  입금액 ÷ 0.967이 딱 떨어지는 금액(만원 단위)이면 일감 매출(잔금)이 거의 확실.
- **입금자명 형태**: 특정 상호 기억이 아니라 '사업자스러운가'(㈜·스튜디오·컴퍼니…)를 본다.
- **지출 키워드**: 구독·SaaS·호스팅 등 경비 패턴.

확신이 낮으면 찍지 않고 needs_review=True로 사람에게 넘긴다(수기 태그 UI).
2단계(3b)에서 unknown만 로컬 LLM 폴백으로 내려보낸다 — 이 파일의 룰은 그대로 유지.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

from app.services.tax_envelope import WITHHOLDING_RATE

Kind = Literal["income", "expense", "living", "unknown"]
Subtype = Literal["settlement", "advance", "subscription", "operating", None]

REVIEW_THRESHOLD = 0.65   # 이 확신도 미만이면 needs_review → 수기 태그
REVERSAL_UNIT = 10_000    # 3.3% 역산 후 이 단위로 딱 떨어지면 매치 (계약 금액은 만원 단위 관행)
REVERSAL_TOLERANCE = 5.0  # 역산 오차 허용(원) — 은행 절사 대응

# 사업자스러운 입금자명 조각 (특정 상호가 아니라 '형태')
BUSINESS_HINTS = (
    "㈜", "(주)", "주식회사", "스튜디오", "컴퍼니", "에이전시", "디자인", "랩",
    "테크", "소프트", "미디어", "커머스", "엔터", "프로덕션", "파트너스", "기획",
    "studio", "company", "inc", "llc", "lab", "agency", "partners",
)
# 정산 플랫폼 (긱 플랫폼 정산 채널 — 발주처가 아니라 통로)
PLATFORM_HINTS = ("크몽", "위시켓", "숨고", "탈잉", "클래스101", "원티드긱스", "페이워크", "플랫폼 정산")
# 경비성 지출 키워드 (구독/인프라/운영)
SUBSCRIPTION_HINTS = (
    "figma", "adobe", "aws", "github", "notion", "slack", "vercel", "구독",
)
OPERATING_HINTS = ("호스팅", "도메인", "서버", "사무", "장비", "프린트", "택배", "임대료", "작업실")

_PERSONAL_NAME = re.compile(r"^[가-힣]{2,4}$")  # 한글 2~4자만 → 개인 이름 형태


@dataclass(frozen=True)
class TxnInput:
    """분류 대상 거래 1건 (은행 원장 관점)."""

    date: str
    amount: float                     # 원, 항상 양수
    direction: Literal["in", "out"]   # 입금/출금
    counterparty: str                 # 입금자명/가맹점명
    memo: str = ""


@dataclass(frozen=True)
class Classification:
    kind: Kind
    subtype: Subtype
    confidence: float          # 0~1
    needs_review: bool         # True면 자동 반영하지 않고 수기 태그 요청
    signals: list[str] = field(default_factory=list)  # 판정 근거 (한국어, 코치 재료)


def _withholding_reversal(amount: float) -> float | None:
    """3.3% 역산 — 세전 금액이 REVERSAL_UNIT 단위로 떨어지면 그 값을, 아니면 None."""
    gross = amount / (1 - WITHHOLDING_RATE)
    nearest = round(gross / REVERSAL_UNIT) * REVERSAL_UNIT
    if nearest > 0 and abs(gross - nearest) <= REVERSAL_TOLERANCE:
        return float(nearest)
    return None


def _looks_business(name: str) -> bool:
    low = name.lower()
    return any(h in low for h in BUSINESS_HINTS)


def _looks_platform(name: str) -> bool:
    low = name.lower()
    return any(h in low for h in PLATFORM_HINTS)


def _classify_in(txn: TxnInput) -> Classification:
    name = txn.counterparty.strip()

    # 1) 3.3% 역산 — 가장 강한 긱워커 전용 신호
    gross = _withholding_reversal(txn.amount)
    if gross is not None:
        return Classification(
            kind="income", subtype="settlement", confidence=0.95, needs_review=False,
            signals=[
                f"3.3% 역산 매치: {txn.amount:,.0f}원 ÷ 0.967 = 세전 {gross:,.0f}원 (원천징수 흔적)",
            ],
        )

    # 2) 정산 플랫폼 입금 — 통로가 곧 정답지
    if _looks_platform(name):
        return Classification(
            kind="income", subtype="settlement", confidence=0.9, needs_review=False,
            signals=[f"정산 플랫폼 입금: '{name}'"],
        )

    # 3) 사업자 형태 + 원천징수 흔적 없음 → 계약금(선금) 의심
    if _looks_business(name):
        return Classification(
            kind="income", subtype="advance", confidence=0.7, needs_review=False,
            signals=[
                f"사업자 형태 입금자: '{name}'",
                "원천징수(3.3%) 흔적 없음 → 계약금/선금 가능성",
            ],
        )

    # 4) 개인 이름 형태 → 매출 아닐 가능성 (용돈·더치페이·중고거래…) — 찍지 않는다
    if _PERSONAL_NAME.match(name):
        return Classification(
            kind="unknown", subtype=None, confidence=0.4, needs_review=True,
            signals=[f"개인 이름 형태 입금자: '{name}' — 매출 여부 판단 불가"],
        )

    # 5) 그 외 (페이 정산 등 애매) → 미분류, 2단계 LLM/수기 태그 대상
    return Classification(
        kind="unknown", subtype=None, confidence=0.3, needs_review=True,
        signals=[f"결정론 신호 없음: '{name}'"],
    )


def _classify_out(txn: TxnInput) -> Classification:
    text = f"{txn.counterparty} {txn.memo}".lower()

    if any(h in text for h in SUBSCRIPTION_HINTS):
        return Classification(
            kind="expense", subtype="subscription", confidence=0.9, needs_review=False,
            signals=[f"구독/SaaS 패턴: '{txn.counterparty}'"],
        )
    if any(h in text for h in OPERATING_HINTS):
        return Classification(
            kind="expense", subtype="operating", confidence=0.75, needs_review=False,
            signals=[f"운영비 키워드: '{txn.counterparty}'"],
        )
    # 기본값: 개인 생활 지출 (긱워커 지출의 대부분) — 확신은 낮게 유지
    return Classification(
        kind="living", subtype=None, confidence=0.7, needs_review=False,
        signals=["경비 신호 없음 → 생활 지출로 추정"],
    )


def classify(txn: TxnInput) -> Classification:
    """거래 1건 분류 (순수 함수). 확신 낮으면 needs_review로 사람에게."""
    if txn.amount <= 0:
        raise ValueError("amount must be positive")
    result = _classify_in(txn) if txn.direction == "in" else _classify_out(txn)
    if result.confidence < REVIEW_THRESHOLD and not result.needs_review:
        return Classification(
            kind=result.kind, subtype=result.subtype, confidence=result.confidence,
            needs_review=True, signals=result.signals,
        )
    return result
