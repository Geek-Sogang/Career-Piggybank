"""수입·은퇴 예측 엔진 테스트 — 간격 분포·밴드 성질(순서·폭·단조성)."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services.forecast import next_income_window, retirement_bands
from app.store.seed import ensure_seed

client = TestClient(app)


# ---------- 다음 수입 창 (Croston식 간격 분리) ----------

def test_gap_median_and_window() -> None:
    g = next_income_window(["2025-02-14", "2025-03-15", "2025-04-12", "2025-05-02"])
    # 간격: 29, 28, 20 → 중앙값 28
    assert g.median_gap_days == 28
    assert g.window_days[0] <= g.median_gap_days <= g.window_days[1]
    assert g.expected_next_date == "2025-05-30"  # 05-02 + 28일


def test_gap_cold_start_fallback() -> None:
    g = next_income_window(["2025-05-02", "2025-05-10"])
    assert g.median_gap_days == 30  # 3건 미만 → 직군 기본값
    assert any("콜드스타트" in r for r in g.reasons)


# ---------- 은퇴 밴드 ----------

INCOMES = [800_000, 1_450_000, 950_000, 1_700_000]  # 시드 월 소득


def make_bands(living=1_150_000, cv=0.3, months=4):
    return retirement_bands(INCOMES, living, cv, months, base_year=2025)


def test_band_start_before_end_and_after_base_year() -> None:
    bands, _ = make_bands()
    for b in bands:
        assert 2025 < b.band_start_year <= b.band_end_year
        assert b.label == f"{b.band_start_year} ~ {b.band_end_year}"


def test_conservative_retires_earlier_than_optimistic() -> None:
    bands, _ = make_bands()
    by = {b.scenario: b for b in bands}
    assert by["cons"].band_start_year <= by["base"].band_start_year <= by["opt"].band_start_year


def test_higher_living_target_means_earlier_retirement() -> None:
    low, _ = make_bands(living=900_000)
    high, _ = make_bands(living=1_600_000)
    assert {b.scenario: b for b in high}["base"].band_start_year <= \
           {b.scenario: b for b in low}["base"].band_start_year


def test_band_narrows_as_cv_shrinks() -> None:
    wide, _ = make_bands(cv=0.8)
    narrow, _ = make_bands(cv=0.1)
    def width(bands):
        b = {x.scenario: x for x in bands}["base"]
        return b.band_end_year - b.band_start_year
    assert width(narrow) <= width(wide)


def test_assumptions_are_exposed() -> None:
    _, a = make_bands()
    for key in ("peak_age", "growth_before_peak", "decline_after_peak",
                "personal_trend_annual", "band_width", "method"):
        assert key in a  # 숨은 계산 금지


def test_trend_is_clamped() -> None:
    # 폭증 이력이어도 개인 추세 기여는 ±3% 클램프 (Gardner-McKenzie 감쇠 정신)
    _, a = retirement_bands([100_000, 100_000, 3_000_000, 3_000_000], 1_000_000, 0.3, 12, 2025)
    assert abs(a["personal_trend_annual"]) <= 0.03 + 1e-9


# ---------- 라우트 (시드 원장 기반) ----------

def test_forecast_route_with_seed() -> None:
    ensure_seed()
    res = client.get("/v1/forecast")
    assert res.status_code == 200
    body = res.json()
    assert body["income_gap"]["observed_deposits"] >= 4
    assert len(body["retirement"]) == 3
    base = next(b for b in body["retirement"] if b["scenario"] == "base")
    assert 2030 < base["band_start_year"] < 2080  # 상식 범위
    assert body["assumptions"]["method"].startswith("Mincer")
