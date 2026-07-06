"""강점 한 줄 API 스키마."""
from __future__ import annotations

from pydantic import BaseModel, Field


class CareerFactsIn(BaseModel):
    verified_count: int = Field(0, ge=0)
    months_active: int = Field(0, ge=0)
    repeat_client_rate: float = Field(0, ge=0, le=1, description="재의뢰율 0~1")
    settlement_growth: float = Field(0, ge=0, description="정산액 성장 배수(1년)")
    top_skill: str = ""


class StrengthResponse(BaseModel):
    line: str
    candidates: list[str]
    chosen_by: str = Field(..., description="llm=선택 에이전트 / fallback=우선순위 룰")
    reason: str
    signals: list[str]
