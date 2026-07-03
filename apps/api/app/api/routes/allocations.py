"""봉투 배분 라우트 — 제안 생성과 사용자 결정(승인/조정/거절)을 분리.

엔진 출력은 '제안' 상태로 저장되고, 사용자의 결정이 있어야 확정된다(AI 제안·실행은 사람).
저장소는 데모용 인메모리 — 실서비스에서는 DB로 교체.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import APIRouter, HTTPException

from app.schemas.allocation import (
    AllocationResponse,
    AllocationStatus,
    DecisionRequest,
    EnvelopeSplit,
    ProposeRequest,
)
from app.services import allocator
from app.services.allocator import AllocationProposal, EnvelopeBalances, SpendingProfile

router = APIRouter(prefix="/v1/allocations", tags=["allocations"])


@dataclass
class _Stored:
    proposal: AllocationProposal
    status: AllocationStatus = "proposed"
    final: EnvelopeSplit | None = None


_STORE: dict[str, _Stored] = {}


def _to_response(alloc_id: str, s: _Stored) -> AllocationResponse:
    p = s.proposal
    proposed = EnvelopeSplit(tax=p.tax, expense=p.expense, spendable=p.spendable, buffer=p.buffer)
    delta = None
    if s.final is not None:
        delta = EnvelopeSplit(
            tax=round(s.final.tax - p.tax, 2),
            expense=round(s.final.expense - p.expense, 2),
            spendable=round(s.final.spendable - p.spendable, 2),
            buffer=round(s.final.buffer - p.buffer, 2),
        )
    return AllocationResponse(
        id=alloc_id,
        status=s.status,
        deposit=p.deposit,
        proposed=proposed,
        final=s.final,
        adjustment_delta=delta,
        buffer_target=p.buffer_target,
        invest_available=p.invest_available,
        windfall_ratio=p.windfall_ratio,
        needs_confirmation=p.needs_confirmation,
        reasons=p.reasons,
        assumptions=p.assumptions,
    )


@router.post("/propose", response_model=AllocationResponse)
def propose(req: ProposeRequest) -> AllocationResponse:
    """입금 1건 → 폭포수 룰 배분 제안 생성 (봉투에는 아직 반영 안 됨)."""
    proposal = allocator.propose(
        req.deposit,
        SpendingProfile(**req.profile.model_dump()),
        EnvelopeBalances(**req.balances.model_dump()),
    )
    alloc_id = uuid.uuid4().hex[:12]
    _STORE[alloc_id] = _Stored(proposal=proposal)
    return _to_response(alloc_id, _STORE[alloc_id])


@router.post("/{alloc_id}/decision", response_model=AllocationResponse)
def decide(alloc_id: str, req: DecisionRequest) -> AllocationResponse:
    """제안에 대한 사용자 결정 — confirm(그대로) / adjust(고쳐서) / reject(안 나눔)."""
    stored = _STORE.get(alloc_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="allocation not found")
    if stored.status != "proposed":
        raise HTTPException(status_code=409, detail=f"already decided: {stored.status}")

    p = stored.proposal
    if req.action == "confirm":
        stored.status = "confirmed"
        stored.final = EnvelopeSplit(tax=p.tax, expense=p.expense, spendable=p.spendable, buffer=p.buffer)
    elif req.action == "adjust":
        if req.adjusted is None:
            raise HTTPException(status_code=422, detail="adjusted split is required for action=adjust")
        a = req.adjusted
        try:
            allocator.validate_adjustment(p.deposit, a.tax, a.expense, a.spendable, a.buffer)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e)) from e
        stored.status = "adjusted"
        stored.final = a
    else:  # reject
        stored.status = "rejected"
        stored.final = None

    return _to_response(alloc_id, stored)


@router.get("/{alloc_id}", response_model=AllocationResponse)
def get_allocation(alloc_id: str) -> AllocationResponse:
    stored = _STORE.get(alloc_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="allocation not found")
    return _to_response(alloc_id, stored)
