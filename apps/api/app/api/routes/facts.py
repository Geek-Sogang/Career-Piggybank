"""팩트시트 라우트 — 원장을 결정론으로 잰 사실의 목록 (페르소나 엔진의 입력).

GET /v1/facts: 라이브 측정. LLM 없음 — 값·참고구간·정의·표본수를 그대로 반환한다.
POST /v1/facts/snapshot: 현재 팩트시트를 스냅샷으로 고정 (판단 로그의 기준점, PR B가 사용).
"""
from __future__ import annotations

from fastapi import APIRouter

from app.api.routes.bank import _boot
from app.services import facts as facts_svc
from app.store import db

router = APIRouter(prefix="/v1/facts", tags=["facts"])


def _measure() -> dict:
    sheet = facts_svc.build_factsheet(db.list_txns(), db.list_allocations(), db.list_events())
    return facts_svc.factsheet_dict(sheet)


@router.get("")
def get_facts() -> dict:
    _boot()
    return _measure()


@router.post("/snapshot")
def snapshot(trigger: str = "manual") -> dict:
    """팩트시트를 지금 시점으로 고정 — 이후 판단(PR B)이 이 스냅샷을 참조한다."""
    _boot()
    sheet = _measure()
    snap_id = db.insert_snapshot(trigger=trigger, factsheet=sheet)
    return {"id": snap_id, "trigger": trigger, "factsheet": sheet}
