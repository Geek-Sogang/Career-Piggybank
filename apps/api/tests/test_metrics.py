"""무수정 승인율 지표 엔드포인트 테스트."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

REQ = {
    "deposit": 1_000_000,
    "profile": {
        "annual_gross": 30_000_000,
        "expected_monthly_expense": 400_000,
        "expected_monthly_living": 1_200_000,
        "income_cv": 0.4,
        "avg_deposit": 800_000,
    },
}


def _decide(action: str, adjusted: dict | None = None) -> None:
    body = client.post("/v1/allocations/propose", json=REQ).json()
    payload: dict = {"action": action}
    if adjusted is not None:
        p = body["proposed"]
        payload["adjusted"] = {
            "tax": p["tax"], "expense": p["expense"],
            "spendable": p["spendable"] - 50_000, "buffer": p["buffer"] + 50_000,
        }
    res = client.post(f"/v1/allocations/{body['id']}/decision", json=payload)
    assert res.status_code == 200


def test_metrics_empty_store() -> None:
    m = client.get("/v1/allocations/metrics").json()
    assert m["proposals"] == 0
    assert m["no_edit_approval_rate"] is None


def test_no_edit_approval_rate() -> None:
    _decide("confirm")
    _decide("confirm")
    _decide("adjust", adjusted={})
    _decide("reject")
    client.post("/v1/allocations/propose", json=REQ)  # 미결정 1건

    m = client.get("/v1/allocations/metrics").json()
    assert m["proposals"] == 5
    assert m["decided"] == 4
    assert (m["confirmed"], m["adjusted"], m["rejected"]) == (2, 1, 1)
    assert m["no_edit_approval_rate"] == pytest.approx(0.5)
