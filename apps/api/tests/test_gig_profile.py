"""긱워커 소득 프로필 — 페르소나의 긱 특화 층 (결정론, LLM 없음).

핵심: 심리 4축이 뭉개는 '긱워커다움'(변동성·소득원 구조·수입 리듬·국면·N잡)을 1급으로.
밴드는 팩트(F01·F02)의 기존 경계를 재사용 — 새 임의 상수를 안 늘린다.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services.forecast import CareerSignals
from app.services.gig_profile import build_gig_profile
from app.services.income_streams import IncomeStreams, PendingSettlement

client = TestClient(app)


def _fact(fid: str, value: float | None):
    from app.services.facts import Fact
    return Fact(fid, fid, value, "", "", "", 3)


def _facts(cv=None, top_share=None):
    return [_fact("F01", cv), _fact("F02", top_share)]


def _signals(trend=0.0):
    return CareerSignals(1.0, 1.0, 1.0, trend, [])


def _streams(platform=0, repeat=0, one_off=0.0, pending=()):
    return IncomeStreams(platform_channels=platform, repeat_clients=repeat,
                         one_off_per_month=one_off, pending_settlements=list(pending))


# ── 변동성 (F01 밴드 재사용) ──

def test_volatility_bands():
    assert build_gig_profile(_facts(cv=0.2), _signals(), _streams(platform=1)).volatility == "안정"
    assert build_gig_profile(_facts(cv=0.5), _signals(), _streams(platform=1)).volatility == "변동"
    assert build_gig_profile(_facts(cv=0.9), _signals(), _streams(platform=1)).volatility == "고변동"


# ── 소득원 집중 (F02 밴드 재사용 — 50% 절벽) ──

def test_concentration_single_dependence_is_cliff_risk():
    g = build_gig_profile(_facts(cv=0.5, top_share=0.7), _signals(), _streams(platform=1))
    assert g.concentration == "단일 의존"
    assert any("소득 절벽" in n for n in g.notes)


def test_concentration_diversified():
    g = build_gig_profile(_facts(cv=0.5, top_share=0.3), _signals(), _streams(platform=2, repeat=2))
    assert g.concentration == "다각화"


# ── 수입 리듬 + N잡 (민영 피드백) ──

def test_multi_gig_detected():
    """플랫폼 + 반복 발주처가 함께 있으면 다중 스트림(N잡) — 리듬 분리 필요를 표기."""
    g = build_gig_profile(_facts(cv=0.5, top_share=0.4), _signals(),
                          _streams(platform=1, repeat=2, one_off=1.0))
    assert g.is_multi_gig is True and g.rhythm == "다중 스트림(N잡)"


def test_advance_rhythm():
    g = build_gig_profile(
        _facts(cv=0.5, top_share=0.6), _signals(),
        _streams(pending=[PendingSettlement("A사", "2025-05-01", 3_000_000, "2025-05-31", "x")]),
    )
    assert g.rhythm == "착수금-잔금형"


def test_platform_regular_rhythm():
    g = build_gig_profile(_facts(cv=0.5, top_share=0.6), _signals(), _streams(platform=1))
    assert g.rhythm == "플랫폼 정기형"


# ── 국면 (career_trend) ──

def test_phase_decline_leads_archetype():
    g = build_gig_profile(_facts(cv=0.5, top_share=0.6), _signals(trend=-0.02),
                          _streams(platform=1))
    assert g.phase == "감속 주의"
    assert g.archetype.startswith("감속 주의")   # 가장 actionable → 앞세움


# ── 유형 우선순위 ──

def test_archetype_high_vol_single_dependence():
    g = build_gig_profile(_facts(cv=0.9, top_share=0.8), _signals(trend=0.01),
                          _streams(platform=1))
    assert "버퍼가 생명줄" in g.archetype


# ── 콜드스타트 정직 ──

def test_cold_start_says_insufficient():
    g = build_gig_profile(_facts(cv=None, top_share=None), _signals(), _streams())
    assert g.volatility == "관측 부족" and g.rhythm == "리듬 형성 중"


# ── 라우트 — 판독 전에도 항상 조회 가능 (측정이라) ──

def test_gig_route_available_without_persona_read():
    from app.store.seed import ensure_seed
    ensure_seed()
    # 페르소나 판독을 안 해도 (심리축 없어도) 긱 프로필은 나온다
    body = client.get("/v1/profile/gig").json()
    assert body["volatility"] in ("안정", "변동", "고변동")
    assert body["archetype"]
    assert isinstance(body["is_multi_gig"], bool)
