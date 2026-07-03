"""뱅크 라우트 — 거래 원장·입금 플로우·수기 태그·봉투 조회 (가계부 화면의 데이터 소스)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.api.routes.allocations import to_response
from app.core.config import settings
from app.schemas.bank import (
    DepositRequest,
    DepositResponse,
    EnvelopesResponse,
    TagRequest,
    TagResponse,
    TxnOut,
)
from app.services import bank_flow, tax_envelope
from app.services.classifier import TxnInput
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
    if c.kind == "income" and not c.needs_review:
        alloc_id, _ = bank_flow.propose_for_deposit(req.amount, req.date, txn_id)
        allocation = to_response(db.get_allocation(alloc_id))  # type: ignore[arg-type]
    return DepositResponse(transaction=TxnOut(**db.get_txn(txn_id)), allocation=allocation)  # type: ignore[arg-type]


@router.get("/transactions", response_model=list[TxnOut])
def transactions() -> list[TxnOut]:
    _boot()
    return [TxnOut(**t) for t in db.list_txns()]


@router.post("/transactions/{txn_id}/tag", response_model=TagResponse)
def tag(txn_id: str, req: TagRequest) -> TagResponse:
    """수기 태그 — 원장 확정 + 사전 학습(같은 상대는 다음부터 자동) + income이면 배분 제안."""
    _boot()
    txn = db.get_txn(txn_id)
    if txn is None:
        raise HTTPException(status_code=404, detail="transaction not found")
    db.tag_txn(txn_id, req.kind, req.subtype)
    db.dict_learn(txn["counterparty"], req.kind, req.subtype)  # 피드백 루프 — 라벨이 곧 학습
    allocation = None
    if req.kind == "income" and txn["direction"] == "in":
        alloc_id, _ = bank_flow.propose_for_deposit(txn["amount"], txn["date"], txn_id)
        allocation = to_response(db.get_allocation(alloc_id))  # type: ignore[arg-type]
    return TagResponse(transaction=TxnOut(**db.get_txn(txn_id)), learned=True, allocation=allocation)  # type: ignore[arg-type]


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
