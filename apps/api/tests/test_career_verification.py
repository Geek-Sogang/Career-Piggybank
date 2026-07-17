"""커리어 검증 SSOT와 페르소나 신선도 소비 게이트."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.engines import career_verification, facts as facts_svc, product_match
from app.engines.allocator import AllocationContext
from app.main import app
from app.profile import build_user_profile
from app.store import db

client = TestClient(app)


def _axes() -> dict:
    return {
        "risk_tolerance": {
            "axis": "risk_tolerance", "label": "위험감내", "value": 0.3,
            "evidence": ["F12"], "reason": "버퍼를 늘림", "fallback": False,
        }
    }


def _income(i: int) -> None:
    db.insert_txn(
        date=f"2025-05-{i + 1:02d}", amount=500_000, direction="in",
        counterparty=f"발주처{i}", memo="", kind="income", subtype="settlement",
        confidence=0.95, needs_review=False, signals=[],
    )


def _verified_job(date: str, counterparty: str) -> str:
    txn_id = db.insert_txn(
        date=date, amount=500_000, direction="in",
        counterparty=counterparty, memo="개발 정산", kind="income", subtype="settlement",
        confidence=0.95, needs_review=False, signals=[],
    )
    db.log_event("career_job_verified", ref_id=txn_id, payload={"sources": ["입금", "홈택스"]})
    return txn_id


def test_verification_score_stage_and_review_gate_are_deterministic() -> None:
    cold = career_verification.compute([])
    assert (cold.score, cold.stage, cold.review_ready) == (0, "잠정", False)
    assert "limit" not in cold.as_dict()

    txn_a = {
        "id": "job-a", "date": "2025-04-15", "amount": 500_000, "direction": "in",
        "counterparty": "발주처A", "memo": "개발", "kind": "income", "needs_review": False,
    }
    txn_b = {**txn_a, "id": "job-b", "date": "2025-05-15", "counterparty": "발주처B"}
    events = [
        {"type": "career_job_verified", "ref_id": "job-a", "payload": {}},
        {"type": "career_job_verified", "ref_id": "job-b", "payload": {}},
    ]
    verified = career_verification.compute(
        ["github", "hometax", "github"], events=events, txns=[txn_a, txn_b],
    )
    assert verified.sources == ("github", "hometax")
    # 검증 일감 2건(20) + 2개월 연속(20) + 활동 범위 2개월(8) + 연결 자료(70)
    assert (verified.score, verified.stage, verified.review_ready) == (118, "확정", True)
    assert verified.verified.count == 2
    assert verified.piggybank.work_xp == 60
    assert verified.as_dict()["review_connection"]["label"] == "검증자료로 심사 연결"


def test_verification_endpoint_persists_latest_job_and_sources() -> None:
    body = client.post("/v1/profile/verification", json={
        "job": "designer", "sources": ["behance", "hometax"],
    }).json()
    assert body["job"] == "designer" and body["stage"] == "확정"
    assert client.get("/v1/profile/verification").json() == body
    assert build_user_profile().career.job == "designer"


def test_confirmed_stage_only_adds_review_material_to_credit_basis() -> None:
    candidates, _ = product_match.eligible(
        invest_available=0, tax_balance=0,
        ctx=AllocationContext(expected_gap_days=45), has_confirmed_income=True,
        career_review_ready=True,
    )
    emergency = next(c for c in candidates if c.product_id == "emergency")
    assert "커리어 검증자료를 심사 화면에서 함께 확인" in emergency.basis
    assert "한도" not in emergency.basis


def test_mission_xp_counts_a_completed_mission_once() -> None:
    events = [
        {"type": "app_opened", "payload": {}},
        {"type": "allocation_decided", "payload": {
            "action": "confirm", "rhythm_eligible": True, "income_event_id": "txn-1",
        }},
        {"type": "allocation_decided", "payload": {
            "action": "confirm", "rhythm_eligible": True, "income_event_id": "txn-1",
        }},
        {"type": "allocation_decided", "payload": {
            "action": "reject", "rhythm_eligible": False, "income_event_id": "txn-2",
        }},
        {"type": "pacing_decided", "payload": {"action": "confirm"}},
    ]
    result = career_verification.compute(["hometax"], events=events)
    assert result.score == 40
    assert result.piggybank.work_xp == 0
    assert result.piggybank.mission_xp == 55  # 홈택스 연결 30 + 첫 배분 처리 25
    # 같은 입금 중복은 한 번, 거절도 '처리'이므로 결과와 무관하게 반복 XP를 받는다.
    assert result.piggybank.loop_xp == 4
    assert result.piggybank.completed_missions == 2


def test_only_explicitly_verified_jobs_count_as_work_xp() -> None:
    auto_income = {
        "id": "auto-income", "date": "2025-05-10", "amount": 700_000,
        "direction": "in", "counterparty": "플랫폼 자동정산", "memo": "",
        "kind": "income", "needs_review": False,
    }
    unverified = career_verification.compute([], txns=[auto_income])
    assert unverified.verified.count == 0
    assert unverified.piggybank.work_xp == 0

    verified = career_verification.compute(
        [], events=[{"type": "career_job_verified", "ref_id": "auto-income", "payload": {}}],
        txns=[auto_income],
    )
    assert verified.verified.count == 1
    assert verified.piggybank.work_xp == 30


def test_approved_deposit_adds_first_mission_xp_without_changing_trust_score() -> None:
    before = client.get("/v1/profile/verification").json()
    body = client.post("/v1/bank/deposit", json={
        "date": "2025-06-10", "amount": 900_000, "counterparty": "크몽", "memo": "정산",
    }).json()
    allocation = body["allocation"]
    assert allocation is not None
    client.post(f"/v1/allocations/{allocation['id']}/decision", json={"action": "confirm"})

    after = client.get("/v1/profile/verification").json()
    assert (after["score"], after["stage"]) == (before["score"], before["stage"])
    assert after["piggybank"]["mission_xp"] == before["piggybank"]["mission_xp"] + 25
    assert after["piggybank"]["loop_xp"] == before["piggybank"]["loop_xp"] + 2
    assert after["piggybank"]["xp"] == before["piggybank"]["xp"] + 27


def test_daily_scrap_is_once_per_day_and_never_enters_persona_facts() -> None:
    before = {fact.id: fact.value for fact in facts_svc.build_factsheet([], [], db.list_events())}
    assert client.post("/v1/behavior/career-scraps", json={"content": "₩"}).status_code == 422
    assert client.post("/v1/behavior/career-scraps", json={"content": "  "}).status_code == 422

    first = client.post("/v1/behavior/career-scraps", json={"content": "결제 화면 빈 상태 개선"}).json()
    second = client.post("/v1/behavior/career-scraps", json={"content": "React 렌더링 최적화 학습"}).json()
    assert first["xp_awarded"] is True
    assert second["xp_awarded"] is False
    assert second["event_id"] == first["event_id"]
    assert len(db.list_events("career_scrap_saved")) == 1
    collection = client.get("/v1/behavior/career-scraps").json()
    assert [scrap["content"] for scrap in collection] == [
        "React 렌더링 최적화 학습", "결제 화면 빈 상태 개선",
    ]

    profile = client.get("/v1/profile/verification").json()
    assert profile["piggybank"]["daily_xp"] == 1
    scrap = next(m for m in profile["piggybank"]["daily_missions"] if m["id"] == "career_scrap")
    assert scrap["completed"] is True

    after = {fact.id: fact.value for fact in facts_svc.build_factsheet([], [], db.list_events())}
    assert after == before  # 스크랩·미션 완료는 F10~F14와 계획성 입력을 바꾸지 않는다.


def test_quest_phase_follows_ledger_context_without_changing_trust() -> None:
    tax_txn = {
        "id": "tax-season", "date": "2025-04-20", "amount": 500_000,
        "direction": "in", "counterparty": "발주처", "memo": "정산",
        "kind": "income", "needs_review": False,
    }
    result = career_verification.compute([], txns=[tax_txn])
    assert result.score == 0
    assert result.piggybank.phase["key"] == "tax_season"


def test_latest_restores_seeded_source_connections_and_verified_jobs() -> None:
    _verified_job("2025-04-10", "발주처A")
    _verified_job("2025-05-10", "발주처B")
    db.log_event("source_connected", payload={"source": "github"})
    db.log_event("source_connected", payload={"source": "hometax"})

    latest = career_verification.latest(db.list_events(), db.list_txns())
    assert latest.sources == ("github", "hometax")
    assert latest.verified.count == 2
    assert latest.piggybank.xp == 110  # 일감 60 + GitHub 20 + 홈택스 30


def test_stale_persona_remains_visible_but_is_not_used_for_money() -> None:
    db.insert_snapshot(trigger="manual", factsheet={}, axes=_axes(), source_txn_count=0)
    for i in range(5):
        _income(i)

    up = build_user_profile()
    assert up.persona_staleness == {"new_txns": 5, "stale": True, "threshold": 5}
    assert up.persona_axes is None
    # 감사 화면은 원본 스냅샷을 보존한다.
    assert client.get("/v1/profile/persona").json()["axes"] == _axes()


def test_fresh_persona_is_available_to_downstream_consumers() -> None:
    _income(0)
    db.insert_snapshot(trigger="manual", factsheet={}, axes=_axes(), source_txn_count=1)
    assert build_user_profile().persona_axes == _axes()


def test_fresh_persona_is_exposed_in_live_allocation_policy() -> None:
    for i in range(3):
        _income(i)
    db.insert_snapshot(trigger="manual", factsheet={}, axes=_axes(), source_txn_count=3)
    allocation = client.post("/v1/bank/deposit", json={
        "date": "2025-06-10", "amount": 900_000, "counterparty": "크몽", "memo": "정산",
    }).json()["allocation"]
    assert allocation["persona_used"] is True
    assert allocation["policy"]["prior_source"] == "persona:risk_tolerance=0.3"
