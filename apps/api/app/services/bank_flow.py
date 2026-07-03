"""뱅크 플로우 — 입금 1건이 파이프라인 전체를 관통하는 오케스트레이션 (코드가 흐름 제어).

입금 → ⓪태그 사전 → ①분류(룰→LLM) → 원장 기록 → (income이면)
②저장된 이력으로 프로필 산출 → ③이번 달 잔액 기준 배분 제안 → 승인 대기.
"""
from __future__ import annotations

from app.services import allocator, classifier, classifier_llm, spending_profile
from app.services.allocator import AllocationProposal, EnvelopeBalances
from app.services.classifier import Classification, TxnInput
from app.services.spending_profile import ProfileEstimate, Txn
from app.store import db

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


def propose_for_deposit(deposit: float, date: str, txn_id: str | None) -> tuple[str, AllocationProposal]:
    """저장된 프로필·이번 달 배분 이력·버퍼 잔액 기준으로 제안 생성 후 DB 기록."""
    est = profile_from_store()
    allocated = db.month_allocated(date[:7])
    balances = EnvelopeBalances(
        expense=allocated["expense"],
        spendable=allocated["spendable"],
        buffer=db.envelope_balances()["buffer"],
    )
    p = allocator.propose(deposit, est.profile, balances)
    alloc_id = db.insert_allocation(
        deposit,
        {"tax": p.tax, "expense": p.expense, "spendable": p.spendable, "buffer": p.buffer},
        meta={
            "buffer_target": p.buffer_target, "invest_available": p.invest_available,
            "windfall_ratio": p.windfall_ratio, "needs_confirmation": p.needs_confirmation,
            "reasons": p.reasons, "assumptions": p.assumptions,
            "profile_notes": est.notes, "months_observed": est.months_observed,
        },
        txn_id=txn_id,
    )
    return alloc_id, p
