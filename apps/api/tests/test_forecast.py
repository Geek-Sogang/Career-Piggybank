"""수입·은퇴 예측 엔진 테스트 — 간격 분포·밴드 성질(순서·폭·단조성)."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.engines.forecast import next_income_window, retirement_bands
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


def test_gap_empty_income_returns_honest_blank_not_1970() -> None:
    """입금 0건 — 가짜 앵커(1970-01-01)로 날짜를 지어내지 않고 빈 날짜를 반환한다."""
    g = next_income_window([])
    assert g.last_income_date == "" and g.expected_next_date == ""
    assert g.observed_deposits == 0
    assert "1970" not in str(g)
    assert any("예측할 근거" in r for r in g.reasons)


def test_gap_same_day_deposits_fall_back_not_today() -> None:
    """같은 날 뭉침(간격 전부 0) — '오늘 또 입금'이 아니라 기본 간격으로 폴백한다."""
    g = next_income_window(["2025-03-01", "2025-03-01", "2025-03-01"])
    assert g.median_gap_days == 30
    assert g.expected_next_date == "2025-03-31"   # 3-01 + 기본 30일 (같은 날 아님)
    assert any("간격 신호가 없어요" in r for r in g.reasons)


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


# ---------- 자금 달성형 은퇴 (B) — 저축이 예측을 움직인다 ----------

from app.engines.forecast import SAFE_WITHDRAWAL_RATE, funded_retirement  # noqa: E402


def _funded(incomes, living=1_150_000, tax=0.1, cv=0.3, months=4, savings=0.0, expense=0.0):
    return funded_retirement(incomes, living, tax, cv, months, base_year=2025,
                             current_savings=savings, monthly_expense=expense)


def test_funded_target_is_25x_annual_living() -> None:
    fr = _funded(INCOMES, living=1_000_000)
    assert fr.target == round(1_000_000 * 12 / SAFE_WITHDRAWAL_RATE, 2)   # 4% 룰 = 25배


def test_funded_savings_move_the_prediction() -> None:
    """소득 소멸형(A)과 달리 B는 저축이 예측을 움직인다 — 더 벌면 더 일찍 달성."""
    poor = _funded([1_100_000, 1_200_000, 1_150_000, 1_250_000])   # 생활비 언저리 — 여력 얇음
    rich = _funded([2_500_000, 3_000_000, 2_700_000, 3_200_000])   # 여력 큼
    assert rich.funded_year < poor.funded_year
    assert rich.annual_surplus0 > poor.annual_surplus0


def test_funded_starting_savings_pull_it_earlier() -> None:
    base = _funded([2_000_000, 2_200_000, 2_100_000, 2_300_000], savings=0)
    seeded = _funded([2_000_000, 2_200_000, 2_100_000, 2_300_000], savings=200_000_000)
    assert seeded.funded_year <= base.funded_year


def test_funded_no_surplus_is_unreachable_and_honest() -> None:
    # 세후 소득이 생활비 밑이면 저축 여력 0 → 도달 불가, 지어내지 않고 정직하게 표기
    fr = _funded([900_000, 950_000, 1_000_000, 1_050_000], living=1_500_000)
    assert fr.annual_surplus0 == 0
    assert fr.reached is False
    assert any("여력이 없" in r for r in fr.reasons)


def test_funded_volatility_widens_band() -> None:
    # 같은 평균이라도 변동성이 크면 밴드(P10~P90)가 넓어진다 (누적 저축의 순서 위험)
    steady = _funded([2_400_000, 2_400_000, 2_400_000, 2_400_000])
    swingy = _funded([600_000, 4_200_000, 800_000, 4_000_000])
    assert (swingy.mc_p90 - swingy.mc_p10) >= (steady.mc_p90 - steady.mc_p10)


def test_funded_expense_reduces_surplus_by_exactly_annual_expense() -> None:
    """유철 피드백: 경비(AWS·장비)는 실제 유출 — 저축 여력에서 연 경비만큼 정확히 빠진다.

    경비를 안 빼면 여력이 부풀어 funded_year가 앞당겨지는(지키기 어려운 약속) 버그.
    """
    incomes = [2_500_000, 3_000_000, 2_700_000, 3_200_000]
    no_exp = _funded(incomes, expense=0)
    with_exp = _funded(incomes, expense=500_000)   # 월 50만 = 연 600만원
    assert round(no_exp.annual_surplus0 - with_exp.annual_surplus0, 2) == 6_000_000
    assert with_exp.funded_year >= no_exp.funded_year   # 경비 반영 = 달성이 늦어짐(정직)


def test_funded_surplus_definition_matches_f09_subtractions() -> None:
    """저축 여력의 뺄셈 항이 F09(저축여력률)와 통일 — 둘 다 소득에서 생활비·경비를 뺀다.

    차이는 세금뿐(F09는 세전 비율, funded는 세후 원화). 세율 0이면 funded 여력 =
    (소득 − 생활비 − 경비)로 F09 분자와 동일 구조여야 한다.
    """
    incomes = [3_000_000] * 4          # 월 300만 균일 → 연 3,600만
    fr = _funded(incomes, living=1_200_000, expense=500_000, tax=0.0)
    # 세율 0: 연소득 3,600만 − 생활비 1,440만 − 경비 600만 = 1,560만
    assert fr.annual_surplus0 == 15_600_000


def test_funded_path_and_mc_order() -> None:
    fr = _funded([2_500_000, 3_000_000, 2_700_000, 3_200_000])
    assert len(fr.years) == len(fr.savings_path)
    assert fr.mc_p10 <= fr.mc_median <= fr.mc_p90


# ---------- 긱워커 전용 커리어 신호 ----------

from app.engines.forecast import career_signals  # noqa: E402


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

from app.engines.forecast import income_path  # noqa: E402


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

from app.engines.forecast import monte_carlo_retirement  # noqa: E402


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


# ---------- 자기보정 예측 창 (워크포워드 백테스트) ----------

def test_calibration_needs_enough_history() -> None:
    g = next_income_window(["2025-02-14", "2025-03-15", "2025-04-12", "2025-05-02"])
    assert g.calibration_runs == 0  # 백테스트 1회뿐 → 분위수 폴백


def test_calibrated_window_uses_backtest_errors() -> None:
    """규칙적 이력(오차 0) → 창이 사실상 점으로 좁아진다 — 맞을수록 좁아짐."""
    dates = [f"2025-{m:02d}-10" for m in range(1, 8)]  # 매달 10일, 간격 거의 일정
    g = next_income_window(dates)
    assert g.calibration_runs >= 2
    width = g.window_days[1] - g.window_days[0]
    assert width <= 4  # 실측 오차 P80이 매우 작다
    assert any("자기보정" in r for r in g.reasons)


def test_erratic_history_widens_calibrated_window() -> None:
    """불규칙 이력 → 실측 오차가 커서 창이 넓어진다 — 틀릴수록 넓어짐."""
    regular = next_income_window([f"2025-{m:02d}-10" for m in range(1, 8)])
    erratic = next_income_window(
        ["2025-01-05", "2025-01-09", "2025-03-02", "2025-03-06", "2025-05-20", "2025-05-28", "2025-07-01"]
    )
    def width(g):
        return g.window_days[1] - g.window_days[0]
    assert erratic.calibration_runs >= 2
    assert width(erratic) > width(regular)


# ---------- 하락 국면 연속화 — 임계값 절벽 제거 ----------

from app.engines.forecast import CareerSignals, decline_severity  # noqa: E402


def test_severity_is_continuous_and_monotonic() -> None:
    assert decline_severity(0.01) == 0.0
    assert decline_severity(-0.005) == 0.0
    assert 0 < decline_severity(-0.015) < 1
    assert decline_severity(-0.03) == 1.0
    assert decline_severity(-0.014) <= decline_severity(-0.016)  # 단조


def test_no_cliff_around_old_threshold() -> None:
    """trend −1.4% vs −1.6% — 거의 같은 사람은 거의 같은 밴드 (절벽 없음)."""
    def band_start(trend: float) -> int:
        sig = CareerSignals(1.0, 1.0, 1.0, trend, [])
        bands, _ = retirement_bands([1_200_000] * 6, 1_000_000, 0.3, 6, 2025, sig)
        return {b.scenario: b for b in bands}["base"].band_start_year
    assert abs(band_start(-0.014) - band_start(-0.016)) <= 2


def test_worse_signal_still_retires_earlier() -> None:
    """연속화 후에도 방향 보존: 신호가 나쁠수록 은퇴가 이르다."""
    def base_start(trend: float) -> int:
        sig = CareerSignals(1.0, 1.0, 1.0, trend, [])
        bands, _ = retirement_bands([1_200_000] * 6, 1_000_000, 0.3, 6, 2025, sig)
        return {b.scenario: b for b in bands}["base"].band_start_year
    assert base_start(-0.03) <= base_start(-0.015) <= base_start(0.0)


def test_severity_exposed_in_assumptions() -> None:
    sig = CareerSignals(1.0, 1.0, 1.0, -0.015, [])
    _, a = retirement_bands([1_200_000] * 6, 1_000_000, 0.3, 6, 2025, sig)
    assert 0 < a["decline_severity"] < 1


# ---------- 미확정 라벨은 예측에 들어가지 않는다 (7/4 검증 발견) ----------

def test_unreviewed_income_excluded_from_forecast() -> None:
    """needs_review인 income(고액 가드레일 등)은 확정 전까지 예측·pending에 반영 금지."""
    ensure_seed()
    from app.store import db
    db.insert_txn(date="2025-05-26", amount=2_500_000, direction="in",
                  counterparty="박준형", memo="착수금", kind="income", subtype="advance",
                  confidence=0.75, needs_review=True, signals=["고액 — 직접 확인 요청"])
    body = client.get("/v1/forecast").json()
    assert not any(p["counterparty"] == "박준형" for p in body["streams"]["pending_settlements"])
    assert not any("박준형" in c["label"] for c in body["streams"]["candidates"])
