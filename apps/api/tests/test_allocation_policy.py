"""학습 배분 정책 테스트 — informed prior(페르소나) · 분위수 arm · 보상 학습 · 신선도 게이트.

핵심 불변식:
- 학습은 보정이지 출발점이 아니다 — 관측 0건이면 페르소나가 함의한 arm 그대로
- 거절이 쌓이면 선택이 바뀐다 (반응 2~3건 — 데모에서 눈에 보이는 학습)
- 정책이 바꾸는 건 버퍼 '목표'뿐 — 배분 원화(폭포수 잔여)·세금·합계 보존은 불가침
- 보상은 사람의 결정에서만 — 제안 생성은 정책 상태를 바꾸지 않는다
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.engines import allocator, facts as facts_svc
from app.engines.allocation_policy import ARM_IDS, choose, credits_for, update
from app.engines.allocator import AllocationContext, EnvelopeBalances, SpendingProfile
from app.store import db

client = TestClient(app)


def _axes(risk: float, fallback: bool = False) -> dict:
    return {"risk_tolerance": {"axis": "risk_tolerance", "label": "위험감내",
                               "value": risk, "fallback": fallback}}


def _dates(n: int, gap: int = 30, start: str = "2025-01-10") -> list[str]:
    from datetime import date, timedelta
    d0 = date.fromisoformat(start)
    return [(d0 + timedelta(days=gap * i)).isoformat() for i in range(n)]


# ── informed prior — 페르소나가 출발점을 정한다 ──

def test_prior_follows_persona():
    assert choose(_dates(5), _axes(0.1), income_cv=0.25).arm_id == "P90"   # 안전지향 → 두꺼운 대비
    assert choose(_dates(5), _axes(0.9), income_cv=0.25).arm_id == "P60"   # 공격적 → 얇은 대비
    assert choose(_dates(5), None, income_cv=0.25).arm_id == "P75"          # 페르소나 없음 → 중립(가운데)


def test_persona_grounded_reason():
    """근거 문장이 추상어가 아니라 축값+접지 팩트를 말한다 (③ 페르소나→배분 근거 연결)."""
    axes = {"risk_tolerance": {"axis": "risk_tolerance", "label": "위험감내",
                               "value": 0.3, "fallback": False, "evidence": ["F12"]}}
    d = choose(_dates(5), axes, income_cv=0.25)
    assert "안전을 중시하는 성향(위험감내 0.3)" in d.reason
    assert "버퍼를 직접 조정해 오신 이력" in d.reason      # 판독 evidence(F12) 접지
    # 폴백 축은 페르소나 근거를 지어내지 않는다
    neutral = choose(_dates(5), _axes(0.3, fallback=True), income_cv=0.25)
    assert "성향(위험감내" not in neutral.reason


def test_fallback_axis_is_neutral():
    # 판독 폴백(중립 0.5 지어내기 방지)은 근거가 아니다 — 중립 prior로
    d = choose(_dates(5), _axes(0.1, fallback=True), income_cv=0.25)
    assert d.arm_id == "P75" and d.prior_source == "neutral"


# ── 번역 — 값은 측정(공백 분위수)에서, 콜드스타트는 공식으로 수축 ──

def test_months_from_gap_quantile_full_weight():
    # 공백 8건(수축 가중 100%) 전부 45일 → 어느 분위수든 45일 → 1.5개월
    d = choose(_dates(9, gap=45), None, income_cv=0.5)
    assert d.observed_gaps == 8 and d.shrink_weight == 1.0
    assert d.months == 1.5
    assert d.gap_days_at_q == 45.0


def test_cold_start_shrinks_to_formula():
    d0 = choose(_dates(1), None, income_cv=0.5)      # 공백 0건 → 공식 그대로
    assert d0.months == 3.0 and d0.shrink_weight == 0.0
    d1 = choose(_dates(2, gap=60), None, income_cv=0.5)  # 공백 1건 → 1/8만 분위수
    expected = (1 / 8) * (60 / 30) + (7 / 8) * 3.0
    assert d1.months == round(expected, 2)


def test_months_clamped_to_engine_bounds():
    # 300일 공백 → 10개월이지만 엔진 상한(6개월)에 클램프
    d = choose(_dates(9, gap=300), None, income_cv=0.25)
    assert d.months == allocator.BUFFER_MONTHS_MAX


# ── 보상 — 방향 인식(credits_for): 버퍼를 민 쪽 arm에 크레딧 ──

def test_credits_confirm_and_reject():
    proposed = {"tax": 100, "expense": 100, "spendable": 300, "buffer": 500}
    assert credits_for("confirm", proposed, proposed, 1000, "P75") == [("P75", 1.0)]
    assert credits_for("reject", proposed, None, 1000, "P75") == [("P75", 0.0)]


def test_credits_tiny_adjust_is_acceptance():
    # 버퍼 편집이 입금액의 5% 미만이면 안전 수준은 수용 — 고른 arm 성공
    proposed = {"tax": 100, "expense": 100, "spendable": 300, "buffer": 500}
    adjusted = {**proposed, "spendable": 340, "buffer": 460}   # 40/1000 = 4% < 5%
    assert credits_for("adjust", proposed, adjusted, 1000, "P75") == [("P75", 1.0)]


def test_credits_adjust_up_rewards_higher_neighbor():
    # 버퍼를 크게 늘림(더 안전 원함) → 위쪽 이웃(P90) 성공 + 고른 P75 실패
    proposed = {"tax": 100, "expense": 100, "spendable": 300, "buffer": 500}
    adjusted = {**proposed, "spendable": 100, "buffer": 700}   # +200/1000 = 20%
    assert credits_for("adjust", proposed, adjusted, 1000, "P75") == [("P90", 1.0), ("P75", 0.0)]


def test_credits_adjust_down_rewards_lower_neighbor():
    proposed = {"tax": 100, "expense": 100, "spendable": 300, "buffer": 500}
    adjusted = {**proposed, "spendable": 500, "buffer": 300}   # -200/1000 = 20%
    assert credits_for("adjust", proposed, adjusted, 1000, "P75") == [("P60", 1.0), ("P75", 0.0)]


def test_credits_extreme_arm_pushed_further_reinforces():
    # 이미 P90(최고 안전)인데 버퍼를 더 늘림 = 그 방향이 맞다는 강화(성공), 이웃 없음
    proposed = {"tax": 100, "expense": 100, "spendable": 300, "buffer": 500}
    adjusted = {**proposed, "spendable": 100, "buffer": 700}
    assert credits_for("adjust", proposed, adjusted, 1000, "P90") == [("P90", 1.0)]


# ── 온라인 학습 — 거절이 쌓이면 선택이 바뀐다 (데모 장면) ──

def test_rejections_flip_choice():
    dates, axes = _dates(5), _axes(0.1)
    assert choose(dates, axes, income_cv=0.25).arm_id == "P90"
    update("P90", 0.0)  # 거절 1 — prior(유사관측 2건)라 아직 안 뒤집힘
    update("P90", 0.0)  # 거절 2
    assert choose(dates, axes, income_cv=0.25).arm_id == "P90"
    update("P90", 0.0)  # 거절 3 — P90 사후평균 3/7 < P75 사후평균 1/2
    assert choose(dates, axes, income_cv=0.25).arm_id == "P75"


def test_upward_adjusts_converge_higher_not_lower():
    """의도 역전 교정의 핵심 회귀 — 사용자가 버퍼를 계속 늘리면(더 안전 원함) 정책은
    더 안전한 분위수로 가야 한다. 이전 abs(Δ) 보상은 반대로 더 공격적으로 뒤집혔다.
    """
    dates, axes = _dates(5), _axes(0.5)      # 중립 출발(P75)
    start = choose(dates, axes, income_cv=0.25).arm_id
    assert start == "P75"
    proposed = {"tax": 0, "expense": 0, "spendable": 500, "buffer": 500}
    adjusted = {"tax": 0, "expense": 0, "spendable": 200, "buffer": 800}   # +300/1000 = 위로
    for _ in range(4):
        for arm, r in credits_for("adjust", proposed, adjusted, 1000, "P75"):
            update(arm, r)
    end = choose(dates, axes, income_cv=0.25).arm_id
    assert end == "P90"      # 더 안전한 쪽으로 수렴 (역전 아님)


def test_confirms_reinforce_choice():
    # 공격적 prior(P60, 사후평균 0.75)를 이웃 P75(Beta(2,2) 시작)가 이기려면 승인
    # 4건이 필요하다 — (2+k)/(4+k)는 k=4에서 0.75 동률(동률은 안전한 쪽 = P75).
    # prior가 소음 몇 건에 뒤집히지 않되, 일관된 반응에는 밀리는 강도의 실측.
    dates = _dates(5)
    for _ in range(3):
        update("P75", 1.0)
    assert choose(dates, _axes(0.9), income_cv=0.25).arm_id == "P60"   # 3건까진 prior가 버틴다
    update("P75", 1.0)
    d = choose(dates, _axes(0.9), income_cv=0.25)
    assert d.arm_id == "P75"
    assert d.posterior["P75"]["pulls"] == 4


# ── 불가침 — 정책은 버퍼 '목표'만 만진다 ──

def test_override_keeps_split_and_sum_invariant():
    profile = SpendingProfile(annual_gross=40_000_000, expected_monthly_expense=300_000,
                              expected_monthly_living=1_500_000, income_cv=0.4, avg_deposit=2_000_000)
    base = allocator.propose(2_000_000, profile, EnvelopeBalances(), AllocationContext())
    over = allocator.propose(2_000_000, profile, EnvelopeBalances(),
                             AllocationContext(buffer_months_override=4.0, buffer_months_reason="테스트 근거"))
    # 원화 배분(폭포수 잔여)은 목표와 무관 — 세금·경비·즉시가용·버퍼 전부 동일
    assert (over.tax, over.expense, over.spendable, over.buffer) == \
           (base.tax, base.expense, base.spendable, base.buffer)
    assert round(over.tax + over.expense + over.spendable + over.buffer, 2) == 2_000_000
    assert over.buffer_target == profile.expected_monthly_living * 4.0
    assert "테스트 근거" in over.reasons
    assert over.assumptions["buffer_months_from_policy"] == 1.0


# ── 오케스트레이션 — 입금 → meta.policy → 결정 → 보상 (전체 루프 라이브) ──

def _seed_income(n: int = 5):
    for d in _dates(n):
        db.insert_txn(date=d, amount=900_000, direction="in", counterparty="크몽",
                      memo="", kind="income", subtype=None, confidence=0.95,
                      needs_review=False, signals=[])


def test_deposit_flow_records_policy_and_decision_pays_reward():
    _seed_income()
    body = client.post("/v1/bank/deposit", json={
        "date": "2025-06-10", "amount": 900_000, "counterparty": "크몽", "memo": "정산",
    }).json()
    alloc = body["allocation"]
    assert alloc is not None
    assert alloc["policy"]["arm_id"] in ARM_IDS.values()
    assert alloc["persona_used"] is False   # 스냅샷 전에는 구조 기반이라고 정직하게 노출
    stored = db.get_allocation(alloc["id"])
    policy = stored["meta"]["policy"]
    assert policy["arm_id"] in ARM_IDS.values()
    assert policy["posterior"][policy["arm_id"]]["pulls"] == 0   # 제안 생성은 상태를 안 바꾼다
    assert db.policy_state() == {}

    client.post(f"/v1/allocations/{alloc['id']}/decision", json={"action": "confirm"})
    state = db.policy_state()
    assert state[policy["arm_id"]]["pulls"] == 1
    assert state[policy["arm_id"]]["alpha"] == 1.0               # confirm = 보상 1
    ev = [e for e in db.list_events(type_="allocation_decided")][-1]
    assert ev["payload"]["policy_arm"] == policy["arm_id"]
    assert ev["payload"]["policy_credits"] == [[policy["arm_id"], 1.0]]   # confirm = 고른 arm 성공
    assert ev["payload"]["income_event_id"] == body["transaction"]["id"]
    assert ev["payload"]["rhythm_eligible"] is True


def test_reject_pays_zero_and_next_proposal_sees_it():
    _seed_income()
    first = client.post("/v1/bank/deposit", json={
        "date": "2025-06-10", "amount": 900_000, "counterparty": "크몽", "memo": "정산",
    }).json()["allocation"]
    client.post(f"/v1/allocations/{first['id']}/decision", json={"action": "reject"})
    arm = db.get_allocation(first["id"])["meta"]["policy"]["arm_id"]
    assert db.policy_state()[arm] == {"alpha": 0.0, "beta": 1.0, "pulls": 1}

    second = client.post("/v1/bank/deposit", json={
        "date": "2025-06-20", "amount": 900_000, "counterparty": "크몽", "memo": "정산",
    }).json()["allocation"]
    posterior = db.get_allocation(second["id"])["meta"]["policy"]["posterior"]
    assert posterior[arm]["obs_b"] == 1.0                        # 거절이 다음 제안의 사후분포에 보인다


# ── 신선도 게이트 — 원장은 자랐는데 축은 예전 ──

def test_snapshot_staleness():
    assert facts_svc.snapshot_staleness(None, 10) is None
    fresh = {"source_txn_count": 8}
    assert facts_svc.snapshot_staleness(fresh, 10)["stale"] is False
    assert facts_svc.snapshot_staleness(fresh, 13) == {
        "new_txns": 5, "stale": True, "threshold": facts_svc.STALE_NEW_TXNS,
    }
    legacy = {"source_txn_count": None}
    assert facts_svc.snapshot_staleness(legacy, 10)["stale"] is None


def test_persona_endpoint_exposes_staleness():
    _seed_income(3)
    db.insert_snapshot(trigger="manual", factsheet={}, axes=_axes(0.5),
                       source_txn_count=3)
    body = client.get("/v1/profile/persona").json()
    assert body["staleness"]["stale"] is False
    _seed_income(5)   # 새 거래 5건 → 임계 도달
    body = client.get("/v1/profile/persona").json()
    assert body["staleness"] == {"new_txns": 5, "stale": True, "threshold": 5}
