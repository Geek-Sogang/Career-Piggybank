"""강점 한 줄 라우트 — 후보는 결정론, LLM은 선택만 (§6-1 개인화 3종 ③)."""
from __future__ import annotations

from fastapi import APIRouter

from app.schemas.strength import CareerFactsIn, StrengthResponse
from app.services import strength
from app.services.strength import CareerFacts

router = APIRouter(prefix="/v1/strength", tags=["strength"])


@router.post("", response_model=StrengthResponse)
def pick_strength(req: CareerFactsIn) -> StrengthResponse:
    result = strength.pick(CareerFacts(**req.model_dump()))
    return StrengthResponse(**result.__dict__)
