"""봉투 배분 라우트 — 제안 생성과 사용자 결정(승인/조정/거절)을 분리.

엔진 출력은 '제안' 상태로 저장되고, 사용자의 결정이 있어야 확정된다(AI 제안·실행은 사람).
**승인/조정된 배분만 봉투 잔액을 실제로 바꾼다** — 저장소는 SQLite(app/store/db.py).
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.allocation import (
    AllocationResponse,
    DecisionRequest,
    EnvelopeSplit,
    MetricsResponse,
    ProposeRequest,
)
from app.services import allocator
from app.services.allocator import EnvelopeBalances, SpendingProfile
from app.store import db

router = APIRouter(prefix="/v1/allocations", tags=["allocations"])


def to_response(a: dict) -> AllocationResponse:
    p, final, meta = a["proposed"], a["final"], a["meta"]
    delta = None
    if final is not None:
        delta = EnvelopeSplit(**{k: round(final[k] - p[k], 2) for k in p})
    return AllocationResponse(
        id=a["id"], status=a["status"], deposit=a["deposit"],
        proposed=EnvelopeSplit(**p),
        final=EnvelopeSplit(**final) if final is not None else None,
        adjustment_delta=delta,
        buffer_target=meta.get("buffer_target", 0),
        invest_available=meta.get("invest_available", 0),
        windfall_ratio=meta.get("windfall_ratio", 0),
        needs_confirmation=meta.get("needs_confirmation", False),
        reasons=meta.get("reasons", []),
        assumptions=meta.get("assumptions", {}),
    )


@router.post("/propose", response_model=AllocationResponse)
def propose(req: ProposeRequest) -> AllocationResponse:
    """입금 1건 → 폭포수 룰 배분 제안 생성 (봉투에는 아직 반영 안 됨)."""
    p = allocator.propose(
        req.deposit,
        SpendingProfile(**req.profile.model_dump()),
        EnvelopeBalances(**req.balances.model_dump()),
    )
    alloc_id = db.insert_allocation(
        req.deposit,
        {"tax": p.tax, "expense": p.expense, "spendable": p.spendable, "buffer": p.buffer},
        meta={
            "buffer_target": p.buffer_target, "invest_available": p.invest_available,
            "windfall_ratio": p.windfall_ratio, "needs_confirmation": p.needs_confirmation,
            "reasons": p.reasons, "assumptions": p.assumptions,
        },
    )
    return to_response(db.get_allocation(alloc_id))  # type: ignore[arg-type]


@router.post("/{alloc_id}/decision", response_model=AllocationResponse)
def decide(alloc_id: str, req: DecisionRequest) -> AllocationResponse:
    """confirm(그대로) / adjust(고쳐서) / reject — 확정분만 봉투 잔액에 반영."""
    stored = db.get_allocation(alloc_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="allocation not found")
    if stored["status"] != "proposed":
        raise HTTPException(status_code=409, detail=f"already decided: {stored['status']}")

    if req.action == "confirm":
        final = stored["proposed"]
        db.decide_allocation(alloc_id, "confirmed", final)
        db.envelope_add(final)  # 사람의 승인 후에만 돈이 움직인다
    elif req.action == "adjust":
        if req.adjusted is None:
            raise HTTPException(status_code=422, detail="adjusted split is required for action=adjust")
        a = req.adjusted
        try:
            allocator.validate_adjustment(stored["deposit"], a.tax, a.expense, a.spendable, a.buffer)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e)) from e
        final = a.model_dump()
        db.decide_allocation(alloc_id, "adjusted", final)
        db.envelope_add(final)
    else:  # reject
        db.decide_allocation(alloc_id, "rejected", None)

    return to_response(db.get_allocation(alloc_id))  # type: ignore[arg-type]


@router.get("/metrics", response_model=MetricsResponse)
def metrics() -> MetricsResponse:
    """무수정 승인율 — 시스템 전체 성능을 한 숫자로 (제안이 정확할수록 안 고침)."""
    allocs = db.list_allocations()
    decided = [a for a in allocs if a["status"] != "proposed"]
    confirmed = sum(1 for a in decided if a["status"] == "confirmed")
    adjusted = sum(1 for a in decided if a["status"] == "adjusted")
    rejected = sum(1 for a in decided if a["status"] == "rejected")
    return MetricsResponse(
        proposals=len(allocs), decided=len(decided),
        confirmed=confirmed, adjusted=adjusted, rejected=rejected,
        no_edit_approval_rate=round(confirmed / len(decided), 4) if decided else None,
    )


@router.get("/{alloc_id}", response_model=AllocationResponse)
def get_allocation(alloc_id: str) -> AllocationResponse:
    stored = db.get_allocation(alloc_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="allocation not found")
    return to_response(stored)
