"""지출·소득 프로필 예측 API 스키마."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.allocation import SpendingProfileIn


class TxnIn(BaseModel):
    """분류기가 라벨을 붙인 거래 1건 — 지금은 요청으로 받고, 추후 classifier가 공급."""

    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="ISO 날짜 YYYY-MM-DD")
    amount: float = Field(..., gt=0, description="원, 항상 양수 (방향은 kind가 결정)")
    kind: Literal["income", "expense", "living"] = Field(
        ..., description="income=일감매출 / expense=경비 / living=개인(생활)"
    )


class ProfileEstimateRequest(BaseModel):
    transactions: list[TxnIn] = Field(default_factory=list)
    persona: str = Field("developer", description="콜드스타트 직군 프리셋 (developer/designer/creator)")


class ProfileEstimateResponse(BaseModel):
    profile: SpendingProfileIn      # 그대로 /v1/allocations/propose의 profile로 넣을 수 있음
    months_observed: int
    blend_weight: float             # 0=프리셋 100% ~ 1=개인 데이터 100%
    persona: str
    notes: list[str]
