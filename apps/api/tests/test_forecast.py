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


# ---------- 긱워커 전용 커리어 신호 ----------

from app.services.forecast import career_signals  # noqa: E402


def make_income(dates_clients_amounts):
    return [{"date": d, "counterparty": c, "amount": a} for d, c, a in dates_clients_amounts]


HEALTHY = make_income([
    ("2025-01-10", "A사", 800_000), ("2025-02-12", "B스튜디오", 900_000),
    ("2025-03-10", "C컴퍼니", 1_000_000), ("2025-03-30", "D랩", 1_100_000),
    ("2025-04-15", "E사", 1_200_000), ("2025-04-28", "F사", 1_300_000),
])  # 간격 좁아지고 단가 오르는 건강한 흐름

DECLINING = make_income([
    ("2025-01-05", "A사", 1_500_000), ("2025-01-20", "B사", 1_400_000),
    ("2025-02-05", "C사", 1_300_000), ("2025-03-20", "A사", 900_000),
    ("2025-05-15", "A사", 700_000), ("2025-07-20", "A사", 500_000),
])  # 간격 벌어지고 발주처 줄고 단가 하락


def test_signals_read_direction() -> None:
    h, d = career_signals(HEALTHY), career_signals(DECLINING)
    assert h.career_trend > 0 > d.career_trend
    assert d.gap_ratio > 1 > 0  # 간격 벌어짐
    assert d.client_ratio < 1   # 발주처 축소
    assert any("일감" in r or "감속" in r for r in d.reasons)


def test_declining_career_retires_earlier() -> None:
    """같은 소득 수준이어도 커리어 신호가 나쁘면 은퇴 밴드가 앞당겨진다 — 긱워커 전용의 핵심."""
    incomes = [1_200_000] * 6
    healthy_bands, _ = retirement_bands(incomes, 1_000_000, 0.3, 6, 2025, career_signals(HEALTHY))
    declining_bands, a = retirement_bands(incomes, 1_000_000, 0.3, 6, 2025, career_signals(DECLINING))
    hb = {b.scenario: b for b in healthy_bands}["base"]
    db_ = {b.scenario: b for b in declining_bands}["base"]
    assert db_.band_start_year < hb.band_start_year
    assert a["early_decline"] == "True"  # 악화 신호 → 연령 prior 무시하고 즉시 하락 국면


def test_signals_cold_start_neutral() -> None:
    s = career_signals(make_income([("2025-01-10", "A사", 500_000)]))
    assert s.career_trend == 0.0
    assert any("콜드스타트" in r for r in s.reasons)


# ---------- 연도별 소득 경로 (차트 좌표의 원천) ----------

from app.services.forecast import income_path  # noqa: E402


def make_path(signals=None, **kw):
    args = dict(monthly_incomes=INCOMES, monthly_living_target=1_150_000,
                income_cv=0.3, months_observed=4, base_year=2025, signals=signals)
    args.update(kw)
    return income_path(**args)


def test_path_shape_and_ordering() -> None:
    p = make_path()
    assert len(p.years) == len(p.base) == len(p.lo) == len(p.hi)
    assert p.years[0] == 2025 and p.years == sorted(p.years)
    for lo, base, hi in zip(p.lo, p.base, p.hi):
        assert lo <= base <= hi  # 신뢰구간이 곡선을 감싼다


def test_path_crossing_agrees_with_band() -> None:
    """경로가 생활비 아래로 내려가는 해 = 은퇴 밴드 안 — 그림과 숫자가 같은 계산."""
    living = 1_150_000
    bands, _ = retirement_bands(INCOMES, living, 0.3, 4, 2025)
    base_band = {b.scenario: b for b in bands}["base"]
    p = make_path(end_year=base_band.band_end_year + 3)
    peak_idx = p.years.index(p.peak_year)
    cross = next(y for y, v in zip(p.years[peak_idx:], p.base[peak_idx:]) if v < living)
    assert base_band.band_start_year <= cross <= base_band.band_end_year


def test_path_covers_band_plus_margin() -> None:
    bands, _ = retirement_bands(INCOMES, 1_150_000, 0.3, 4, 2025)
    base_band = {b.scenario: b for b in bands}["base"]
    p = make_path()  # end_year 미지정 → 밴드 끝 + 3년
    assert p.years[-1] == base_band.band_end_year + 3


def test_path_rises_then_falls_with_healthy_signals() -> None:
    p = make_path(signals=career_signals(HEALTHY))
    peak_idx = p.years.index(p.peak_year)
    assert peak_idx > 0                      # 정점 전 상승 구간이 존재
    assert p.base[-1] < p.base[peak_idx]     # 정점 후 하락


def test_path_early_decline_starts_falling_now() -> None:
    p = make_path(signals=career_signals(DECLINING))
    assert p.peak_year == p.years[0]         # 신호 악화 → 첫 해부터 하락 국면
    assert p.base[1] < p.base[0]


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
    assert body["assumptions"]["method"].startswith("긱워커")
    assert len(body["career_signals"]["reasons"]) >= 2  # 긱워커 신호 근거 노출
    # 차트 경로: 밴드와 같은 좌표계, 목표선 포함
    path = body["path"]
    assert len(path["years"]) == len(path["base"]) == len(path["lo"]) == len(path["hi"])
    assert path["years"][-1] == base["band_end_year"] + 3
    assert path["living_target"] > 0
    assert path["years"][0] <= path["peak_year"] <= path["years"][-1]


# ---------- 몬테카를로 은퇴 시뮬레이션 (부트스트랩, seed 고정) ----------

from app.services.forecast import monte_carlo_retirement  # noqa: E402


def make_mc(incomes=INCOMES, cv=0.3, seed=42, runs=500, signals=None):
    return monte_carlo_retirement(incomes, 1_150_000, cv, 4, 2025, signals, runs=runs, seed=seed)


def test_mc_is_reproducible_with_seed() -> None:
    """같은 seed = 같은 분포 — 감사 재현성 (temperature 0과 같은 정신)."""
    a, b = make_mc(seed=7), make_mc(seed=7)
    assert a.years == b.years


def test_mc_quantiles_ordered() -> None:
    m = make_mc()
    assert 2025 < m.band_start_year <= m.median_year <= m.band_end_year
    assert len(m.years) == m.runs


def test_mc_more_volatile_income_widens_band() -> None:
    """변동이 큰 원장 → 미래 분포가 넓어진다 — 들쭉날쭉함이 입력이 되는 증거."""
    calm = make_mc(incomes=[1_200_000] * 8, runs=800)
    wild = make_mc(incomes=[200_000, 2_600_000, 300_000, 2_400_000] * 2, runs=800)
    calm_width = calm.band_end_year - calm.band_start_year
    wild_width = wild.band_end_year - wild.band_start_year
    assert wild_width >= calm_width


def test_mc_declining_signals_shift_distribution_earlier() -> None:
    healthy = make_mc(signals=career_signals(HEALTHY))
    declining = make_mc(signals=career_signals(DECLINING))
    assert declining.median_year < healthy.median_year


def test_mc_exposed_in_route() -> None:
    ensure_seed()
    body = client.get("/v1/forecast").json()
    mc = body["mc"]
    assert mc["runs"] == 1000
    assert mc["band_start_year"] <= mc["median_year"] <= mc["band_end_year"]
    assert 0.0 <= mc["prob_in_base_band"] <= 1.0
