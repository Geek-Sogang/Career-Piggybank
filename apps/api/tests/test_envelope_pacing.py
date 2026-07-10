"""봉투 개인화 테스트 (PR C) — 추천(⑤a)·페이싱(⑤b)·번역 엔진·확인 게이트.

핵심 불변식:
- 페이싱 합계 == 슬라이스 (남는 건 전부 버퍼 — 반올림 흡수)
- 버퍼 부족분이 목표보다 먼저 (가뭄 보호가 목표 저축에 앞선다)
- 에이전트 게이트: 순열·메뉴·접지 — 실패는 산수 폴백 (페이싱은 항상 산다)
- 확인 게이트: confirm만 잔액 이동, reject는 1원도 안 움직임
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.agents import amount_pacing, envelope_recommend
from app.main import app
from app.engines import facts as facts_svc
from app.engines import pacing as pacing_svc
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


def _facts():
    return facts_svc.build_factsheet(db.list_txns(), db.list_allocations(), db.list_events())


# ── 번역 엔진 (결정론 — LLM 없음) ──

def test_translate_preserves_sum_and_protects_buffer_first():
    goals = [
        {"id": "g1", "name": "새 맥북", "target_amount": 2_400_000, "balance": 0,
         "target_date": "2025-08-01", "seq": 1},
        {"id": "g2", "name": "일 없는 달", "target_amount": 1_000_000, "balance": 500_000,
         "target_date": None, "seq": 2},
    ]
    plan = pacing_svc.translate(
        available=1_000_000, goals=goals, priorities=["g1", "g2"],
        stances={"g1": "기본", "g2": "보류"},
        buffer_shortfall=300_000, today="2025-05-01", gap_days=30.0,
    )
    split = plan.split()
    assert round(sum(split.values()), 2) == 1_000_000          # 합계 보존
    assert plan.buffer_first == 300_000                        # 버퍼 부족분 먼저
    g1 = next(g for g in plan.goals if g.goal_id == "g1")
    # 기한까지 92일 / 간격 30일 → 입금 3회 → 기본 페이스 800,000
    # 단, 버퍼 보호 후 남은 700,000이 상한 — 슬라이스보다 큰 배분은 불가능
    assert g1.base == 800_000 and g1.amount == 700_000
    g2 = next(g for g in plan.goals if g.goal_id == "g2")
    assert g2.amount == 0                                      # 보류 = ×0


def test_translate_caps_at_goal_room_and_available():
    # 기한 임박(입금 1회 남음) → 기본 페이스 = 잔여 전액 → 당김 ×1.5가 room에 캡
    goals = [{"id": "g1", "name": "소액 목표", "target_amount": 100_000, "balance": 90_000,
              "target_date": "2025-05-10", "seq": 1}]
    plan = pacing_svc.translate(50_000, goals, ["g1"], {"g1": "당김"},
                                buffer_shortfall=0, today="2025-05-01", gap_days=30.0)
    g1 = plan.goals[0]
    assert g1.base == 10_000
    assert g1.amount == 10_000                                 # 목표 잔여가 상한 (×1.5여도)
    assert plan.split()["buffer"] == 40_000                    # 나머지는 버퍼로


def test_deposits_until_uses_income_rhythm():
    assert pacing_svc.deposits_until("2025-08-01", "2025-05-01", 30.0) == 3
    assert pacing_svc.deposits_until(None, "2025-05-01", 30.0) == pacing_svc.DEFAULT_PACING_DEPOSITS
    assert pacing_svc.deposits_until("2025-04-01", "2025-05-01", 30.0) == 1   # 기한 지남 → 최소 1


# ── ⑤b 페이싱 판단 게이트 ──

def _goals_db():
    g1 = db.insert_goal("새 맥북", 2_400_000, "2025-08-01")
    g2 = db.insert_goal("일 없는 달", 1_000_000, None)
    return g1, g2


def test_pacing_judge_happy_path(monkeypatch):
    _seed_ledger()
    g1, g2 = _goals_db()
    monkeypatch.setattr(amount_pacing.llm, "chat_json", lambda *a, **k: {
        "priorities": [g2, g1], "stances": {g1: "보류", g2: "당김"},
        "evidence": ["F01"], "reason": "변동이 커서 안전 목표 먼저",
    })
    j = amount_pacing.judge(db.list_goals(), _facts(), None)
    assert not j.fallback
    assert j.priorities == (g2, g1)
    assert j.stances[g1] == "보류"


def test_pacing_gate_rejects_bad_permutation(monkeypatch):
    _seed_ledger()
    g1, g2 = _goals_db()
    monkeypatch.setattr(amount_pacing.llm, "chat_json", lambda *a, **k: {
        "priorities": [g1], "stances": {g1: "기본", g2: "기본"},
        "evidence": [], "reason": "",
    })
    j = amount_pacing.judge(db.list_goals(), _facts(), None)
    assert j.fallback and "priorities_not_permutation" in j.gate_failures
    assert set(j.priorities) == {g1, g2}                       # 폴백도 완전한 순열


def test_pacing_gate_rejects_menu_violation(monkeypatch):
    _seed_ledger()
    g1, g2 = _goals_db()
    monkeypatch.setattr(amount_pacing.llm, "chat_json", lambda *a, **k: {
        "priorities": [g1, g2], "stances": {g1: "빨리", g2: "기본"},
        "evidence": [], "reason": "",
    })
    j = amount_pacing.judge(db.list_goals(), _facts(), None)
    assert j.fallback and any(f.startswith("stance_menu") for f in j.gate_failures)


def test_pacing_llm_down_arithmetic_fallback(monkeypatch):
    _seed_ledger()
    g1, g2 = _goals_db()
    monkeypatch.setattr(amount_pacing.llm, "chat_json", lambda *a, **k: None)
    j = amount_pacing.judge(db.list_goals(), _facts(), None)
    assert j.fallback
    assert j.priorities[0] == g1                                # 기한 임박순 (g1만 기한 있음)
    assert all(s == "기본" for s in j.stances.values())


def test_pacing_corrective_retry_rescues(monkeypatch):
    """1차 스탠스 메뉴 위반 → 위반 명시 재시도 → 2차 정상이면 산수 폴백 대신 판단 채택."""
    _seed_ledger()
    g1, g2 = _goals_db()
    calls: list[str] = []

    def fake(system, user, **k):
        calls.append(user)
        if len(calls) == 1:
            return {"priorities": [g2, g1], "stances": {g1: "빨리", g2: "당김"},
                    "evidence": ["F01"], "reason": ""}          # '빨리'는 메뉴에 없음
        return {"priorities": [g2, g1], "stances": {g1: "보류", g2: "당김"},
                "evidence": ["F01"], "reason": "교정됨"}

    monkeypatch.setattr(amount_pacing.llm, "chat_json", fake)
    j = amount_pacing.judge(db.list_goals(), _facts(), None)
    assert not j.fallback and j.retried is True
    assert j.stances[g1] == "보류"
    assert "교정 재시도" in calls[1] and "빨리" in calls[1]     # 위반이 명시된 다른 입력


# ── ⑤a 추천 게이트 ──

def test_recommend_gates(monkeypatch):
    _seed_ledger()
    monkeypatch.setattr(envelope_recommend.llm, "chat_json", lambda *a, **k: {
        "recommendations": [
            {"name": "일 없는 달", "why": "수주 공백 대비", "evidence": ["F04"]},
            {"name": "세금 추가", "why": "잠긴 층 참칭", "evidence": ["F01"]},   # 차단
            {"name": "근거 없음", "why": "감으로", "evidence": []},              # 접지 폐기
            {"name": "유령 근거", "why": "지어냄", "evidence": ["F99"]},         # 접지 폐기
        ],
    })
    ideas = envelope_recommend.recommend(_facts(), None, [])
    assert [i.name for i in ideas] == ["일 없는 달"]
    assert ideas[0].evidence == ("F04",)


def test_recommend_llm_down_empty(monkeypatch):
    monkeypatch.setattr(envelope_recommend.llm, "chat_json", lambda *a, **k: None)
    assert envelope_recommend.recommend(_facts(), None, []) == []


def test_recommend_injects_gig_structure_into_prompt(monkeypatch):
    """긱 구조를 주면 프롬프트에 '긱 소득 구조' 블록이 실려 추천이 구조 인식으로 갈린다."""
    from app.engines.gig_profile import GigProfile
    gig = GigProfile(
        volatility="고변동", volatility_cv=1.1, concentration="단일 의존", top_source_share=0.62,
        rhythm="플랫폼 정기형", is_multi_gig=False, phase="감속 주의",
        archetype="고변동 · 단일 플랫폼 의존 — 가장 취약한 긱 구조라 버퍼가 생명줄",
    )
    seen = {}
    monkeypatch.setattr(envelope_recommend.llm, "chat_json",
                        lambda sys, user, **k: seen.update(prompt=user) or {"recommendations": []})
    envelope_recommend.recommend(_facts(), None, [], gig=gig)
    assert "긱 소득 구조" in seen["prompt"]
    assert "단일 의존" in seen["prompt"] and "고변동" in seen["prompt"]
    assert gig.archetype in seen["prompt"]


# ── 오케스트레이션 + 확인 게이트 (라이브 API) ──

def test_full_flow_confirm_moves_balances(monkeypatch):
    _seed_ledger()
    goal = client.post("/v1/envelopes/goals", json={
        "name": "새 맥북", "target_amount": 2_400_000, "target_date": "2025-08-01",
    }).json()
    monkeypatch.setattr(amount_pacing.llm, "chat_json", lambda *a, **k: {
        "priorities": [goal["id"]], "stances": {goal["id"]: "기본"},
        "evidence": ["F01"], "reason": "기한 목표 우선",
    })
    prop = client.post("/v1/pacing/propose", json={
        "available": 1_000_000, "buffer_shortfall": 200_000, "today": "2025-05-01",
    }).json()
    assert round(sum(prop["split"].values()), 2) == 1_000_000

    before = db.envelope_balances()["buffer"]
    res = client.post(f"/v1/pacing/{prop['id']}/decision", json={"action": "confirm"}).json()
    assert res["status"] == "confirmed"
    assert db.envelope_balances()["buffer"] - before == prop["split"]["buffer"]
    assert db.get_goal(goal["id"])["balance"] == prop["split"][goal["id"]]
    assert any(e["type"] == "pacing_decided" for e in db.list_events())


def test_buffer_source_rebalances_without_printing_money(monkeypatch):
    """source=buffer — 버퍼에 이미 있는 돈의 재배치: 목표↑ = 버퍼↓, 총액 보존 (새 돈 금지)."""
    _seed_ledger()
    db.envelope_set("buffer", 1_500_000)
    goal = client.post("/v1/envelopes/goals", json={
        "name": "새 맥북", "target_amount": 2_400_000, "target_date": "2025-08-01",
    }).json()
    monkeypatch.setattr(amount_pacing.llm, "chat_json", lambda *a, **k: None)  # 산수 폴백
    prop = client.post("/v1/pacing/propose", json={
        "available": 1_000_000, "buffer_shortfall": 0, "today": "2025-05-01", "source": "buffer",
    }).json()
    goal_slice = prop["split"][goal["id"]]
    assert goal_slice > 0

    before = db.envelope_balances()["buffer"]
    client.post(f"/v1/pacing/{prop['id']}/decision", json={"action": "confirm"})
    after = db.envelope_balances()["buffer"]
    assert round(before - after, 2) == round(goal_slice, 2)        # 버퍼는 목표로 간 만큼만 감소
    assert db.get_goal(goal["id"])["balance"] == goal_slice        # 총액 보존 — 화폐 발행 없음


def test_buffer_source_overdraft_guarded(monkeypatch):
    """버퍼 잔액보다 큰 available은 propose에서 422 — 없는 돈은 나눌 수 없다."""
    _seed_ledger()
    db.envelope_set("buffer", 100_000)
    client.post("/v1/envelopes/goals", json={"name": "새 맥북", "target_amount": 2_400_000})
    monkeypatch.setattr(amount_pacing.llm, "chat_json", lambda *a, **k: None)
    res = client.post("/v1/pacing/propose", json={
        "available": 1_000_000, "buffer_shortfall": 0, "today": "2025-05-01", "source": "buffer",
    })
    assert res.status_code == 422


def test_reject_moves_nothing(monkeypatch):
    _seed_ledger()
    goal = client.post("/v1/envelopes/goals", json={
        "name": "일 없는 달", "target_amount": 1_000_000,
    }).json()
    monkeypatch.setattr(amount_pacing.llm, "chat_json", lambda *a, **k: None)  # 폴백 경로
    prop = client.post("/v1/pacing/propose", json={
        "available": 500_000, "buffer_shortfall": 0, "today": "2025-05-01",
    }).json()
    assert prop["judgment"]["fallback"] is True                # 판단 죽어도 제안은 산다

    before = db.envelope_balances()["buffer"]
    client.post(f"/v1/pacing/{prop['id']}/decision", json={"action": "reject"})
    assert db.envelope_balances()["buffer"] == before          # 1원도 안 움직임
    assert db.get_goal(goal["id"])["balance"] == 0


def test_goal_creation_is_human_action():
    body = client.post("/v1/envelopes/goals", json={
        "name": "연말 장비", "target_amount": 800_000, "source": "ai_recommend",
    }).json()
    assert body["source"] == "ai_recommend"
    assert any(e["type"] == "goal_created" for e in db.list_events())
    assert client.post("/v1/envelopes/goals", json={
        "name": "x", "target_amount": 1, "source": "agent_auto",
    }).status_code == 422                                      # 개설 주체는 사람뿐
