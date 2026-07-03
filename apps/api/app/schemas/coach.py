"""피기 코치 API 스키마."""
from __future__ import annotations

from pydantic import BaseModel, Field


class CoachChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="사용자 메시지")
    context: dict | None = Field(
        None,
        description="결정론 엔진의 출력(배분 제안·분류 결과·프로필 요약 등) — 코치는 이 안의 숫자만 인용",
    )


class CapturedEvent(BaseModel):
    """대화에서 수집된 예정 수입 (§6-2⑥) — 파싱만 LLM, 검증·반영은 결정론."""

    date: str
    amount: float | None
    label: str


class CoachChatResponse(BaseModel):
    reply: str
    source: str = Field(..., description="llm=로컬 LLM 응답 / fallback=결정론 템플릿")
    verified: bool = Field(..., description="숫자 검증(컨텍스트 근거) 통과 여부")
    signals: list[str]
    captured_event: CapturedEvent | None = Field(
        None, description="메시지에서 수집된 예정 수입 — 다음 수입 예측(스트림)에 반영됨"
    )
