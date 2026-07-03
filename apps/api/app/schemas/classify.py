"""거래 분류 API 스키마."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ClassifyTxnIn(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    amount: float = Field(..., gt=0, description="원, 항상 양수")
    direction: Literal["in", "out"]
    counterparty: str = Field(..., min_length=1, description="입금자명/가맹점명")
    memo: str = ""


class ClassifyRequest(BaseModel):
    transactions: list[ClassifyTxnIn] = Field(..., min_length=1)


class ClassificationOut(BaseModel):
    kind: Literal["income", "expense", "living", "unknown"]
    subtype: Literal["settlement", "advance", "subscription", "operating"] | None
    confidence: float
    needs_review: bool
    signals: list[str]


class ClassifyResponse(BaseModel):
    results: list[ClassificationOut]
    review_count: int = Field(..., description="수기 태그가 필요한 건수")
