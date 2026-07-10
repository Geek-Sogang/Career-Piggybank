"""UserProfile aggregate — 특성화 테스트 (PR-1 안전망).

이 aggregate는 배분·추천 소비자가 각자 재계산하던 프로필 조각을 한 곳으로 모은다.
PR-1은 순수 추가라 '동작 불변'이 계약이다: build_user_profile()의 각 슬라이스가
기존 흩어진 경로(bank_flow의 profile_from_store·context_from_store·gig_archetype 등)와
같은 값을 내는지 못박는다. PR-2에서 소비자를 이 aggregate로 갈아끼울 때 이 테스트가 가드.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.profile import build_user_profile
from app.services import bank_flow
from app.services import facts as facts_svc
from app.store import db
from app.store.seed import ensure_seed

client = TestClient(app)


# ── 각 슬라이스가 기존 경로와 값이 같은가 (동작 불변) ──

def test_spending_matches_profile_from_store() -> None:
    ensure_seed()
    up = build_user_profile()
    assert up.spending == bank_flow.profile_from_store()


def test_allocation_context_matches_context_from_store() -> None:
    ensure_seed()
    up = build_user_profile()
    assert up.allocation_context() == bank_flow.context_from_store()


def test_gig_archetype_matches() -> None:
    ensure_seed()
    up = build_user_profile()
    assert up.gig_archetype == bank_flow.gig_archetype()


def test_has_confirmed_incoming_matches() -> None:
    ensure_seed()
    up = build_user_profile()
    assert up.has_confirmed_incoming == bank_flow.has_confirmed_incoming()


def test_buffer_bias_matches() -> None:
    ensure_seed()
    up = build_user_profile()
    assert up.buffer_bias == bank_flow.buffer_adjustment_bias()


def test_factsheet_matches_direct_build() -> None:
    ensure_seed()
    up = build_user_profile()
    direct = facts_svc.build_factsheet(
        db.list_txns(), db.list_allocations(), db.list_events(),
    )
    assert list(up.factsheet) == direct


def test_persona_axes_matches_latest_snapshot() -> None:
    ensure_seed()
    up = build_user_profile()
    snap = db.latest_snapshot()
    assert up.persona_axes == (snap["axes"] if snap else None)


def test_persona_staleness_matches_direct() -> None:
    ensure_seed()
    up = build_user_profile()
    direct = facts_svc.snapshot_staleness(db.latest_snapshot(), len(db.list_txns()))
    assert up.persona_staleness == direct


# ── 조정 이력이 쌓인 뒤에도 buffer_bias 슬라이스가 일치하는가 (행동 루프 경로) ──

def _deposit_and_adjust(amount: float, counterparty: str, buffer_extra: float) -> None:
    res = client.post("/v1/bank/deposit", json={
        "date": "2025-05-25", "amount": amount, "counterparty": counterparty,
    })
    alloc = res.json()["allocation"]
    split = dict(alloc["proposed"])
    move = min(buffer_extra, split["spendable"])
    split["spendable"] -= move
    split["buffer"] += move
    client.post(f"/v1/allocations/{alloc['id']}/decision",
                json={"action": "adjust", "adjusted": split})


def test_buffer_bias_matches_after_adjustments() -> None:
    ensure_seed()
    _deposit_and_adjust(483_500, "역산클라이언트A", 100_000)
    _deposit_and_adjust(967_000, "역산클라이언트B", 100_000)
    up = build_user_profile()
    assert up.buffer_bias == bank_flow.buffer_adjustment_bias()
    assert up.buffer_bias == pytest.approx(100_000, abs=1)


# ── PR-2 목적: 배분 핫패스에서 공유 상류가 각 1회만 계산된다 (중복 제거) ──

def test_propose_for_deposit_computes_shared_upstream_once(monkeypatch) -> None:
    """입금 1건 제안에 career_signals·income_streams.decompose가 각 1회만 호출된다.

    이전엔 propose_for_deposit이 context_from_store·gig_archetype·has_confirmed_incoming을
    따로 불러 career_signals 2회·decompose 3회가 벌어졌다. UserProfile 배선 후엔 각 1회.
    """
    from app.services import bank_flow, forecast, income_streams

    ensure_seed()
    real_signals, real_decompose = forecast.career_signals, income_streams.decompose
    calls = {"signals": 0, "decompose": 0}

    def counted_signals(*a, **k):
        calls["signals"] += 1
        return real_signals(*a, **k)

    def counted_decompose(*a, **k):
        calls["decompose"] += 1
        return real_decompose(*a, **k)

    monkeypatch.setattr(forecast, "career_signals", counted_signals)
    monkeypatch.setattr(income_streams, "decompose", counted_decompose)

    bank_flow.propose_for_deposit(483_500, "2025-05-25", txn_id=None)
    assert calls["signals"] == 1
    assert calls["decompose"] == 1


# ── 콜드스타트: 빈 원장에서도 폭발하지 않는다 (income 없음 → gap None) ──

def test_empty_ledger_builds_without_error() -> None:
    up = build_user_profile()
    assert up.gap is None
    assert up.months_observed == 0
    assert up.has_confirmed_incoming is False
    assert up.buffer_bias == 0.0
    # 슬라이스도 여전히 기존 경로와 일치
    assert up.gig_archetype == bank_flow.gig_archetype()
