"""또래 봉투 추천 — 직군 필터·페르소나 유사도 가중·기존 제외·콜드스타트·풀 기여.

핵심 불변식:
- 유사도는 양쪽 다 측정된 축만 — 폴백(중립 기권) 축끼리의 가짜 일치 금지
- 같은 직군 풀이 얇으면 전체로 확장하되 scope로 표기 (숨은 확장 금지)
- 이미 만든 봉투는 다시 권하지 않는다
- 페르소나 없으면 인기순으로 정직하게 (유사도 지어내기 금지)
- 개설이 풀에 기여한다 (카탈로그는 사용자 관찰로 성장)
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.engines.peer_envelopes import recommend, similarity
from app.store import db
from app.store.seed import ensure_seed

client = TestClient(app)


def _axes(risk=0.3, time=0.7, ctrl=0.7, plan=0.7, fallback_keys=()) -> dict:
    values = {"risk_tolerance": risk, "time_preference": time,
              "self_control": ctrl, "planning": plan}
    return {k: {"value": v, "fallback": k in fallback_keys} for k, v in values.items()}


def _peer(job: str, name: str, amount: float, axes: dict | None) -> dict:
    return {"job": job, "name": name, "target_amount": amount, "axes": axes}


# ── 유사도 ──

def test_similarity_identical_and_opposite():
    assert similarity(_axes(), _axes()) == 1.0
    far = similarity(_axes(0.1, 0.9, 0.9, 0.9), _axes(0.9, 0.1, 0.1, 0.1))
    assert far == 0.2  # 평균 |Δ| = 0.8


def test_similarity_excludes_fallback_axes():
    # 한쪽이 기권한 축은 비교 제외 — 나머지 축으로만 계산
    a = _axes(0.3, 0.7, 0.7, 0.7)
    b = _axes(0.9, 0.7, 0.7, 0.7, fallback_keys=("risk_tolerance",))
    assert similarity(a, b) == 1.0            # risk 축 빠지고 나머지 3축 일치
    all_fb = _axes(fallback_keys=("risk_tolerance", "time_preference", "self_control", "planning"))
    assert similarity(a, all_fb) is None      # 비교 가능한 축 없음 — 지어내지 않는다


# ── 추천 ──

_POOL = [
    _peer("developer", "일 없는 달", 2_000_000, _axes(0.3, 0.7, 0.7, 0.7)),   # 유사
    _peer("developer", "일 없는 달", 1_500_000, _axes(0.1, 0.7, 0.5, 0.9)),   # 유사
    _peer("developer", "장비 교체", 2_400_000, _axes(0.3, 0.7, 0.7, 0.9)),    # 유사
    _peer("developer", "여행", 1_800_000, _axes(0.9, 0.3, 0.3, 0.3)),         # 반대 성향
    _peer("developer", "주식 시드", 3_000_000, _axes(0.9, 0.3, 0.5, 0.5)),    # 반대 성향
    _peer("designer", "태블릿 교체", 1_600_000, _axes(0.3, 0.7, 0.7, 0.7)),
]


def test_similar_persona_envelopes_outrank_opposite():
    """같은 직군 안에서 유사 성향의 봉투가 반대 성향의 봉투를 이긴다 — 핵심 요구."""
    ideas = recommend("developer", _axes(0.3, 0.7, 0.7, 0.7), set(), _POOL)
    names = [i.name for i in ideas]
    assert names[0] == "일 없는 달"                      # 유사 2명 — 최상위
    assert names.index("장비 교체") < names.index("여행") if "여행" in names else True
    assert all(i.scope == "job" for i in ideas)
    assert "태블릿 교체" not in names                    # 디자이너 봉투는 개발자에게 안 섞임


def test_existing_goal_names_are_excluded():
    ideas = recommend("developer", _axes(), {"일 없는 달"}, _POOL)
    assert all(i.name != "일 없는 달" for i in ideas)


def test_thin_job_pool_widens_scope_and_says_so():
    pool = [_peer("creator", "카메라 업그레이드", 2_800_000, _axes())] + _POOL[:2]
    ideas = recommend("creator", _axes(), set(), pool)   # creator 1명 < MIN 5 → 전체
    assert ideas and all(i.scope == "all" for i in ideas)
    assert any("또래" in i.basis for i in ideas)


def test_no_persona_falls_back_to_popularity_honestly():
    ideas = recommend("developer", None, set(), _POOL)
    assert ideas[0].name == "일 없는 달"                  # 2명 — 인기순
    assert any("판독 전" in i.basis for i in ideas)


def test_suggested_amount_is_peer_median():
    ideas = recommend("developer", _axes(), set(), _POOL)
    top = next(i for i in ideas if i.name == "일 없는 달")
    assert top.suggested_amount == 1_750_000              # median(2.0M, 1.5M)


# ── 감당가능성 (유철 피드백: 또래 금액이 그 사람 형편을 봐야) ──

def test_affordability_months_and_lowered_amount():
    """월 여윳돈 기준 도달 개월수 + 12개월 초과면 감당 가능 금액 대안."""
    # 월 여윳돈 10만원, 또래 '일 없는 달' 중앙값 175만 → 18개월(>12) → 형편 금액 120만
    ideas = recommend("developer", _axes(), set(), _POOL, monthly_surplus=100_000)
    top = next(i for i in ideas if i.name == "일 없는 달")
    assert top.months_to_reach == 18                      # ceil(1,750,000 / 100,000)
    assert top.affordable_amount == 1_200_000             # 10만 × 12, 10만원 단위
    assert "18개월 소요" in top.basis and "1,200,000원부터" in top.basis


def test_affordability_within_budget_no_lowered_amount():
    # 월 여윳돈 넉넉하면(200만) 도달 1개월 → 형편 금액 대안 없음
    ideas = recommend("developer", _axes(), set(), _POOL, monthly_surplus=2_000_000)
    top = next(i for i in ideas if i.name == "일 없는 달")
    assert top.months_to_reach == 1
    assert top.affordable_amount is None


def test_affordability_absent_when_no_surplus():
    # 여윳돈 0(저축 불가)이면 개월수 계산 안 함 — 지어내지 않는다
    ideas = recommend("developer", _axes(), set(), _POOL, monthly_surplus=0)
    assert all(i.months_to_reach is None for i in ideas)


# ── 라우트 — 추천 응답에 peers 노출 + 개설이 풀에 기여 ──

def test_recommend_route_exposes_peers(monkeypatch):
    from app.agents import envelope_recommend
    ensure_seed()
    monkeypatch.setattr(envelope_recommend.llm, "chat_json", lambda *a, **k: None)  # ⑤a 폴백
    body = client.post("/v1/envelopes/recommend").json()
    assert "peers" in body and len(body["peers"]) >= 1
    assert all("basis" in p and "suggested_amount" in p for p in body["peers"])


def test_goal_creation_contributes_to_peer_pool():
    ensure_seed()
    before = db.peer_pool_count()
    client.post("/v1/envelopes/goals", json={"name": "촬영 장비", "target_amount": 900_000})
    assert db.peer_pool_count() == before + 1
    mine = [p for p in db.list_peer_envelopes("developer") if p["origin"] == "user"]
    assert any(p["name"] == "촬영 장비" for p in mine)
