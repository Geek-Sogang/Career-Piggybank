"""커리어 검증 SSOT와 페르소나 신선도 소비 게이트."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.engines import career_verification, product_match
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


def test_verification_score_stage_and_limit_are_deterministic() -> None:
    cold = career_verification.compute([])
    assert (cold.score, cold.stage, cold.limit) == (320, "잠정", 600_000)

    verified = career_verification.compute(["github", "hometax", "github"])
    assert verified.sources == ("github", "hometax")
    assert (verified.score, verified.stage, verified.limit) == (390, "확정", 2_000_000)


def test_verification_endpoint_persists_latest_job_and_sources() -> None:
    body = client.post("/v1/profile/verification", json={
        "job": "designer", "sources": ["behance", "hometax"],
    }).json()
    assert body["job"] == "designer" and body["stage"] == "확정"
    assert client.get("/v1/profile/verification").json() == body
    assert build_user_profile().career.job == "designer"


def test_verified_limit_reaches_credit_product_basis() -> None:
    candidates, _ = product_match.eligible(
        invest_available=0, tax_balance=0,
        ctx=AllocationContext(expected_gap_days=45), has_confirmed_income=True,
        verified_credit_limit=1_900_000,
    )
    emergency = next(c for c in candidates if c.product_id == "emergency")
    assert "커리어 검증 한도 1,900,000원" in emergency.basis


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
