"""일감 증명 큐 — 검증 대기 조회 + 사람 승인(HITL)만 검증 사건을 만든다.

불변식:
- pending = 확정 income − 이미 검증된 것. needs_review·지출·수동 미확정은 제외.
- 승인은 명시 POST만 — 같은 거래 중복 승인은 409(중복 XP·점수 지급 차단).
- 승인 즉시 검증 건수·verified 목록에 반영된다 (career_job_verified가 유일한 원천).
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.engines import career_verification
from app.main import app
from app.store import db

client = TestClient(app)


def _income(counterparty: str, date: str, amount: float = 500_000, *,
            needs_review: bool = False) -> str:
    return db.insert_txn(
        date=date, amount=amount, direction="in", counterparty=counterparty,
        memo="웹 개발", kind="income", subtype=None, confidence=0.95,
        needs_review=needs_review, signals=[],
    )


def test_pending_excludes_verified_review_and_expense():
    a = _income("○○커머스", "2025-05-31")
    _income("검토중", "2025-05-20", needs_review=True)
    db.insert_txn(date="2025-05-19", amount=30_000, direction="out", counterparty="카페",
                  memo="", kind="expense", subtype=None, confidence=0.9,
                  needs_review=False, signals=[])
    b = _income("△△플랫폼", "2025-06-01")
    db.log_event("career_job_verified", ref_id=a, payload={"memo": "확인"})

    rows = career_verification.pending_jobs(db.list_events(), db.list_txns())
    ids = [r["id"] for r in rows]
    assert ids == [b]                      # 최신순, 검증·미확정·지출 전부 제외
    assert rows[0]["counterparty"] == "△△플랫폼"


def test_approve_creates_event_and_updates_history():
    txn_id = _income("△△스튜디오", "2025-03-28", 1_200_000)
    before = career_verification.latest(db.list_events(), db.list_txns()).verified.count

    res = client.post("/v1/profile/verification/jobs", json={"txn_id": txn_id})
    assert res.status_code == 200
    assert res.json()["verified"]["count"] == before + 1

    # 큐에서 사라진다
    pending = client.get("/v1/profile/verification/pending").json()["jobs"]
    assert txn_id not in [r["id"] for r in pending]


def test_approve_rejects_duplicates_and_non_income():
    txn_id = _income("○○커머스", "2025-05-31")
    assert client.post("/v1/profile/verification/jobs", json={"txn_id": txn_id}).status_code == 200
    # 중복 승인 = 409 — 재조회·중복 이벤트로 반복 지급하지 않는다
    assert client.post("/v1/profile/verification/jobs", json={"txn_id": txn_id}).status_code == 409

    unknown = client.post("/v1/profile/verification/jobs", json={"txn_id": "없는거래"})
    assert unknown.status_code == 422

    pending_txn = _income("검토중", "2025-06-02", needs_review=True)
    assert client.post("/v1/profile/verification/jobs", json={"txn_id": pending_txn}).status_code == 422
