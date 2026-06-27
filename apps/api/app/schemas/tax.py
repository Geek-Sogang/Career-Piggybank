"""세금봉투 API 요청/응답 스키마."""
from __future__ import annotations

from pydantic import BaseModel, Field


class AnnualTaxRequest(BaseModel):
    annual_gross: float = Field(..., gt=0, description="연 매출(3.3% 원천징수 포함 총액), 원")
    expense_rate: float = Field(0.30, ge=0, le=1, description="단순경비율 가정")


class AnnualTaxResponse(BaseModel):
    annual_gross: float
    expense_rate: float
    taxable: float
    income_tax: float
    local_tax: float
    total_tax: float
    already_withheld: float
    additional_due: float
    effective_tax_rate: float


class DepositSplitRequest(BaseModel):
    deposit: float = Field(..., gt=0, description="입금액, 원")
    annual_gross: float = Field(..., gt=0, description="연 매출 추정, 원")
    expense_rate: float = Field(0.30, ge=0, le=1)
    buffer_ratio: float = Field(0.30, ge=0, le=1)


class EnvelopesResponse(BaseModel):
    deposit: float
    tax: float
    expense: float
    buffer: float
    spendable: float
    assumptions: dict[str, float]
