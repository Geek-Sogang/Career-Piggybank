"""봉투 배분 제안/승인 API 스키마."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

AllocationStatus = Literal["proposed", "confirmed", "adjusted", "rejected"]


class SpendingProfileIn(BaseModel):
    """배분 파라미터 — 추후 spending_profile 서비스가 자동 산출, 지금은 요청으로 받음."""

    annual_gross: float = Field(..., gt=0, description="연 매출 추정(3.3% 원천징수 포함), 원")
    expected_monthly_expense: float = Field(..., ge=0, description="예상 월 경비, 원")
    expected_monthly_living: float = Field(..., ge=0, description="예상 월 생활비, 원")
    income_cv: float = Field(0.3, ge=0, le=3, description="소득 변동계수(표준편차/평균)")
    avg_deposit: float = Field(0, ge=0, description="평균 입금 건당 금액, 원 (0=이력 없음)")


class EnvelopeBalancesIn(BaseModel):
    """이번 달 각 봉투에 이미 쌓인 금액."""

    expense: float = Field(0, ge=0)
    spendable: float = Field(0, ge=0)
    buffer: float = Field(0, ge=0)


class ProposeRequest(BaseModel):
    deposit: float = Field(..., gt=0, description="입금액, 원")
    profile: SpendingProfileIn
    balances: EnvelopeBalancesIn = EnvelopeBalancesIn()


class EnvelopeSplit(BaseModel):
    tax: float
    expense: float
    spendable: float
    buffer: float


class ProductHook(BaseModel):
    """배분 → 하나 상품 연결 훅 — 선택은 룰, 문구는 결정론 템플릿 (product_match)."""

    product_id: str   # 모바일 products.ts ProductKey와 1:1
    envelope: str
    name: str
    line: str


class AllocationResponse(BaseModel):
    id: str
    status: AllocationStatus
    deposit: float
    proposed: EnvelopeSplit
    final: EnvelopeSplit | None = None       # 승인/조정 후 확정값 (proposed/rejected면 None)
    adjustment_delta: EnvelopeSplit | None = None  # 사용자 조정분(final−proposed) — 개인화 피드백 데이터
    buffer_target: float
    invest_available: float
    windfall_ratio: float
    needs_confirmation: bool
    reasons: list[str]
    assumptions: dict[str, float]
    product_hooks: list[ProductHook] = []  # 봉투별 하나 상품 안내 (최대 2)


class MetricsResponse(BaseModel):
    """무수정 승인율 = confirmed/decided — 제안 품질의 핵심 KPI."""

    proposals: int
    decided: int
    confirmed: int
    adjusted: int
    rejected: int
    no_edit_approval_rate: float | None


class DecisionRequest(BaseModel):
    action: Literal["confirm", "adjust", "reject"]
    adjusted: EnvelopeSplit | None = Field(
        None, description="action=adjust일 때 사용자가 고친 배분 — 합계는 입금액과 일치해야 함"
    )
