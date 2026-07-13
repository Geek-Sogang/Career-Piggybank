"""거래 분류 라우트 — 라벨+확신도+근거만 반환 (배분·예측은 하지 않는다)."""
from __future__ import annotations

from fastapi import APIRouter

from app.schemas.classify import ClassificationOut, ClassifyRequest, ClassifyResponse
from app.engines import classifier
from app.agents import classifier_llm
from app.engines.classifier import TxnInput

router = APIRouter(prefix="/v1/classify", tags=["classify"])


@router.post("", response_model=ClassifyResponse)
def classify_batch(req: ClassifyRequest) -> ClassifyResponse:
    """거래 배치 분류 — 결정론 캐스케이드, llm_fallback=True면 unknown만 로컬 LLM."""
    fn = classifier_llm.classify_with_fallback if req.llm_fallback else classifier.classify
    results = [
        fn(
            TxnInput(
                date=t.date, amount=t.amount, direction=t.direction,
                counterparty=t.counterparty, memo=t.memo,
            )
        )
        for t in req.transactions
    ]
    outs = [ClassificationOut(**r.__dict__) for r in results]
    return ClassifyResponse(results=outs, review_count=sum(r.needs_review for r in results))
