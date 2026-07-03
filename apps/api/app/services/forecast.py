"""수입·은퇴 예측 엔진 (§9-1① · §6-3) — 시계열, 전부 결정론.

긱워커 소득은 '간헐적(intermittent)' 시계열 — 정규 급여와 달리 입금 시점과 크기가
따로 논다. 그래서 방법을 다음 문헌 근거로 고른다 (전부 가정은 assumptions로 노출):

REFERENCES
- Croston, J.D. (1972) "Forecasting and stock control for intermittent demands",
  Operational Research Quarterly 23(3). — 간헐 수요는 '발생 간격'과 '크기'를 분리 추정.
  → 다음 수입 예측 = 입금 간격 분포(중앙값·IQR)와 금액을 분리해서 다룬다.
- Syntetos, A.A. & Boylan, J.E. (2005) "The accuracy of intermittent demand estimates",
  International Journal of Forecasting 21. — Croston 추정의 편향 논의 → 평균 대신 분위수 사용.
- Makridakis, S. & Hibon, M. (2000) "The M3-Competition", IJF 16;
  Makridakis et al. (2020) "The M4 Competition", IJF 36. — 짧고 노이즈 큰 시계열에서는
  단순 지수평활 계열이 복잡한 모델을 능가 → 딥러닝이 아니라 평활·외삽을 쓰는 근거.
- Gardner, E.S. & McKenzie, E. (1985) "Forecasting trends in time series",
  Management Science 31(10). — 감쇠 추세(damped trend): 장기 외삽에서 추세를 φ로
  눌러 과신을 방지 → 개인 추세를 감쇠·클램프해서 커리어 곡선에 반영.
- Mincer, J. (1974) "Schooling, Experience, and Earnings", NBER. — 연령-소득 곡선
  (상승 → 정점 → 하락)의 고전 근거 → 커리어 곡선 사전분포(prior)의 형태.
- Hyndman, R.J. & Athanasopoulos, G. "Forecasting: Principles and Practice". —
  점 추정이 아니라 예측구간 제시 → 은퇴 '시점'이 아니라 '밴드'(예: 2047~2049).
- Carroll, C.D. (1997) "Buffer-Stock Saving and the Life Cycle/Permanent Income
  Hypothesis", QJE 112(1). — 소득 불확실성이 클수록 완충 저축이 커진다 →
  allocator의 버퍼 목표 ∝ 변동계수 설계의 이론 근거(기존 엔진 보강).
- Granger, C.W.J. (1969) "Investigating causal relations...", Econometrica 37. —
  선행지표 개념: 커리어 활동이 소득에 1~3개월 선행(§6-3) → 활동 추세 가중(데모는 상수).
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from datetime import date, timedelta

# ── 커리어 곡선 사전분포 (Mincer 1974 형태의 데모 캘리브레이션 — 실서비스는 코호트 추정) ──
CURRENT_AGE = 28            # 조대흠 페르소나
PEAK_AGE = 42               # 소득 정점 연령 (prior)
GROWTH_BEFORE_PEAK = 0.02   # 정점 전 연 성장률 (prior)
DECLINE_AFTER_PEAK = 0.08   # 정점 후 연 하락률 (prior)
TREND_BLEND_MONTHS = 12     # 개인 추세 100% 반영까지 필요한 관측 개월 (콜드스타트 혼합)
TREND_CLAMP = 0.03          # 개인 추세가 성장률에 더할 수 있는 최대 ±(Gardner-McKenzie 감쇠 정신)
BAND_WIDTH_CV_FRACTION = 4  # 밴드 폭 = ±cv/4 (관측 쌓일수록 cv↓ → 밴드 좁아짐)
MAX_HORIZON_YEARS = 55
FALLBACK_GAP_DAYS = 30.0    # 입금 3건 미만 콜드스타트 기본 간격


@dataclass(frozen=True)
class IncomeGap:
    """다음 수입 예측 — Croston식 분리: 간격 분포만 다룬다 (크기는 프로필 담당)."""

    median_gap_days: float
    window_days: tuple[float, float]      # P25~P75 (Syntetos-Boylan: 평균 대신 분위수)
    last_income_date: str
    expected_next_date: str
    window: tuple[str, str]
    observed_deposits: int
    reasons: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class RetirementBand:
    scenario: str            # cons | base | opt
    band_start_year: int
    band_end_year: int
    label: str               # "2047 ~ 2049"


@dataclass(frozen=True)
class Forecast:
    income_gap: IncomeGap
    retirement: list[RetirementBand]
    monthly_income_level: float
    monthly_living_target: float
    income_cv: float
    assumptions: dict[str, float | int | str]


def _quantile(sorted_vals: list[float], q: float) -> float:
    if not sorted_vals:
        return 0.0
    idx = q * (len(sorted_vals) - 1)
    lo, hi = int(idx), min(int(idx) + 1, len(sorted_vals) - 1)
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (idx - lo)


def next_income_window(income_dates: list[str]) -> IncomeGap:
    """입금 날짜들 → 간격 분포(중앙값·IQR)로 다음 수입 창을 예측 (Croston 1972 분리 원칙)."""
    days = sorted(date.fromisoformat(d) for d in income_dates)
    reasons: list[str] = []
    if len(days) < 3:
        gaps = [FALLBACK_GAP_DAYS]
        reasons.append(f"입금 관측 {len(days)}건 — 간격은 직군 기본값 {FALLBACK_GAP_DAYS:.0f}일 사용(콜드스타트)")
    else:
        gaps = sorted(float((b - a).days) for a, b in zip(days, days[1:]))
    med = statistics.median(gaps)
    p25, p75 = _quantile(gaps, 0.25), _quantile(gaps, 0.75)
    last = days[-1] if days else date(1970, 1, 1)
    reasons.append(
        f"최근 입금 {len(days)}건의 간격 중앙값 {med:.0f}일 (P25~P75: {p25:.0f}~{p75:.0f}일)"
    )
    return IncomeGap(
        median_gap_days=round(med, 1),
        window_days=(round(p25, 1), round(p75, 1)),
        last_income_date=last.isoformat(),
        expected_next_date=(last + timedelta(days=med)).isoformat(),
        window=((last + timedelta(days=p25)).isoformat(), (last + timedelta(days=p75)).isoformat()),
        observed_deposits=len(days),
        reasons=reasons,
    )


def _personal_annual_trend(monthly_incomes: list[float]) -> float:
    """전반부 vs 후반부 중앙값 비교(강건) → 연율화 → 클램프 (감쇠 추세 정신)."""
    if len(monthly_incomes) < 4:
        return 0.0
    half = len(monthly_incomes) // 2
    first = statistics.median(monthly_incomes[:half])
    second = statistics.median(monthly_incomes[half:])
    if first <= 0:
        return 0.0
    months_apart = max(1.0, len(monthly_incomes) / 2)
    annual = (second / first) ** (12.0 / months_apart) - 1.0
    return max(-TREND_CLAMP, min(TREND_CLAMP, annual))


def _cross_year(level: float, multiplier: float, target: float, growth: float, base_year: int) -> int:
    """소득 경로(성장→정점→감쇠 하락)가 목표 생활비 아래로 내려가는 해를 탐색."""
    income = level * multiplier
    age, year = CURRENT_AGE, base_year
    for _ in range(MAX_HORIZON_YEARS):
        rate = growth if age < PEAK_AGE else -DECLINE_AFTER_PEAK
        income *= 1.0 + rate
        age += 1
        year += 1
        if age >= PEAK_AGE and income < target:
            return year
    return base_year + MAX_HORIZON_YEARS


def retirement_bands(
    monthly_incomes: list[float],
    monthly_living_target: float,
    income_cv: float,
    months_observed: int,
    base_year: int,
) -> tuple[list[RetirementBand], dict]:
    """3개 시나리오(보수/기본/낙관) × 신뢰구간 밴드 — 점이 아니라 구간(FPP 원칙)."""
    level = statistics.median(monthly_incomes) if monthly_incomes else monthly_living_target
    w = min(1.0, months_observed / TREND_BLEND_MONTHS)
    trend = _personal_annual_trend(monthly_incomes) * w
    growth = GROWTH_BEFORE_PEAK + trend
    u = max(0.02, income_cv / BAND_WIDTH_CV_FRACTION)  # 밴드 폭 — 데이터 쌓일수록 좁아짐

    scenarios = {"cons": 1.0 - income_cv / 2, "base": 1.0, "opt": 1.0 + income_cv / 2}
    bands = []
    for name, m in scenarios.items():
        early = _cross_year(level, m * (1 - u), monthly_living_target, growth, base_year)
        late = _cross_year(level, m * (1 + u), monthly_living_target, growth, base_year)
        lo, hi = min(early, late), max(early, late)
        bands.append(RetirementBand(scenario=name, band_start_year=lo, band_end_year=hi,
                                    label=f"{lo} ~ {hi}"))
    assumptions = {
        "current_age": CURRENT_AGE, "peak_age": PEAK_AGE,
        "growth_before_peak": GROWTH_BEFORE_PEAK, "decline_after_peak": DECLINE_AFTER_PEAK,
        "personal_trend_annual": round(trend, 4), "trend_blend_weight": round(w, 3),
        "band_width": round(u, 4), "income_cv": round(income_cv, 4),
        "monthly_income_level": round(level, 2),
        "method": "Mincer(1974) 연령-소득 prior + 감쇠 개인추세(Gardner-McKenzie 1985) 외삽, 구간 제시(FPP)",
    }
    return bands, assumptions
