"""데모 시드 — 조대흠 페르소나 (프론트 화면 수치와 정합).

거래 원장이 비어 있을 때 1회만 실행: 4개월 라벨 이력(프로필 산출 재료) +
가계부 화면의 거래들 + 미분류 토스페이(수기 태그 데모) + 봉투 초기 잔액
(세금 320,000 = '미리 준비 ₩320,000' · 여윳돈 99,555 = '여윳돈 ₩99,555').
"""
from __future__ import annotations

from app.store import db

# (date, amount, direction, counterparty, memo, kind, subtype, needs_review)
_TXNS = [
    # 2월 — 프로필 이력용
    ("2025-02-14", 800_000, "in", "위시켓", "", "income", "settlement", False),
    ("2025-02-05", 350_000, "out", "가비아 호스팅", "", "expense", "operating", False),
    ("2025-02-20", 1_150_000, "out", "생활비 지출 합계", "", "living", None, False),
    # 3월
    ("2025-03-15", 1_450_000, "in", "㈜브릿지웍스", "잔금", "income", "settlement", False),
    ("2025-03-06", 380_000, "out", "Adobe", "", "expense", "subscription", False),
    ("2025-03-21", 1_200_000, "out", "생활비 지출 합계", "", "living", None, False),
    # 4월
    ("2025-04-12", 950_000, "in", "크몽 정산", "", "income", "settlement", False),
    ("2025-04-04", 300_000, "out", "작업실 임대료", "", "expense", "operating", False),
    ("2025-04-19", 1_100_000, "out", "생활비 지출 합계", "", "living", None, False),
    # 5월 — 가계부 화면의 거래들
    ("2025-05-02", 500_000, "in", "○○커머스", "웹 프론트엔드", "income", "settlement", False),
    ("2025-05-10", 1_200_000, "in", "△△스튜디오", "랜딩 개발", "income", "settlement", False),
    ("2025-05-18", 18_000, "out", "Figma 구독", "", "expense", "subscription", False),
    ("2025-05-20", 250_000, "in", "토스페이 정산", "", "unknown", None, True),  # 수기 태그 데모
]

_ENVELOPES = {"tax": 320_000, "expense": 0, "spendable": 0, "buffer": 99_555}


def ensure_seed() -> bool:
    """원장이 비어 있으면 시드. 시드했으면 True."""
    if db.list_txns():
        return False
    for date, amount, direction, cp, memo, kind, subtype, review in _TXNS:
        signals = ["데모 시드"] if not review else ["결정론 신호 없음: '토스페이 정산'"]
        db.insert_txn(
            date=date, amount=amount, direction=direction, counterparty=cp, memo=memo,
            kind=kind, subtype=subtype, confidence=0.9 if not review else 0.3,
            needs_review=review, signals=signals,
        )
    for name, balance in _ENVELOPES.items():
        db.envelope_set(name, balance)
    return True
