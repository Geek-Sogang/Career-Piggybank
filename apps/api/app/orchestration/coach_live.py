"""코치 라이브 컨텍스트 — 결정론 엔진들의 현재 출력을 모아 피기의 눈을 만든다.

PR D의 심장: 프론트가 정적 컨텍스트를 보내지 않아도(DEMO_COACH_CONTEXT 갭),
서버가 원장·배분·예측·페르소나의 **지금 상태**를 조립해 코치에 주입한다.

여기는 수집·조립만 한다 — 계산은 각 엔진(전부 결정론), 판단은 에이전트, 말은 코치.
전수 감사에서 나온 고아 출력 6건이 전부 여기서 사용자에게 닿는 경로를 얻는다:
① 잔금 지연 질문(stale_settlements) ② 스트림 근거(streams.reasons)
③ 프로필 노트(profile.notes) ④ 미분류 행(tag 인텐트 컨텍스트)
⑤ 세금 부족분(tax_shortfall) — ⑥ 파싱 실패 되묻기는 라우트가 담당.
"""
from __future__ import annotations

from app.orchestration import bank_flow
from app.engines import income_streams, tax_envelope
from app.profile import build_user_profile
from app.store import db


def _income_txns(txns: list[dict]) -> list[dict]:
    return [t for t in txns if t["kind"] == "income" and t["direction"] == "in"
            and not t["needs_review"]]


def build(intent: str = "qa") -> dict:
    """지금 이 순간의 결정론 상태 → 코치 컨텍스트 dict (순수 읽기).

    공통 코어는 항상 싣고, 인텐트별 상세(미분류 행·상품 후보·배분 상태)는
    필요한 분기에만 싣는다 — 컨텍스트 비대는 숫자 검증기의 감도만 떨어뜨린다.
    """
    txns = db.list_txns()
    balances = db.envelope_balances()
    est = bank_flow.profile_from_store()
    up = build_user_profile()

    ctx: dict = {"balances": {k: round(v, 2) for k, v in balances.items()}}

    # ⑤ 세금 부족분 — 예상 종소세 대비 세금봉투가 얼마나 비었나 (felt pain #1)
    annual = tax_envelope.estimate_annual_tax(est.profile.annual_gross)
    expected = max(0.0, annual.additional_due)
    ctx["tax"] = {
        "expected_annual": round(expected, 2),
        "prepared": round(balances.get("tax", 0.0), 2),
        "shortfall": round(max(0.0, expected - balances.get("tax", 0.0)), 2),
    }

    # ③ 프로필 노트 — 예측기가 남긴 관측 한계·프리셋 사용 사실 (정직의 근거)
    if est.notes:
        ctx["profile_notes"] = list(est.notes)

    # ①·② 소득 스트림 — 물줄기 근거와 지연 계약 질문 (예측을 오염시키는 대신 질문이 된다)
    incomes = _income_txns(txns)
    if incomes:
        as_of = max(t["date"] for t in txns)
        streams = income_streams.decompose(
            incomes, months_observed=float(est.months_observed),
            user_events=[e for e in db.list_expected_events()
                         if e["date"] > max(t["date"] for t in incomes)],
            as_of=as_of,
        )
        if streams.reasons:
            ctx["income_stream_notes"] = list(streams.reasons)
        if streams.stale_settlements:
            ctx["stale_questions"] = [
                {"counterparty": s.counterparty, "advance_date": s.advance_date,
                 "advance_amount": s.advance_amount, "question": s.question}
                for s in streams.stale_settlements
            ]

    # 페르소나 — 축 + 신선도 (stale이면 코치가 재판독을 권할 수 있다)
    if up.persona_axes:
        ctx["persona"] = {
            "axes": {k: a.get("value") for k, a in up.persona_axes.items()},
            "staleness": up.persona_staleness,
            "used": True,
        }
    elif up.persona_staleness:
        ctx["persona"] = {"axes": {}, "staleness": up.persona_staleness, "used": False}

    # 인텐트별 상세 — 분기한 곳만 (실행은 전부 화면의 승인 게이트로)
    if intent == "adjust_allocation":
        allocs = db.list_allocations()
        if allocs:
            latest = allocs[-1]
            ctx["latest_allocation"] = {
                "status": latest["status"], "deposit": latest["deposit"],
                "proposed": latest["proposed"],
                "reasons": latest["meta"].get("reasons", [])[:5],
            }
        ctx["note_adjust"] = "조정은 배분 시트에서 — 코치는 근거 설명까지, 실행은 승인 게이트"

    if intent == "tag_txn":
        pending = [t for t in txns if t["needs_review"]][:5]
        ctx["untagged_txns"] = [
            {"id": t["id"], "date": t["date"], "amount": t["amount"],
             "counterparty": t["counterparty"]}
            for t in pending
        ]
        ctx["note_tag"] = "태그를 달면 다음부터 자동 분류돼요 (개인 태그 사전 학습)"

    if intent == "ask_products":
        # ⑥의 결정론 층만 인용 — 적합성 veto 통과 후보와 차단 사유 (LLM 선택은 상품 탭에서)
        from app.engines import product_match
        allocs = db.list_allocations()
        invest_available = float(allocs[-1]["meta"].get("invest_available", 0.0)) if allocs else 0.0
        candidates, vetoed = product_match.eligible(
            invest_available, balances.get("tax", 0.0), up.allocation_context(),
            up.has_confirmed_incoming, verified_credit_limit=up.career.limit,
        )
        ctx["product_candidates"] = [c.as_dict() for c in candidates]
        if vetoed:
            ctx["product_vetoed"] = vetoed

    return ctx
