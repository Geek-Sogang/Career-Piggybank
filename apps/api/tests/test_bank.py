"""뱅크 플로우 테스트 — 입금→분류→제안→승인→봉투 반영, 태그 학습 루프."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.store import db
from app.store.seed import ensure_seed

client = TestClient(app)


def seed() -> None:
    ensure_seed()


# ---------- 입금 플로우: 파이프라인 관통 ----------

def test_deposit_income_creates_txn_and_proposal() -> None:
    seed()
    res = client.post("/v1/bank/deposit", json={
        "date": "2025-05-25", "amount": 483_500, "counterparty": "뉴클라이언트",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["transaction"]["kind"] == "income"        # 3.3% 역산
    assert body["transaction"]["needs_review"] is False
    assert body["allocation"] is not None                  # 배분 제안까지 자동
    assert body["allocation"]["status"] == "proposed"
    parts = body["allocation"]["proposed"]
    assert abs(sum(parts.values()) - 483_500) < 0.02       # 합계 불변식


def test_deposit_unknown_needs_review_no_proposal() -> None:
    seed()
    res = client.post("/v1/bank/deposit", json={
        "date": "2025-05-25", "amount": 300_000, "counterparty": "박준형",
    })
    body = res.json()
    assert body["transaction"]["needs_review"] is True
    assert body["allocation"] is None                      # 확정 전엔 돈 안 나눔


def test_confirm_updates_envelope_balances() -> None:
    seed()
    before = db.envelope_balances()
    dep = client.post("/v1/bank/deposit", json={
        "date": "2025-05-26", "amount": 967_000, "counterparty": "크몽 정산",
    }).json()
    alloc = dep["allocation"]
    client.post(f"/v1/allocations/{alloc['id']}/decision", json={"action": "confirm"})
    after = db.envelope_balances()
    for name in ("tax", "expense", "spendable", "buffer"):
        assert after[name] - before[name] == pytest.approx(alloc["proposed"][name], abs=0.01)
    # 잔액 총증가 = 입금액
    assert abs(sum(after.values()) - sum(before.values()) - 967_000) < 0.02


def test_reject_leaves_balances_untouched() -> None:
    seed()
    before = db.envelope_balances()
    dep = client.post("/v1/bank/deposit", json={
        "date": "2025-05-26", "amount": 483_500, "counterparty": "크몽 정산",
    }).json()
    client.post(f"/v1/allocations/{dep['allocation']['id']}/decision", json={"action": "reject"})
    assert db.envelope_balances() == before


# ---------- 태그 학습 루프 (캐스케이드 0층) ----------

def test_tag_learns_and_next_deposit_auto_classified() -> None:
    seed()
    # 시드의 미분류 토스페이 찾기
    txns = client.get("/v1/bank/transactions").json()
    pending = next(t for t in txns if t["needs_review"])
    assert pending["counterparty"] == "토스페이 정산"

    # 수기 태그: 일감 매출 → 사전 학습 + income이라 배분 제안 생성
    res = client.post(f"/v1/bank/transactions/{pending['id']}/tag",
                      json={"kind": "income", "subtype": "settlement"})
    body = res.json()
    assert body["learned"] is True
    assert body["transaction"]["needs_review"] is False
    assert body["allocation"] is not None

    # 같은 상대 재입금 → 사전이 즉시 분류 (LLM·수기 태그 불필요)
    res2 = client.post("/v1/bank/deposit", json={
        "date": "2025-06-20", "amount": 250_000, "counterparty": "토스페이 정산",
    }).json()
    assert res2["transaction"]["kind"] == "income"
    assert res2["transaction"]["needs_review"] is False
    assert any("수기 태그 학습" in s for s in res2["transaction"]["signals"])


def test_tag_unknown_txn_404() -> None:
    assert client.post("/v1/bank/transactions/nope/tag", json={"kind": "living"}).status_code == 404


# ---------- 프로필·봉투 조회 ----------

def test_profile_comes_from_ledger() -> None:
    seed()
    from app.orchestration.bank_flow import profile_from_store
    est = profile_from_store()
    assert est.months_observed >= 4          # 시드 4개월
    assert est.blend_weight == 1.0           # 콜드스타트 졸업
    assert est.profile.expected_monthly_expense > 0


def test_envelopes_endpoint_reports_tax_progress() -> None:
    seed()
    body = client.get("/v1/bank/envelopes").json()
    assert body["balances"]["tax"] == 320_000
    assert body["balances"]["buffer"] == 99_555
    assert body["annual_tax_expected"] > 0
    assert body["tax_shortfall"] == pytest.approx(
        max(0.0, body["annual_tax_expected"] - 320_000), abs=0.01
    )


def test_seed_runs_once() -> None:
    assert ensure_seed() is True
    assert ensure_seed() is False
    assert len(db.list_txns()) == 13


# ---------- 컨텍스트 인식 배분 — 행동(조정 성향) 학습 루프 ----------

def _deposit_and_adjust(amount: float, counterparty: str, buffer_extra: float) -> None:
    """입금 → 제안 받기 → 버퍼를 buffer_extra만큼 늘려 조정 확정."""
    res = client.post("/v1/bank/deposit", json={
        "date": "2025-05-25", "amount": amount, "counterparty": counterparty,
    })
    alloc = res.json()["allocation"]
    split = dict(alloc["proposed"])
    move = min(buffer_extra, split["spendable"])
    split["spendable"] -= move
    split["buffer"] += move
    r = client.post(f"/v1/allocations/{alloc['id']}/decision",
                    json={"action": "adjust", "adjusted": split})
    assert r.status_code == 200


def test_adjustment_habit_feeds_next_proposal() -> None:
    """버퍼를 늘리는 조정 2회 → 다음 제안이 그 습관을 선반영한다 (행동 데이터 루프)."""
    seed()
    from app.orchestration import bank_flow
    assert bank_flow.buffer_adjustment_bias() == 0.0       # 이력 없음 → 중립

    _deposit_and_adjust(483_500, "역산클라이언트A", 100_000)
    assert bank_flow.buffer_adjustment_bias() == 0.0       # 1건은 노이즈 — 아직 중립

    _deposit_and_adjust(967_000, "역산클라이언트B", 100_000)
    assert bank_flow.buffer_adjustment_bias() == pytest.approx(100_000, abs=1)

    res = client.post("/v1/bank/deposit", json={
        "date": "2025-05-26", "amount": 1_934_000, "counterparty": "역산클라이언트C",
    })
    alloc = res.json()["allocation"]
    meta_reasons = alloc["reasons"]
    assert any("미리 여윳돈으로" in r for r in meta_reasons)


def test_context_assumptions_exposed_in_proposal() -> None:
    """수주 주기·커리어·행동 가정이 제안 meta에 노출된다 (숨은 계산 금지)."""
    seed()
    res = client.post("/v1/bank/deposit", json={
        "date": "2025-05-25", "amount": 483_500, "counterparty": "뉴클라이언트",
    })
    alloc_id = res.json()["allocation"]["id"]
    stored = db.get_allocation(alloc_id)
    a = stored["meta"]["assumptions"]
    for key in ("living_months", "expected_gap_days", "early_decline", "buffer_bias_applied"):
        assert key in a


def test_deposit_proposal_carries_product_hooks() -> None:
    """실플로우 제안에 하나 상품 훅이 실린다 (개인화 ② 상품 CTA)."""
    seed()
    res = client.post("/v1/bank/deposit", json={
        "date": "2025-05-25", "amount": 483_500, "counterparty": "뉴클라이언트",
    })
    alloc = res.json()["allocation"]
    hooks = alloc.get("product_hooks", [])
    assert 1 <= len(hooks) <= 2
    assert all("하나" in h["name"] for h in hooks)
