"""뱅크 라우트 — 거래 원장·입금 플로우·수기 태그·봉투 조회 (가계부 화면의 데이터 소스)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.api.routes.allocations import to_response
from app.core.config import settings
from app.schemas.bank import (
    ClarifyOut,
    DepositRequest,
    DepositResponse,
    EnvelopesResponse,
    TagRequest,
    TagResponse,
    TxnOut,
)
from app.orchestration import bank_flow
from app.agents import clarify
from app.engines import tax_envelope
from app.engines.classifier import TxnInput
from app.store import db
from app.store.seed import ensure_seed

router = APIRouter(prefix="/v1/bank", tags=["bank"])


def _boot() -> None:
    db.init_db()
    if settings.demo_seed:
        ensure_seed()


@router.post("/deposit", response_model=DepositResponse)
def deposit(req: DepositRequest) -> DepositResponse:
    """입금 도착 → 사전→룰→(LLM) 분류 → 원장 기록 → income 확정이면 배분 제안까지."""
    _boot()
    txn_in = TxnInput(date=req.date, amount=req.amount, direction="in",
                      counterparty=req.counterparty, memo=req.memo)
    c = bank_flow.classify_cascade(txn_in, llm_fallback=req.llm_fallback)
    txn_id = db.insert_txn(
        date=req.date, amount=req.amount, direction="in",
        counterparty=req.counterparty, memo=req.memo,
        kind=c.kind, subtype=c.subtype, confidence=c.confidence,
        needs_review=c.needs_review, signals=c.signals,
    )
    allocation = None
    question = None
    if c.kind == "income" and not c.needs_review:
        alloc_id, _ = bank_flow.propose_for_deposit(req.amount, req.date, txn_id)
        allocation = to_response(db.get_allocation(alloc_id))  # type: ignore[arg-type]
    elif c.needs_review:
        # 코치의 확인 게이트: "확인해주세요"가 아니라 해소에 필요한 질문 하나를 만들어 건넨다
        q = clarify.make_question(req.amount, req.counterparty, req.memo, c.signals)
        question = ClarifyOut(**q.__dict__)
    # 행동 계측 — 사건을 이벤트 로그에 (어젠다 큐 겸용: 미발화 행을 PR D 코치가 소비)
    db.log_event("deposit_received", ref_id=txn_id, payload={
        "amount": req.amount, "kind": c.kind, "needs_review": c.needs_review,
    })
    return DepositResponse(transaction=TxnOut(**db.get_txn(txn_id)), allocation=allocation, clarify=question)  # type: ignore[arg-type]


@router.get("/transactions", response_model=list[TxnOut])
def transactions() -> list[TxnOut]:
    _boot()
    verified_ids = {
        event.get("ref_id") for event in db.list_events("career_job_verified")
        if event.get("ref_id")
    }
    return [TxnOut(**t, verified_career_job=t["id"] in verified_ids) for t in db.list_txns()]


@router.post("/transactions/{txn_id}/tag", response_model=TagResponse)
def tag(txn_id: str, req: TagRequest) -> TagResponse:
    """수기 태그 — 원장 확정 + 사전 학습(같은 상대는 다음부터 자동) + income이면 배분 제안."""
    _boot()
    txn = db.get_txn(txn_id)
    if txn is None:
        raise HTTPException(status_code=404, detail="transaction not found")
    db.tag_txn(txn_id, req.kind, req.subtype)
    db.dict_learn(txn["counterparty"], req.kind, req.subtype)  # 피드백 루프 — 라벨이 곧 학습
    # 행동 계측 — 태깅 리듬(참여·성실 축)은 이 타임스탬프에서만 잴 수 있다
    db.log_event("txn_tagged", ref_id=txn_id, payload={"kind": req.kind})
    allocation = None
    if req.kind == "income" and txn["direction"] == "in":
        alloc_id, _ = bank_flow.propose_for_deposit(txn["amount"], txn["date"], txn_id)
        allocation = to_response(db.get_allocation(alloc_id))  # type: ignore[arg-type]
    return TagResponse(transaction=TxnOut(**db.get_txn(txn_id)), learned=True, allocation=allocation)  # type: ignore[arg-type]


@router.get("/transactions/{txn_id}/clarify", response_model=ClarifyOut)
def txn_clarify(txn_id: str) -> ClarifyOut:
    """미분류(needs_review) 거래의 해소 질문 — 가계부 행·코치 챗이 같은 질문을 쓴다."""
    _boot()
    txn = db.get_txn(txn_id)
    if txn is None:
        raise HTTPException(status_code=404, detail="transaction not found")
    if not txn["needs_review"]:
        raise HTTPException(status_code=409, detail="transaction is already classified")
    q = clarify.make_question(txn["amount"], txn["counterparty"], txn["memo"], txn["signals"])
    return ClarifyOut(**q.__dict__)


@router.get("/envelopes", response_model=EnvelopesResponse)
def envelopes() -> EnvelopesResponse:
    """봉투 잔액 + 이번 달 배분 + 종소세 준비 진행 — 자동 봉투 화면의 데이터 소스."""
    _boot()
    balances = db.envelope_balances()
    est = bank_flow.profile_from_store()
    annual = tax_envelope.estimate_annual_tax(est.profile.annual_gross)
    expected = max(0.0, annual.additional_due)
    prepared = balances.get("tax", 0.0)
    latest = db.list_txns()
    month = latest[0]["date"][:7] if latest else "1970-01"
    return EnvelopesResponse(
        balances=balances,
        month_allocated=db.month_allocated(month),
        annual_tax_expected=round(expected, 2),
        tax_prepared=round(prepared, 2),
        tax_shortfall=round(max(0.0, expected - prepared), 2),
    )
