"""피기 코치 라우트 — 말만 한다. 계산·분류·배분·실행은 각자의 엔진 몫."""
from __future__ import annotations

from fastapi import APIRouter

from app.schemas.coach import CoachChatRequest, CoachChatResponse
from app.services import coach

router = APIRouter(prefix="/v1/coach", tags=["coach"])


@router.post("/chat", response_model=CoachChatResponse)
def chat(req: CoachChatRequest) -> CoachChatResponse:
    """코치 대화 — 응답 숫자는 결정론 검증기로 컨텍스트 근거를 확인한다."""
    result = coach.chat(req.message, req.context)
    return CoachChatResponse(**result.__dict__)
