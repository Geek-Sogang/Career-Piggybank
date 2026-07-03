"""뱅크 플로우 API 스키마 — 원장·봉투·태그."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.allocation import AllocationResponse


class DepositRequest(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    amount: float = Field(..., gt=0)
    counterparty: str = Field(..., min_length=1)
    memo: str = ""
    llm_fallback: bool = Field(False, description="룰이 못 잡으면 로컬 LLM 폴백 사용")


class TxnOut(BaseModel):
    id: str
    date: str
    amount: float
    direction: Literal["in", "out"]
    counterparty: str
    memo: str
    kind: str
    subtype: str | None
    confidence: float
    needs_review: bool
    signals: list[str]


class DepositResponse(BaseModel):
    transaction: TxnOut
    allocation: AllocationResponse | None = Field(
        None, description="income으로 확정 분류된 입금만 배분 제안이 생성됨"
    )


class TagRequest(BaseModel):
    kind: Literal["income", "expense", "living"]
    subtype: Literal["settlement", "advance", "subscription", "operating"] | None = None


class TagResponse(BaseModel):
    transaction: TxnOut
    learned: bool = Field(..., description="태그 사전에 학습됨 — 같은 상대는 다음부터 자동 분류")
    allocation: AllocationResponse | None = None


class EnvelopesResponse(BaseModel):
    balances: dict[str, float]
    month_allocated: dict[str, float]
    annual_tax_expected: float = Field(..., description="종소세 추가납부 예상(연)")
    tax_prepared: float = Field(..., description="세금봉투 잔액")
    tax_shortfall: float
