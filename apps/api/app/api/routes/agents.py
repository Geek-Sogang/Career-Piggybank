"""에이전트 로스터 라우트 — "팀 명단은 코드에 선언돼 있고 API로 조회됩니다."

GET /v1/agents: 멀티에이전트 문법(역할 분리·오케스트레이션=코드·가드레일)과
로스터 전체(구현/예정 정직 표기)를 그대로 반환한다. 데모·감사·Q&A용.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.agents import GRAMMAR, roster

router = APIRouter(prefix="/v1/agents", tags=["agents"])


@router.get("")
def list_agents() -> dict:
    specs = roster()
    return {
        "grammar": GRAMMAR,
        "count": len(specs),
        "implemented": sum(1 for s in specs if s.implemented),
        "agents": [s.as_dict() for s in specs],
    }
