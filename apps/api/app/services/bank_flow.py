"""뱅크 플로우 — 입금 1건이 파이프라인 전체를 관통하는 오케스트레이션 (코드가 흐름 제어).

입금 → ⓪태그 사전 → ①분류(룰→LLM 배심원단) → 원장 기록 → (income이면)
②저장된 이력으로 프로필·컨텍스트(수주 주기·커리어 추세·조정 성향) 산출 →
③이번 달 잔액 기준 배분 제안 → 승인 대기.
"""
from __future__ import annotations

import statistics

from app.services import allocator, classifier, classifier_llm, forecast, product_match, spending_profile
from app.services.allocator import AllocationContext, AllocationProposal, EnvelopeBalances
from app.services.classifier import Classification, TxnInput
from app.services.spending_profile import ProfileEstimate, Txn
from app.store import db

ADJUSTMENT_LOOKBACK = 5  # 조정 성향 집계에 쓰는 최근 조정 건수

DICT_CONFIDENCE = 0.98  # 사용자가 직접 가르친 사전 — 룰(0.95)보다 위


def classify_cascade(txn: TxnInput, llm_fallback: bool = False) -> Classification:
    """캐스케이드 0층 = 수기 태그 학습 사전 → 룰 → (옵션) LLM."""
    hit = db.dict_lookup(txn.counterparty)
    if hit:
        return Classification(
            kind=hit["kind"], subtype=hit["subtype"], confidence=DICT_CONFIDENCE,
            needs_review=False,
            signals=[f"수기 태그 학습: '{txn.counterparty.strip()}' — 전에 직접 분류한 상대예요"],
        )
    if llm_fallback:
        return classifier_llm.classify_with_fallback(txn)
    return classifier.classify(txn)


def profile_from_store(persona: str = "developer") -> ProfileEstimate:
    """원장의 라벨된 거래로 프로필 산출 — 태그할수록 정확해진다."""
    txns = [
        Txn(date=t["date"], amount=t["amount"], kind=t["kind"])  # type: ignore[arg-type]
        for t in db.list_txns()
        if t["kind"] in ("income", "expense", "living")
    ]
    return spending_profile.estimate(txns, persona)


def buffer_adjustment_bias() -> float:
    """행동 신호 — 최근 조정에서 사용자가 버퍼를 얼마나 늘려 왔나 (중앙값, 원).

    조정 이력이 BIAS_MIN_SAMPLES 미만이거나 중앙값이 0 이하(줄이는 성향)면 0 —
    보수적으로, 늘리는 습관만 선반영한다.
    """
    deltas = [
        float(a["final"].get("buffer", 0)) - float(a["proposed"].get("buffer", 0))
        for a in db.list_allocations()
        if a["status"] == "adjusted" and a["final"]
    ][-ADJUSTMENT_LOOKBACK:]
    if len(deltas) < allocator.BIAS_MIN_SAMPLES:
        return 0.0
    return max(0.0, statistics.median(deltas))


def context_from_store() -> AllocationContext:
    """긱워커 컨텍스트 — 원장·배분 이력에서 결정론으로 산출 (신호는 통계, 보정은 룰)."""
    income_txns = [t for t in db.list_txns() if t["kind"] == "income" and t["direction"] == "in"]
    gap = forecast.next_income_window([t["date"] for t in income_txns]) if income_txns else None
    signals = forecast.career_signals(income_txns)
    return AllocationContext(
        expected_gap_days=gap.median_gap_days if gap else None,
        early_decline=signals.career_trend <= forecast.EARLY_DECLINE_THRESHOLD,
        buffer_bias=buffer_adjustment_bias(),
    )


def propose_for_deposit(deposit: float, date: str, txn_id: str | None) -> tuple[str, AllocationProposal]:
    """저장된 프로필·컨텍스트·이번 달 배분 이력·버퍼 잔액 기준으로 제안 생성 후 DB 기록."""
    est = profile_from_store()
    allocated = db.month_allocated(date[:7])
    balances = EnvelopeBalances(
        expense=allocated["expense"],
        spendable=allocated["spendable"],
        buffer=db.envelope_balances()["buffer"],
    )
    ctx = context_from_store()
    p = allocator.propose(deposit, est.profile, balances, ctx)
    alloc_id = db.insert_allocation(
        deposit,
        {"tax": p.tax, "expense": p.expense, "spendable": p.spendable, "buffer": p.buffer},
        meta={
            "buffer_target": p.buffer_target, "invest_available": p.invest_available,
            "windfall_ratio": p.windfall_ratio, "needs_confirmation": p.needs_confirmation,
            "reasons": p.reasons, "assumptions": p.assumptions,
            "profile_notes": est.notes, "months_observed": est.months_observed,
            "product_hooks": product_match.hooks_for(p, ctx),
        },
        txn_id=txn_id,
    )
    return alloc_id, p
