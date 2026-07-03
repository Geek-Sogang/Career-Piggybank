"""프로필 예측 라우트 — 라벨된 거래 이력 → allocator 입력 파라미터."""
from __future__ import annotations

from fastapi import APIRouter

from app.schemas.allocation import SpendingProfileIn
from app.schemas.profile import ProfileEstimateRequest, ProfileEstimateResponse
from app.services import spending_profile
from app.services.spending_profile import Txn

router = APIRouter(prefix="/v1/profile", tags=["profile"])


@router.post("/estimate", response_model=ProfileEstimateResponse)
def estimate(req: ProfileEstimateRequest) -> ProfileEstimateResponse:
    """거래 이력 → 예상 월경비·생활비·소득 변동성 등 프로필 추정 (결정론 통계)."""
    result = spending_profile.estimate(
        [Txn(date=t.date, amount=t.amount, kind=t.kind) for t in req.transactions],
        persona=req.persona,
    )
    return ProfileEstimateResponse(
        profile=SpendingProfileIn(**result.profile.__dict__),
        months_observed=result.months_observed,
        blend_weight=result.blend_weight,
        persona=result.persona,
        notes=result.notes,
    )
