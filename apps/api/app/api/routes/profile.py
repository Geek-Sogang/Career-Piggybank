"""프로필 라우트 — 결정론 추정(estimate)과 페르소나 판독(read)을 분리.

/read 오케스트레이션(흐름=코드): 팩트 측정(엔진) → 프로필 판독 에이전트(축당 1회)
→ 스냅샷 저장(감사 로그). 에이전트는 판정만 — 어떤 돈도 움직이지 않는다.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.agents import profile_read
from app.api.routes.bank import _boot
from app.schemas.allocation import SpendingProfileIn
from app.schemas.profile import ProfileEstimateRequest, ProfileEstimateResponse
from app.engines import facts as facts_svc
from app.engines import forecast, gig_profile, income_streams, spending_profile
from app.engines.spending_profile import Txn
from app.store import db

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


@router.post("/read")
def read_persona(trigger: str = "manual") -> dict:
    """페르소나 판독 — 팩트 측정 → 축당 1회 LLM 판독 → 스냅샷 고정.

    입금 핫패스가 아니다(축당 수 초) — 온보딩·수동·소득 패턴 변화 때 부른다.
    """
    _boot()
    txns = db.list_txns()
    sheet = facts_svc.build_factsheet(txns, db.list_allocations(), db.list_events())
    reading = profile_read.read_profile(sheet)
    snap_id = db.insert_snapshot(
        trigger=trigger,
        factsheet=facts_svc.factsheet_dict(sheet),
        axes=reading["axes"],
        model_id=reading["model_id"],
        fallback_used=reading["fallback_count"] > 0,
        source_txn_count=len(txns),  # 신선도(staleness) 판정의 기준점
    )
    return {"snapshot_id": snap_id, "trigger": trigger, **reading}


@router.get("/persona")
def latest_persona() -> dict:
    """최신 페르소나 스냅샷 — 다운스트림(봉투·페이싱·상품·은퇴곡선)이 읽는 SSOT."""
    _boot()
    snap = db.latest_snapshot()
    if snap is None or snap["axes"] is None:
        raise HTTPException(status_code=404, detail="no persona snapshot — POST /v1/profile/read first")
    # 신선도 게이트 — 원장은 자랐는데 축은 예전이면 다운스트림이 알아야 한다 (판정만, 자동 재판독 없음)
    return {**snap, "staleness": facts_svc.snapshot_staleness(snap, len(db.list_txns()))}


@router.get("/gig")
def gig() -> dict:
    """긱워커 소득 프로필 — 페르소나의 긱 특화 층 (전부 결정론, 판독 전에도 항상 있음).

    심리 4축(/persona, AI 판독 필요)과 달리 이건 원장에서 잰 구조라 언제나 조회 가능하다 —
    변동성·소득원 구조·수입 리듬·국면·N잡 여부. "구조는 측정, 성향은 AI"의 측정 쪽.
    """
    _boot()
    txns = db.list_txns()
    income = [t for t in txns if t["kind"] == "income" and t["direction"] == "in"
              and not t["needs_review"]]
    facts = facts_svc.build_factsheet(txns, db.list_allocations(), db.list_events())
    signals = forecast.career_signals(income)
    as_of = max((t["date"] for t in txns), default=None)
    est_months = len({t["date"][:7] for t in txns})
    streams = income_streams.decompose(income, months_observed=float(est_months), as_of=as_of)
    return gig_profile.build_gig_profile(facts, signals, streams).as_dict()
