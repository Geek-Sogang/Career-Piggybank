"""팩트시트·이벤트 로그·스냅샷 테스트 — 페르소나 엔진의 입력층 (PR A).

검증 3묶음:
- 팩트 측정이 결정론으로 맞는가 (박몰아형 시드 → 몰아쓰기·가뭄 반응·CV 기대값)
- 원칙이 지켜지는가 (needs_review 제외 · 관측 부족은 None — 지어내지 않음 · 밴드/정의 병기)
- 행동 계측이 실제로 쌓이는가 (입금·태그·결정 → events, 어젠다 큐 미발화 행)
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services import facts as facts_svc
from app.store import db

client = TestClient(app)


def _txn(date: str, amount: float, kind: str, direction: str = "out",
         counterparty: str = "x", needs_review: bool = False) -> dict:
    return {
        "date": date, "amount": amount, "kind": kind, "direction": direction,
        "counterparty": counterparty, "needs_review": needs_review,
    }


def _fact(facts: list, fid: str):
    return next(f for f in facts if f.id == fid)


# ── 측정 정확성 (박몰아형: 몰아쓰기·가뭄 경직) ──

def _burst_ledger() -> list[dict]:
    return [
        # 2월: 입금 1건 + 입금 직후 생활비 몰림
        _txn("2025-02-10", 1_000_000, "income", "in", "크몽"),
        _txn("2025-02-11", 400_000, "living"),
        _txn("2025-02-12", 300_000, "living"),
        _txn("2025-02-25", 100_000, "living"),   # 창 밖
        # 3월: 무수입(가뭄) — 생활비는 거의 못 줄임
        _txn("2025-03-15", 700_000, "living"),
        # 4월: 입금 1건
        _txn("2025-04-20", 2_000_000, "income", "in", "위시켓"),
        _txn("2025-04-21", 500_000, "living"),
    ]


def test_burst_fact_measured():
    facts = facts_svc.build_factsheet(_burst_ledger(), [], [])
    f6 = _fact(facts, "F06")
    # 창 안 = 400k+300k+500k = 1.2M / 전체 생활비 2.0M = 60%
    assert f6.value == 0.6
    assert "50%" in f6.band  # 참고구간 병기


def test_drought_response_measured():
    facts = facts_svc.build_factsheet(_burst_ledger(), [], [])
    f5 = _fact(facts, "F05")
    # 가뭄달(3월, 소득 0) 생활비 700k vs 평상달 중앙값(2월 800k, 4월 500k → 650k)
    # 700/650 - 1 = +0.08 — 가뭄인데 오히려 더 씀(경직)
    assert f5.value is not None and f5.value > 0
    assert "경직" in f5.band


def test_income_cv_counts_zero_months():
    facts = facts_svc.build_factsheet(_burst_ledger(), [], [])
    f1 = _fact(facts, "F01")
    # 2월 1.0M / 3월 0 / 4월 2.0M — 빈 달을 0으로 세야 긱워커 변동성이 정직하다
    assert f1.n == 3
    assert f1.value is not None and f1.value > 0.7


def test_gap_facts():
    facts = facts_svc.build_factsheet(_burst_ledger(), [], [])
    assert _fact(facts, "F03").value == 69.0  # 02-10 → 04-20
    assert _fact(facts, "F04").value == 69.0


# ── 원칙 (제외·정직·병기) ──

def test_needs_review_excluded_everywhere():
    ledger = _burst_ledger() + [
        _txn("2025-04-25", 9_000_000, "income", "in", "수상한입금", needs_review=True),
    ]
    with_review = facts_svc.build_factsheet(ledger, [], [])
    without = facts_svc.build_factsheet(_burst_ledger(), [], [])
    # 미확정 라벨은 모든 통계에서 제외 — 팩트가 하나도 변하면 안 된다
    assert [f.as_dict() for f in with_review] == [f.as_dict() for f in without]


def test_insufficient_data_is_none_not_invented():
    facts = facts_svc.build_factsheet([_txn("2025-01-05", 500_000, "income", "in")], [], [])
    f1 = _fact(facts, "F01")
    assert f1.value is None
    assert f1.display == "관측 부족"


def test_every_fact_has_band_and_definition():
    facts = facts_svc.build_factsheet(_burst_ledger(), [], [])
    assert len(facts) == 12
    for f in facts:
        assert f.band.strip(), f.id
        assert f.definition.strip(), f.id


def test_behavior_facts_from_allocations():
    allocations = [
        {"status": "confirmed", "proposed": {"buffer": 100}, "final": {"buffer": 100}},
        {"status": "adjusted", "proposed": {"buffer": 100}, "final": {"buffer": 180}},
    ]
    facts = facts_svc.build_factsheet([], allocations, [])
    assert _fact(facts, "F11").value == 0.5           # 2건 중 1건 무수정
    assert _fact(facts, "F12").value == 80.0          # 버퍼 +80 (미래지향)
    assert "+80" in _fact(facts, "F12").display


# ── 행동 계측 + 어젠다 큐 (라이브 API) ──

def test_deposit_logs_event():
    client.post("/v1/bank/deposit", json={
        "date": "2025-05-02", "amount": 500_000, "counterparty": "○○커머스", "memo": "",
    })
    events = db.list_events("deposit_received")
    assert len(events) == 1
    assert events[0]["payload"]["amount"] == 500_000
    # 어젠다 큐 — 아직 발화 안 한 행
    assert any(e["type"] == "deposit_received" for e in db.unspoken_events())


def test_tag_and_decision_log_events():
    res = client.post("/v1/bank/deposit", json={
        "date": "2025-05-02", "amount": 500_000, "counterparty": "○○커머스", "memo": "",
    }).json()
    alloc = res["allocation"]
    assert alloc is not None
    p = alloc["proposed"]
    client.post(f"/v1/allocations/{alloc['id']}/decision", json={
        "action": "adjust",
        "adjusted": {"tax": p["tax"], "expense": p["expense"],
                     "spendable": p["spendable"] - 50_000, "buffer": p["buffer"] + 50_000},
    })
    decided = db.list_events("allocation_decided")
    assert len(decided) == 1
    assert decided[0]["payload"]["action"] == "adjust"
    assert decided[0]["payload"]["buffer_delta"] == 50_000

    txn_id = res["transaction"]["id"]
    client.post(f"/v1/bank/transactions/{txn_id}/tag", json={"kind": "income"})
    assert len(db.list_events("txn_tagged")) == 1

    # 태깅 활동이 팩트로 잡힌다
    facts = facts_svc.build_factsheet(db.list_txns(), db.list_allocations(), db.list_events())
    assert _fact(facts, "F10").value == 1.0


def test_mark_spoken_consumes_agenda():
    db.log_event("deposit_received", payload={"amount": 1})
    ev = db.unspoken_events()[0]
    db.mark_spoken(ev["id"])
    assert db.unspoken_events() == []


# ── API + 스냅샷 ──

def test_facts_endpoint_and_snapshot():
    client.post("/v1/bank/deposit", json={
        "date": "2025-05-02", "amount": 500_000, "counterparty": "○○커머스", "memo": "",
    })
    body = client.get("/v1/facts").json()
    assert body["version"] == "v1"
    assert body["count"] == 12
    assert all("band" in f and "definition" in f for f in body["facts"])

    snap = client.post("/v1/facts/snapshot").json()
    stored = db.latest_snapshot()
    assert stored is not None and stored["id"] == snap["id"]
    assert stored["factsheet"]["count"] == 12
    assert stored["axes"] is None  # 판독(PR B) 전 — 사실만 고정
