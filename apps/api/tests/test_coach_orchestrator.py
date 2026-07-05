"""PR D 테스트 — ⑧ 인텐트 라우터·라이브 컨텍스트·어젠다 큐·파싱 실패 되묻기.

핵심 불변식:
- 라우터는 분기만 — 메뉴(인텐트 enum) 밖 라벨은 폐기, LLM 다운이면 qa 폴백
- 라이브 컨텍스트에 고아 출력(프로필 노트·스트림 근거·tax_shortfall)이 실린다
- 어젠다: 조정/거절 → 후속 질문, 저신호는 침묵, consume해야 큐가 빈다
- report_income인데 파서가 못 잡으면 조용히 무시하지 않고 되묻는다
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.agents import intent_router
from app.main import app
from app.services import coach_agenda, coach_live
from app.services import coach as coach_svc
from app.services import event_capture
from app.store import db

client = TestClient(app)


def _seed_ledger():
    rows = [
        ("2025-02-10", 1_000_000, "in", "크몽", "income"),
        ("2025-03-12", 1_200_000, "in", "위시켓", "income"),
        ("2025-04-11", 1_100_000, "in", "크몽", "income"),
        ("2025-04-15", 300_000, "out", "생활", "living"),
    ]
    for date, amount, direction, cp, kind in rows:
        db.insert_txn(date=date, amount=amount, direction=direction, counterparty=cp,
                      memo="", kind=kind, subtype=None, confidence=0.9,
                      needs_review=False, signals=[])


# ── ⑧ 인텐트 라우터 ──

def test_rule_layer_routes_obvious_messages():
    """명백한 신호는 룰이 즉답 — LLM 호출 없음 (캐스케이드 1층)."""
    cases = {
        "다음 주에 잔금 200만원 들어와요": "report_income",
        "버퍼를 좀 줄이고 싶어요": "adjust_allocation",
        "이 거래 분류 정정해줘": "tag_txn",
        "파킹통장 추천해줘": "ask_products",
    }
    for msg, expected in cases.items():
        d = intent_router.route(msg)
        assert d.intent == expected and d.source == "rule", (msg, d)


def test_llm_layer_menu_gate(monkeypatch):
    """룰 미매치 → 2.4B. 메뉴 밖 라벨은 폐기하고 qa 폴백."""
    monkeypatch.setattr(intent_router.llm, "chat_json",
                        lambda *a, **k: {"intent": "buy_stocks"})
    d = intent_router.route("음 그게 있잖아요")
    assert d.intent == "qa" and d.source == "fallback"

    monkeypatch.setattr(intent_router.llm, "chat_json",
                        lambda *a, **k: {"intent": "ask_products"})
    d = intent_router.route("음 그게 있잖아요")
    assert d.intent == "ask_products" and d.source == "llm"


def test_llm_down_falls_back_to_qa(monkeypatch):
    monkeypatch.setattr(intent_router.llm, "chat_json", lambda *a, **k: None)
    d = intent_router.route("요즘 어때요")
    assert d.intent == "qa" and d.source == "fallback"


# ── 라이브 컨텍스트 (고아 연결) ──

def test_live_context_carries_orphan_outputs():
    """프로필 노트·스트림 근거·tax_shortfall이 컨텍스트에 실린다 — 고아 ②③⑤."""
    _seed_ledger()
    ctx = coach_live.build("qa")
    assert "balances" in ctx
    assert "shortfall" in ctx["tax"]                     # ⑤ tax_shortfall
    assert ctx.get("profile_notes") or ctx.get("income_stream_notes")  # ③·②


def test_live_context_intent_details():
    """인텐트별 상세 — tag_txn엔 미분류 행, ask_products엔 적합성 후보."""
    _seed_ledger()
    db.insert_txn(date="2025-04-20", amount=50_000, direction="in", counterparty="카카오페이",
                  memo="", kind="unknown", subtype=None, confidence=0.3,
                  needs_review=True, signals=[])
    ctx = coach_live.build("tag_txn")
    assert ctx["untagged_txns"] and ctx["untagged_txns"][0]["counterparty"] == "카카오페이"

    ctx = coach_live.build("ask_products")
    assert {c["product_id"] for c in ctx["product_candidates"]} >= {"parking"}


# ── 어젠다 큐 (트리아지 → 벨 인박스 → consume) ──

def test_agenda_adjust_becomes_follow_up_question():
    """조정 결정 → 후속 질문 (행동축 플라이휠 입구), 저신호는 침묵."""
    # action은 결정 라우트가 기록하는 요청 동사 그대로 — "adjust" (라이브 검증에서 잡은 표기)
    db.log_event("allocation_decided", ref_id="a1",
                 payload={"action": "adjust", "buffer_delta": 50_000.0})
    db.log_event("txn_tagged", ref_id="t1", payload={"kind": "living"})
    items, silent = coach_agenda.build()
    kinds = [i.kind for i in items]
    assert "follow_up_adjust" in kinds
    follow = next(i for i in items if i.kind == "follow_up_adjust")
    assert "50,000" in follow.line and "늘리" in follow.line
    assert len(silent) == 1   # txn_tagged는 침묵


def test_agenda_deposits_are_bundled():
    """입금 여러 건 → 브리핑 1건 (알림 폭주 금지), 총액은 payload 인용."""
    db.log_event("deposit_received", ref_id="t1", payload={"amount": 1_000_000})
    db.log_event("deposit_received", ref_id="t2", payload={"amount": 500_000})
    items, _ = coach_agenda.build()
    briefings = [i for i in items if i.kind == "deposit_briefing"]
    assert len(briefings) == 1
    assert "2건" in briefings[0].line and "1,500,000" in briefings[0].line


def test_agenda_consume_empties_queue():
    """consume 후 unspoken이 빈다 — 벨 열람 = 사람이 봤다는 기록."""
    _seed_ledger()
    db.log_event("allocation_decided", ref_id="a1",
                 payload={"action": "reject", "buffer_delta": 0.0})
    db.log_event("goal_created", ref_id="g1", payload={})
    r = client.get("/v1/coach/agenda")
    assert r.status_code == 200 and r.json()["items"]

    r = client.post("/v1/coach/agenda/consume")
    assert r.status_code == 200 and r.json()["consumed"] >= 1
    assert db.unspoken_events() == []


# ── 챗 E2E (LLM은 monkeypatch — 흐름 검증) ──

def test_chat_report_income_parse_miss_asks_back(monkeypatch):
    """report_income인데 파서 실패 → 되묻기 (고아 ⑥: 조용한 무시 제거)."""
    _seed_ledger()
    monkeypatch.setattr(event_capture, "capture", lambda *a, **k: None)
    monkeypatch.setattr(coach_svc.llm, "chat_text", lambda *a, **k: "네, 알겠어요!")
    r = client.post("/v1/coach/chat", json={"message": "다음 주에 잔금 들어와요"})
    body = r.json()
    assert body["intent"]["intent"] == "report_income"
    assert "다시 알려주실래요" in body["reply"]


def test_chat_qa_gets_live_context(monkeypatch):
    """컨텍스트 없이 물어도 서버가 라이브 컨텍스트를 조립해 코치에 준다 (정적 갭 제거)."""
    _seed_ledger()
    seen: dict = {}

    def fake_chat(message, context=None):
        seen["context"] = context
        return coach_svc.CoachReply(reply="봉투 잔액을 보면요…", source="llm",
                                    verified=True, signals=[])

    monkeypatch.setattr(coach_svc, "chat", fake_chat)
    monkeypatch.setattr(intent_router.llm, "chat_json", lambda *a, **k: {"intent": "qa"})
    r = client.post("/v1/coach/chat", json={"message": "제 상황 어때요?"})
    assert r.status_code == 200
    assert "balances" in seen["context"] and "tax" in seen["context"]
    assert r.json()["intent"]["intent"] == "qa"
