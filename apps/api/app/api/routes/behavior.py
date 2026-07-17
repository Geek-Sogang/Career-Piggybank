"""행동 계측 라우트 — 실제 행동(비금융) 이벤트를 로그로 남긴다.

커리어 소스 연결·앱 방문은 금융 거래가 아니라 '진짜 행동'이다. 이 이벤트들이 팩트시트의
F13(소스 연결)은 긱 커리어 계획성 근거가 되고, F14(앱 참여)는 데이터 품질·관측 리듬으로만 쓴다.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.api.routes.bank import _boot
from app.store import db

router = APIRouter(prefix="/v1/behavior", tags=["behavior"])

_ALLOWED = {"source_connected", "app_opened", "portfolio_uploaded"}


class BehaviorEvent(BaseModel):
    type: str = Field(
        description="source_connected | app_opened | portfolio_uploaded",
    )
    source: str | None = Field(default=None, description="source_connected일 때 소스명(github 등)")


class CareerScrapCreate(BaseModel):
    content: str = Field(min_length=2, max_length=500, description="오늘 남길 커리어 기록")

    @field_validator("content")
    @classmethod
    def meaningful_content(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("content must contain at least 2 non-space characters")
        return value


@router.post("")
def log_behavior(req: BehaviorEvent) -> dict:
    """실제 행동 이벤트 1건 기록 — 계측만 (돈·상태 변경 없음)."""
    _boot()
    if req.type not in _ALLOWED:
        raise HTTPException(status_code=422, detail=f"type must be one of {sorted(_ALLOWED)}")
    payload = {"source": req.source} if req.source else {}
    ev_id = db.log_event(req.type, payload=payload)
    return {"ok": True, "event_id": ev_id}


@router.get("/career-scraps")
def list_career_scraps() -> list[dict]:
    """개인 DB에 저장된 커리어 조각을 최신순으로 조회한다."""
    _boot()
    return db.list_career_scraps()


@router.post("/career-scraps")
def save_career_scrap(req: CareerScrapCreate) -> dict:
    """커리어 조각은 모두 저장하되, 미션 XP 사건은 하루 한 번만 기록한다."""
    _boot()
    scrap = db.insert_career_scrap(req.content)
    today = datetime.now(timezone.utc).date().isoformat()
    event_id, xp_awarded = db.log_daily_event_once(
        "career_scrap_saved", today, ref_id=scrap["id"],
    )
    return {
        "ok": True,
        "scrap": scrap,
        "event_id": event_id,
        "xp_awarded": xp_awarded,
    }
