"""피기 코치 라우트 — 말만 한다. 계산·분류·배분·실행은 각자의 엔진 몫.

챗 메시지는 코치가 답하기 전에 **예정 수입 파서**를 먼저 통과한다(오케스트레이션 = 코드):
"다음 주에 잔금 200만원 들어와요" → 검증(금액 접지·미래 날짜) → expected_events 저장 →
예측 엔진(스트림 분해)이 다음 수입 후보로 반영. 모델이 못 보는 미래를 대화가 메운다(§6-2⑥).
"""
from __future__ import annotations

from fastapi import APIRouter

from app.api.routes.bank import _boot
from app.schemas.coach import CapturedEvent, CoachChatRequest, CoachChatResponse
from app.services import coach, event_capture
from app.store import db

router = APIRouter(prefix="/v1/coach", tags=["coach"])


def _today_ref() -> str:
    """상대 날짜('다음 주') 환산 기준일 — 데모 원장의 최신 거래일 (원장 시간대와 정합)."""
    txns = db.list_txns()
    return max(t["date"] for t in txns) if txns else "2025-05-27"


@router.post("/chat", response_model=CoachChatResponse)
def chat(req: CoachChatRequest) -> CoachChatResponse:
    """코치 대화 — 응답 숫자는 결정론 검증기로 컨텍스트 근거를 확인한다."""
    _boot()

    # 예정 수입 파서 (판단 에이전트) — 잡히면 저장하고 코치 컨텍스트에 주입
    captured = None
    ev = event_capture.capture(req.message, today=_today_ref())
    if ev is not None:
        db.insert_expected_event(ev.date, ev.amount, ev.label)
        captured = CapturedEvent(date=ev.date, amount=ev.amount, label=ev.label)

    context = dict(req.context or {})
    if captured is not None:
        context["captured_event"] = {
            "label": captured.label, "date": captured.date, "amount": captured.amount,
            "note": "방금 사용자가 알려준 예정 수입 — 다음 수입 예측에 반영됨",
        }

    result = coach.chat(req.message, context or None)
    reply = result.reply
    if captured is not None:
        amount_txt = f" {captured.amount:,.0f}원" if captured.amount else ""
        # 확인 문장은 결정론 템플릿 — 숫자검증과 무관하게 안전
        reply += (
            f"\n\n📌 '{captured.label}'{amount_txt} ({captured.date}) — 예정 수입으로 "
            "기억해둘게요. 다음 수입 예측에 반영돼요."
        )
    return CoachChatResponse(
        reply=reply, source=result.source, verified=result.verified,
        signals=result.signals, captured_event=captured,
    )
