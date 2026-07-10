"""뱅크 플로우 — 입금 1건이 파이프라인 전체를 관통하는 오케스트레이션 (코드가 흐름 제어).

입금 → ⓪태그 사전 → ①분류(룰→LLM 배심원단) → 원장 기록 → (income이면)
②저장된 이력으로 프로필·컨텍스트(수주 주기·커리어 추세·조정 성향) 산출 →
③이번 달 잔액 기준 배분 제안 → 승인 대기.
"""
from __future__ import annotations

import statistics
from dataclasses import replace

from app.engines import allocation_policy, allocator, classifier, forecast, gig_profile, income_streams, product_match, spending_profile
from app.agents import classifier_llm
from app.profile import build_user_profile
from app.engines import facts as facts_svc
from app.engines.allocator import AllocationContext, AllocationProposal, EnvelopeBalances
from app.engines.classifier import Classification, TxnInput
from app.engines.spending_profile import ProfileEstimate, Txn
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
        if t["kind"] in ("income", "expense", "living") and not t["needs_review"]
    ]  # 미확정 라벨은 프로필 통계에서 제외 — 확인 후에만 반영
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


def _income_txns() -> list[dict]:
    """확정 income 거래만 — 미확정 라벨은 어떤 통계에도 못 들어간다 (원칙)."""
    return [
        t for t in db.list_txns()
        if t["kind"] == "income" and t["direction"] == "in" and not t["needs_review"]
    ]


def has_confirmed_incoming() -> bool:
    """확정 예정 수입이 있는가 — 코치에게 알린 미래 예정 수입 또는 미결 잔금(착수금 관측).

    비상금대출(신용상품)은 '갚을 근거'가 있을 때만 권한다(준모 피드백) — 돈 없다고 바로
    대출을 연결하면 부채 유도라, 확정 예정 수입이 있어 공백만 메우면 되는 상황으로 제한.
    """
    income = _income_txns()
    as_of = max((t["date"] for t in db.list_txns()), default=None)
    future_events = [e for e in db.list_expected_events() if not as_of or e["date"] > as_of]
    if future_events:
        return True
    streams = income_streams.decompose(income, as_of=as_of)
    return bool(streams.pending_settlements)


def context_from_store() -> AllocationContext:
    """긱워커 배분 컨텍스트 — 프로필 SSOT에 위임한다 (coach_live·products가 배분과 같은 신호를 쓰게).

    수주 주기·커리어 추세·조정 성향에 더해 긱 구조(단일 의존)까지 한 곳에서 나온다 —
    이전엔 여기서 signals·gap을 따로 재계산했으나, 이제 build_user_profile이 상류를 1회만 돈다.
    """
    return build_user_profile().allocation_context()


def gig_archetype() -> str:
    """이 사용자의 긱워커 소득 유형 한 줄 — 배분·화면이 인용하는 긱 정체성 (결정론)."""
    income = _income_txns()
    facts = facts_svc.build_factsheet(db.list_txns(), db.list_allocations(), db.list_events())
    signals = forecast.career_signals(income)
    as_of = max((t["date"] for t in db.list_txns()), default=None)
    months = len({t["date"][:7] for t in db.list_txns()})
    streams = income_streams.decompose(income, months_observed=float(months), as_of=as_of)
    return gig_profile.build_gig_profile(facts, signals, streams).archetype


def propose_for_deposit(deposit: float, date: str, txn_id: str | None) -> tuple[str, AllocationProposal]:
    """저장된 프로필·컨텍스트·이번 달 배분 이력·버퍼 잔액 기준으로 제안 생성 후 DB 기록.

    프로필 전 조각(소득·긱·스트림·성향·행동)은 build_user_profile()이 원장 1회 읽기로
    합성한다 — 이전엔 est·ctx·gig·has_confirmed_incoming을 따로 불러 career_signals 2회·
    income_streams 3회·factsheet를 배분 핫패스에서 중복 계산했다. 값은 그대로다(특성화 테스트).

    버퍼 목표는 학습 배분 정책이 고른다(안전 분위수 — 페르소나 prior + 반응 사후분포).
    정책 기록은 meta["policy"]로 남아, 사람의 결정(승인/조정/거절)이 보상으로 귀속된다.
    """
    up = build_user_profile()
    est = up.spending
    allocated = db.month_allocated(date[:7])
    balances = EnvelopeBalances(
        expense=allocated["expense"],
        spendable=allocated["spendable"],
        buffer=db.envelope_balances()["buffer"],
    )
    ctx = up.allocation_context()
    policy = allocation_policy.choose(
        income_dates=list(up.income_dates),
        axes=up.persona_axes,
        income_cv=est.profile.income_cv,   # 공식(prior)은 policy가 스스로 계산 — 여기선 원자재만
    )
    ctx = replace(ctx, buffer_months_override=policy.months, buffer_months_reason=policy.reason)
    p = allocator.propose(deposit, est.profile, balances, ctx)
    alloc_id = db.insert_allocation(
        deposit,
        {"tax": p.tax, "expense": p.expense, "spendable": p.spendable, "buffer": p.buffer},
        meta={
            "buffer_target": p.buffer_target, "invest_available": p.invest_available,
            "windfall_ratio": p.windfall_ratio, "needs_confirmation": p.needs_confirmation,
            "reasons": p.reasons, "assumptions": p.assumptions,
            "profile_notes": est.notes, "months_observed": est.months_observed,
            "product_hooks": product_match.hooks_for(p, ctx, up.has_confirmed_incoming),
            "policy": policy.as_dict(),
            "gig_archetype": up.gig_archetype,   # 배분 시트가 앞세울 긱 정체성
        },
        txn_id=txn_id,
    )
    return alloc_id, p
