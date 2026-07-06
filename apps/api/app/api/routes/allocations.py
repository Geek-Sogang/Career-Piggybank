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
    ProductHook,
    ProposeRequest,
)
from app.services import allocation_policy, allocator, product_match
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
        product_hooks=[ProductHook(**h) for h in meta.get("product_hooks", [])],
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
            "product_hooks": product_match.hooks_for(p),
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

    # 상태 전이(원자적 조건부 UPDATE)를 먼저 따내고, 성공한 쪽만 돈을 움직인다 —
    # 동시 결정 2건(더블탭·재시도)이 와도 봉투 입금·정책 보상은 정확히 1번
    if req.action == "confirm":
        final = stored["proposed"]
        if not db.decide_allocation(alloc_id, "confirmed", final):
            raise HTTPException(status_code=409, detail="already decided (concurrent)")
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
        if not db.decide_allocation(alloc_id, "adjusted", final):
            raise HTTPException(status_code=409, detail="already decided (concurrent)")
        db.envelope_add(final)
    else:  # reject
        if not db.decide_allocation(alloc_id, "rejected", None):
            raise HTTPException(status_code=409, detail="already decided (concurrent)")

    # 행동 계측 — 결정(승인/조정/거절)과 조정 방향은 행동축·플라이휠의 원천
    decided = db.get_allocation(alloc_id)
    buffer_delta = 0.0
    if req.action == "adjust" and decided and decided["final"]:
        buffer_delta = round(
            float(decided["final"].get("buffer", 0)) - float(decided["proposed"].get("buffer", 0)), 2
        )
    payload: dict = {"action": req.action, "buffer_delta": buffer_delta}

    # 학습 정책 보상 — 이 제안을 만든 arm에 결정을 귀속 (온라인 학습이 닫히는 지점).
    # 원자적 상태 전이(위의 조건부 UPDATE)를 따낸 요청만 여기 도달 — 결정 1건 = 보상 1건.
    # 공백 관측 0건이면 arm이 출력에 영향을 준 게 없으므로 귀속하지 않는다 (무영향 무보상).
    policy_meta = decided["meta"].get("policy") if decided else None
    if policy_meta and decided and policy_meta.get("observed_gaps", 0) > 0:
        reward = allocation_policy.reward_for(
            req.action, decided["proposed"], decided["final"], decided["deposit"]
        )
        allocation_policy.update(policy_meta["arm_id"], reward)
        payload.update({"policy_arm": policy_meta["arm_id"], "policy_reward": round(reward, 4)})

    db.log_event("allocation_decided", ref_id=alloc_id, payload=payload)
    return to_response(decided)  # type: ignore[arg-type]


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
