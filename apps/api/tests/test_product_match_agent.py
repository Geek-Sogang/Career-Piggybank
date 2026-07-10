"""⑥ 상품 매칭 에이전트 테스트 — 적합성 veto·게이트 3종·룰 폴백·라우트.

핵심 불변식:
- 부적합 상품은 메뉴에 없다 — AI가 뭘 뱉어도 후보 밖이면 폐기 (구조적 차단)
- 근거 팩트 없는 매칭은 폐기, 지어낸 숫자 문구는 결정론 템플릿으로 교체
- LLM 다운·전부 탈락 → 룰 폴백 (매칭은 항상 산다, 지어내진 않는다)
- 가입은 사람 — 라우트는 판정과 근거까지만
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.agents import product_match as agent
from app.main import app
from app.services import facts as facts_svc
from app.services.allocator import AllocationContext
from app.services.product_match import eligible
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


# ── 적합성 veto 필터 (결정론) ──

def test_buffer_short_vetoes_invest_products():
    """버퍼 목표 미달 + 공백 + 확정 예정 수입 → ISA 차단·비상금대출 적격."""
    candidates, vetoed = eligible(invest_available=0.0, tax_balance=100_000,
                                  ctx=AllocationContext(expected_gap_days=45.0),
                                  has_confirmed_income=True)
    ids = {c.product_id for c in candidates}
    assert "isa" in vetoed and "isa" not in ids
    assert "irp" in vetoed and "irp" not in ids
    assert "emergency" in ids and "parking" in ids


def test_emergency_loan_gated_on_confirmed_income():
    """확정 예정 수입이 없으면 비상금대출은 후보에서 빠진다 — 부채 유도 방지(준모 피드백)."""
    _, vetoed = eligible(invest_available=0.0, tax_balance=100_000,
                         ctx=AllocationContext(expected_gap_days=45.0),
                         has_confirmed_income=False)
    assert "확정된 예정 수입이 없어요" in vetoed["emergency"]


def test_surplus_vetoes_credit_product():
    """버퍼 목표 초과 → 신용상품 차단·ISA/IRP 적격 (여유 있는 사람에게 대출 권유 금지)."""
    candidates, vetoed = eligible(invest_available=500_000, tax_balance=0.0)
    ids = {c.product_id for c in candidates}
    assert "emergency" in vetoed and "emergency" not in ids
    assert {"isa", "irp", "parking"} <= ids


def test_early_decline_opens_irp_despite_no_surplus():
    """커리어 감속 국면 → 여유 없어도 IRP 적격 (노후 준비 국면 판정은 결정론 신호)."""
    candidates, _ = eligible(invest_available=0.0, tax_balance=0.0,
                             ctx=AllocationContext(early_decline=True))
    assert "irp" in {c.product_id for c in candidates}


# ── 에이전트 게이트 (LLM은 monkeypatch) ──

def test_menu_gate_rejects_off_catalog_pick(monkeypatch):
    """후보 밖 상품 ID는 폐기 — 전부 탈락이면 룰 폴백."""
    _seed_ledger()
    candidates, _ = eligible(invest_available=0.0, tax_balance=100_000)
    monkeypatch.setattr(agent.llm, "chat_json", lambda *a, **k: {
        "picks": [{"product_id": "toss_savings", "why": "고금리", "evidence": ["F01"]}],
    })
    picks = agent.select(candidates, _facts(), None, [])
    assert picks and all(p.source == "rule" for p in picks)
    assert all(p.product_id in {c.product_id for c in candidates} for p in picks)


def test_grounding_gate_rejects_evidence_free_pick(monkeypatch):
    """근거 팩트 ID 없는 매칭은 폐기."""
    _seed_ledger()
    candidates, _ = eligible(invest_available=0.0, tax_balance=100_000)
    monkeypatch.setattr(agent.llm, "chat_json", lambda *a, **k: {
        "picks": [{"product_id": "parking", "why": "좋아 보여서", "evidence": ["F99"]}],
    })
    picks = agent.select(candidates, _facts(), None, [])
    assert all(p.source == "rule" for p in picks)


def test_number_gate_swaps_hallucinated_line(monkeypatch):
    """지어낸 숫자(연 12.5%)가 든 문구 → 선택은 유지하되 문구는 결정론 템플릿으로."""
    _seed_ledger()
    facts = _facts()
    fid = next(f.id for f in facts if f.value is not None)
    candidates, _ = eligible(invest_available=0.0, tax_balance=100_000)
    monkeypatch.setattr(agent.llm, "chat_json", lambda *a, **k: {
        "picks": [{"product_id": "parking", "why": "연 12.5% 확정 수익이에요", "evidence": [fid]}],
    })
    picks = agent.select(candidates, facts, None, [])
    assert picks[0].product_id == "parking" and picks[0].source == "llm"
    assert "12.5" not in picks[0].line   # 문구 폴백 — 지어낸 숫자는 나가지 않는다


def test_llm_down_rule_fallback(monkeypatch):
    """LLM 다운 → 후보 상위 2개 + 결정론 문구."""
    _seed_ledger()
    candidates, _ = eligible(invest_available=0.0, tax_balance=100_000)
    monkeypatch.setattr(agent.llm, "chat_json", lambda *a, **k: None)
    picks = agent.select(candidates, _facts(), None, [])
    assert len(picks) == min(2, len(candidates))
    assert all(p.source == "rule" for p in picks)


def test_happy_path_grounded_pick(monkeypatch):
    """정상 경로 — 후보 안 상품 + 실존 팩트 근거 + 접지된 문구는 그대로 통과."""
    _seed_ledger()
    facts = _facts()
    fid = next(f.id for f in facts if f.value is not None)
    candidates, _ = eligible(invest_available=0.0, tax_balance=100_000,
                             ctx=AllocationContext(expected_gap_days=45.0),
                             has_confirmed_income=True)
    monkeypatch.setattr(agent.llm, "chat_json", lambda *a, **k: {
        "picks": [{"product_id": "emergency", "why": "수입 공백에 대비가 필요해요",
                   "evidence": [fid]}],
    })
    picks = agent.select(candidates, facts, None, [])
    assert picks[0].product_id == "emergency"
    assert picks[0].source == "llm" and picks[0].evidence == (fid,)


# ── 라우트 (명시 트리거 — 핫패스 아님) ──

def test_route_no_allocations_is_honest():
    r = client.post("/v1/products/match")
    assert r.status_code == 200
    body = r.json()
    assert body["matches"] == [] and "배분 이력이 없어" in body["note"]


def test_route_end_to_end_with_veto_exposed(monkeypatch):
    """배분 이력 있으면 매칭 + veto 사유 + 신선도 노출 (감사 가능성)."""
    _seed_ledger()
    client.post("/v1/bank/deposit", json={"amount": 1_000_000, "date": "2025-05-10",
                                          "counterparty": "크몽", "memo": "정산"})
    monkeypatch.setattr(agent.llm, "chat_json", lambda *a, **k: None)  # 폴백 경로
    r = client.post("/v1/products/match")
    assert r.status_code == 200
    body = r.json()
    assert body["matches"] and all(m["source"] == "rule" for m in body["matches"])
    assert isinstance(body["vetoed"], dict)
    assert "가입은 사람" in body["note"]
