"""피기 코치 라우트 — '대화'의 오케스트레이터 (PR D). 흐름은 코드, 판단은 에이전트, 말은 코치.

챗 1건의 흐름(전부 코드 분기 — LLM은 각 단계의 판정만):
1) ⑧ 인텐트 라우터 — 이 말이 무엇을 원하는가 (룰 → 2.4B 캐스케이드)
2) 라이브 컨텍스트 — 결정론 엔진들의 지금 상태를 조립해 주입 (정적 컨텍스트 갭 제거)
3) report_income이면 예정 수입 파서 — 잡히면 저장, **못 잡으면 되묻는다** (조용한 무시 제거)
4) ⑨ 피기 발화 — 숫자 검증기 통과분만 사용자에게

어젠다 큐: 이벤트 로그의 미발화 행 → 트리아지(코드 룰) → 벨 인박스.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.agents import intent_router
from app.api.routes.bank import _boot
from app.schemas.coach import CapturedEvent, CoachChatRequest, CoachChatResponse
from app.services import coach, coach_agenda, coach_live, event_capture
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

    # 1) ⑧ 인텐트 라우터 — 분기만 (라우팅된 처리도 전부 사람 승인 게이트를 거친다)
    decision = intent_router.route(req.message)

    # 2) 라이브 컨텍스트(서버 조립) 위에 프론트 컨텍스트를 오버레이 — 화면 특화 정보 보존
    context = coach_live.build(decision.intent)
    context.update(req.context or {})

    # 3) 예정 수입 파서 — report_income으로 라우팅된 발화만 (흐름은 코드)
    captured = None
    parse_missed = False
    if decision.intent == "report_income":
        ev = event_capture.capture(req.message, today=_today_ref())
        if ev is not None:
            db.insert_expected_event(ev.date, ev.amount, ev.label)
            captured = CapturedEvent(date=ev.date, amount=ev.amount, label=ev.label)
            context["captured_event"] = {
                "label": captured.label, "date": captured.date, "amount": captured.amount,
                "note": "방금 사용자가 알려준 예정 수입 — 다음 수입 예측에 반영됨",
            }
        else:
            parse_missed = True   # 수입 보고 같은데 파서가 못 잡음 — 침묵 대신 되묻는다

    result = coach.chat(req.message, context or None)
    reply = result.reply
    signals = list(result.signals) + [decision.signal]

    if captured is not None:
        amount_txt = f" {captured.amount:,.0f}원" if captured.amount else ""
        # 확인 문장은 결정론 템플릿 — 숫자검증과 무관하게 안전
        reply += (
            f"\n\n📌 '{captured.label}'{amount_txt} ({captured.date}) — 예정 수입으로 "
            "기억해둘게요. 다음 수입 예측에 반영돼요."
        )
    elif parse_missed:
        # 고아 ⑥ 해소 — 파싱 실패의 조용한 무시 제거 (되묻기도 결정론 템플릿)
        reply += (
            "\n\n📌 들어올 돈 이야기 같은데 제가 금액이나 날짜를 정확히 못 잡았어요 — "
            "\"다음 주에 잔금 200만원\"처럼 한 번만 다시 알려주실래요?"
        )
        signals.append("예정 수입 파싱 실패 → 되묻기 (조용한 무시 제거)")

    return CoachChatResponse(
        reply=reply, source=result.source, verified=result.verified,
        signals=signals, captured_event=captured, intent=decision.as_dict(),
    )


@router.get("/agenda")
def agenda() -> dict:
    """벨 인박스 — 피기가 아직 말하지 않은 사건의 트리아지 결과 (조회만, 큐 안 비움)."""
    _boot()
    items, silent_ids = coach_agenda.build()
    return {
        "items": [i.as_dict() for i in items],
        "silent_count": len(silent_ids),
        "note": "발화문은 결정론 템플릿 — 소비(spoken 처리)는 POST /agenda/consume",
    }


@router.post("/agenda/consume")
def consume_agenda() -> dict:
    """벨 열람 — 어젠다 항목과 침묵 이벤트를 spoken 처리 (사람이 봤다는 사실의 기록)."""
    _boot()
    items, silent_ids = coach_agenda.build()
    consumed = 0
    for item in items:
        for eid in item.event_ids:
            db.mark_spoken(eid)
            consumed += 1
    for eid in silent_ids:
        db.mark_spoken(eid)
    return {"consumed": consumed, "silenced": len(silent_ids),
            "items": [i.as_dict() for i in items]}
