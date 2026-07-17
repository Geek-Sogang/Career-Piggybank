"""프로필 라우트 — 결정론 추정(estimate)과 페르소나 판독(read)을 분리.

/read 오케스트레이션(흐름=코드): 팩트 측정(엔진) → 프로필 판독 에이전트(축당 1회)
→ 스냅샷 저장(감사 로그). 에이전트는 판정만 — 어떤 돈도 움직이지 않는다.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents import profile_read
from app.api.routes.bank import _boot
from app.schemas.allocation import SpendingProfileIn
from app.schemas.profile import ProfileEstimateRequest, ProfileEstimateResponse
from app.engines import career_verification, facts as facts_svc
from app.engines import forecast, gig_profile, income_streams, spending_profile
from app.engines.spending_profile import Txn
from app.store import db

router = APIRouter(prefix="/v1/profile", tags=["profile"])


class CareerVerificationRequest(BaseModel):
    job: str = Field(default="developer", description="developer | designer | creator")
    sources: list[str] = Field(default_factory=list, description="현재 활성화된 커리어 연결 소스")


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


@router.get("/verification")
def get_verification() -> dict:
    """커리어 검증 SSOT — 점수·단계·상품 한도를 백엔드 결정론으로 계산한다."""
    _boot()
    return career_verification.latest(db.list_events()).as_dict()


@router.post("/verification")
def update_verification(req: CareerVerificationRequest) -> dict:
    """활성 연결 상태 동기화 — 소비 배분이 아니라 상품 한도·직군 추천에만 사용한다."""
    _boot()
    if req.job not in {"developer", "designer", "creator"}:
        raise HTTPException(status_code=422, detail="job must be developer|designer|creator")
    invalid = sorted(set(req.sources) - set(career_verification.SOURCE_SCORES))
    if invalid:
        raise HTTPException(status_code=422, detail=f"unknown sources: {invalid}")
    result = career_verification.compute(req.sources, req.job)
    db.log_event(
        "career_verification_updated",
        payload={"job": result.job, "sources": list(result.sources)},
    )
    return result.as_dict()


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
