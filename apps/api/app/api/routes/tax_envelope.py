"""세금봉투 라우트 — 데모 1막의 결정론 엔진을 노출."""
from __future__ import annotations

from fastapi import APIRouter

from app.schemas.tax import (
    AnnualTaxRequest,
    AnnualTaxResponse,
    DepositSplitRequest,
    EnvelopesResponse,
)
from app.services import tax_envelope as engine

router = APIRouter(prefix="/v1/tax-envelope", tags=["tax-envelope"])


@router.post("/annual", response_model=AnnualTaxResponse)
def annual_tax(req: AnnualTaxRequest) -> AnnualTaxResponse:
    """연 매출 → 종소세 추가납부 예상액(5월 쇼크) 추정."""
    result = engine.estimate_annual_tax(req.annual_gross, req.expense_rate)
    return AnnualTaxResponse(**result.__dict__)


@router.post("/split", response_model=EnvelopesResponse)
def split(req: DepositSplitRequest) -> EnvelopesResponse:
    """입금 1건 → 세금/경비/여윳돈/즉시가용 4봉투 결정론 분류."""
    result = engine.split_deposit(
        req.deposit, req.annual_gross, req.expense_rate, req.buffer_ratio
    )
    return EnvelopesResponse(**result.__dict__)
