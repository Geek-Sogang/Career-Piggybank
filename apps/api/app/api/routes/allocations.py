"""봉투 배분 라우트 — 제안 생성과 사용자 결정(승인/조정/거절)을 분리.

엔진 출력은 '제안' 상태로 저장되고, 사용자의 결정이 있어야 확정된다(AI 제안·실행은 사람).
**승인/조정된 배분만 봉투 잔액을 실제로 바꾼다** — 저장소는 SQLite(app/store/db.py).
"""
from __future__ import annotations

from dataclasses import replace

from fastapi import APIRouter, HTTPException

from app.profile import build_user_profile
from app.schemas.allocation import (
    AllocationResponse,
    DecisionRequest,
    EnvelopeSplit,
    MetricsResponse,
    ProductHook,
    ProposeRequest,
)
from app.engines import allocation_policy, allocator, product_match
from app.engines.allocator import EnvelopeBalances, SpendingProfile
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
        gig_archetype=meta.get("gig_archetype", ""),
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


@router.get("/compare")
def compare(deposit: float = 3_000_000) -> dict:
    """긱 구조 대조 시연 — 같은 소득·같은 입금, 소득 집중도만 다르면 버퍼가 어떻게 갈리나.

    현재 사용자(원장)의 실제 소득 파라미터·정책 버퍼 개월을 고정하고, 긱 집중도만 토글해
    (다각화 vs 단일 의존) allocator를 두 번 돌린다(읽기 전용, 원장 안 건드림). 변수를
    '긱 소득 구조' 하나로 격리해 개인화가 실제로 배분을 바꾸는 걸 보여준다("측정된 AI").
    """
    from app.api.routes.bank import _boot
    _boot()
    if deposit <= 0:
        raise HTTPException(status_code=422, detail="deposit must be positive")
    up = build_user_profile()
    prof = up.spending.profile
    balances = EnvelopeBalances(buffer=db.envelope_balances()["buffer"])
    policy = allocation_policy.choose(
        income_dates=list(up.income_dates), axes=up.persona_axes, income_cv=prof.income_cv,
    )
    base = replace(up.allocation_context(),
                   buffer_months_override=policy.months, buffer_months_reason=policy.reason)

    def case(single_source: bool, label: str) -> dict:
        p = allocator.propose(deposit, prof, balances,
                              replace(base, single_source_dependence=single_source))
        reason = next((r for r in p.reasons if "한 곳에 몰려" in r),
                      next((r for r in p.reasons if "여윳돈" in r), ""))
        return {
            "gig_type": label, "single_source": single_source,
            "buffer_target": p.buffer_target,
            "buffer_target_months": p.assumptions["buffer_target_months"],
            "invest_available": p.invest_available,
            "reason": reason,
        }

    diversified = case(False, "다각화형 (소득원 분산)")
    single = case(True, "단일 의존형 (한 채널 집중)")
    return {
        "deposit": round(deposit, 2),
        "income_profile": {
            "annual_gross": prof.annual_gross,
            "expected_monthly_living": prof.expected_monthly_living,
            "income_cv": prof.income_cv,
        },
        "cases": [diversified, single],
        "buffer_target_delta": round(single["buffer_target"] - diversified["buffer_target"], 2),
        "invest_available_delta": round(single["invest_available"] - diversified["invest_available"], 2),
        "note": "같은 소득·같은 입금 — 긱 소득 구조(집중도)만 다르면 버퍼 목표·투자 가능액이 이렇게 갈려요",
    }


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
        credits = allocation_policy.credits_for(
            req.action, decided["proposed"], decided["final"], decided["deposit"],
            policy_meta["arm_id"],
        )
        for arm, reward in credits:
            allocation_policy.update(arm, reward)
        if credits:
            payload.update({
                "policy_arm": policy_meta["arm_id"],
                "policy_credits": [[arm, round(reward, 4)] for arm, reward in credits],
            })

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
