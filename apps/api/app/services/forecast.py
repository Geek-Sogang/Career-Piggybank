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
  선행지표 개념: 커리어 활동이 소득에 1~3개월 선행(§6-3) → 커리어 신호 가중.

긱워커 전용 설계 (§6-3 "입금만으로는 카뱅도 한다"의 답):
은퇴를 '정년'이 아니라 **일감 흐름이 생활비 아래로 내려가는 시점**으로 정의하고,
연령 곡선(Mincer)은 약한 사전분포로만 쓴다. 주 동력은 우리 원장(분류기 라벨)만
가진 3개 커리어 신호 — ① 수주 간격 추세(간격 확대=일감 감소 선행) ② 발주처 다양성
추세 ③ 건당 단가 추세. OAuth 활동 시계열(커밋 등)은 실연동 시 4번째 신호로 추가.
"""
from __future__ import annotations

import random
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
class CareerSignals:
    """긱워커 전용 커리어 신호 — 원장(분류기 라벨)만 만들 수 있는 데이터.

    각 신호는 후반부/전반부 비율: 1.0 = 유지, >1 = 개선, <1 = 악화 (간격은 반대로 해석).
    """

    gap_ratio: float            # 수주 간격 후반/전반 (>1 = 간격 벌어짐 = 악화)
    client_ratio: float         # 고유 발주처 수 후반/전반 (<1 = 다양성 축소)
    ticket_ratio: float         # 건당 단가 중앙값 후반/전반 (<1 = 단가 하락)
    career_trend: float         # 종합: 연 성장률 보정치 (± TREND_CLAMP 클램프)
    reasons: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class RetirementBand:
    scenario: str            # cons | base | opt
    band_start_year: int
    band_end_year: int
    label: str               # "2047 ~ 2049"


@dataclass(frozen=True)
class IncomePath:
    """연도별 일감 흐름 경로 — 차트가 그리는 좌표의 원천 (은퇴 밴드와 같은 파라미터로 산출)."""

    years: list[int]         # base_year부터 밴드 뒤 몇 해까지
    base: list[float]        # 기본 시나리오 월 소득 수준 (원)
    lo: list[float]          # 신뢰구간 하단 (base × (1−u))
    hi: list[float]          # 신뢰구간 상단 (base × (1+u))
    peak_year: int           # 경로 정점 해 (연령 prior 또는 early_decline이면 시작 해)


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


GAP_WEIGHT, CLIENT_WEIGHT, TICKET_WEIGHT = 0.5, 0.25, 0.25  # 간격=선행지표 최고 가중(Granger)
EARLY_DECLINE_THRESHOLD = -0.015  # 커리어 신호가 이보다 나쁘면 하락 국면이 이미 시작된 것으로


def _halves(items: list) -> tuple[list, list]:
    mid = len(items) // 2
    return items[:mid], items[mid:]


def career_signals(income_txns: list[dict]) -> CareerSignals:
    """income 거래(date·amount·counterparty) → 긱워커 전용 커리어 신호.

    전·후반 비교(강건)로 수주 간격·발주처 다양성·단가의 방향을 읽는다.
    은퇴 정의가 '정년'이 아니라 '일감 흐름 소멸'이므로, 이 신호가 연령 prior보다 우선한다.
    """
    txns = sorted(income_txns, key=lambda t: t["date"])
    reasons: list[str] = []
    if len(txns) < 4:
        return CareerSignals(1.0, 1.0, 1.0, 0.0,
                             ["income 관측 4건 미만 — 커리어 신호는 중립(콜드스타트)"])

    days = [date.fromisoformat(t["date"]) for t in txns]
    gaps = [float((b - a).days) for a, b in zip(days, days[1:])]
    g1, g2 = _halves(gaps)
    gap_ratio = (statistics.median(g2) / statistics.median(g1)) if g1 and statistics.median(g1) > 0 else 1.0

    t1, t2 = _halves(txns)
    c1 = len({t["counterparty"] for t in t1}) or 1
    c2 = len({t["counterparty"] for t in t2}) or 1
    client_ratio = c2 / c1

    ticket_ratio = statistics.median([t["amount"] for t in t2]) / max(1.0, statistics.median([t["amount"] for t in t1]))

    career_trend = (
        GAP_WEIGHT * (1.0 / gap_ratio - 1.0)      # 간격 좁아짐(+) / 벌어짐(−)
        + CLIENT_WEIGHT * (client_ratio - 1.0)
        + TICKET_WEIGHT * (ticket_ratio - 1.0)
    )
    career_trend = max(-TREND_CLAMP, min(TREND_CLAMP, career_trend))

    reasons.append(
        f"수주 간격 {statistics.median(g1):.0f}일 → {statistics.median(g2):.0f}일 "
        f"({'좁아지는 중 — 일감 흐름 건강' if gap_ratio < 1 else '벌어지는 중 — 감속 신호' if gap_ratio > 1 else '유지'})"
    )
    reasons.append(f"독립 발주처 {c1}곳 → {c2}곳 · 건당 단가 추세 ×{ticket_ratio:.2f}")
    reasons.append(f"커리어 신호 종합 {career_trend:+.1%}/년 — 연령 곡선보다 우선 반영")
    return CareerSignals(round(gap_ratio, 3), round(client_ratio, 3), round(ticket_ratio, 3),
                         round(career_trend, 4), reasons)


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


def _cross_year(
    level: float, multiplier: float, target: float, growth: float, base_year: int,
    early_decline: bool = False,
) -> int:
    """일감 흐름 경로가 목표 생활비 아래로 내려가는 해를 탐색.

    early_decline=True(커리어 신호 악화)면 연령 prior를 기다리지 않고 지금부터 하락 —
    긱워커의 은퇴는 정년이 아니라 일감 소멸 시점이기 때문.
    """
    income = level * multiplier
    age, year = CURRENT_AGE, base_year
    for _ in range(MAX_HORIZON_YEARS):
        declining = early_decline or age >= PEAK_AGE
        rate = -DECLINE_AFTER_PEAK if declining else growth
        income *= 1.0 + rate
        age += 1
        year += 1
        if declining and income < target:
            return year
    return base_year + MAX_HORIZON_YEARS


def _derive_params(
    monthly_incomes: list[float],
    monthly_living_target: float,
    income_cv: float,
    months_observed: int,
    signals: CareerSignals | None,
) -> tuple[CareerSignals, float, float, float, bool, float]:
    """밴드와 경로가 공유하는 파라미터 한 벌 — 두 계산이 어긋나지 않도록 한 곳에서만 유도."""
    sig = signals or CareerSignals(1.0, 1.0, 1.0, 0.0, [])
    level = statistics.median(monthly_incomes) if monthly_incomes else monthly_living_target
    w = min(1.0, months_observed / TREND_BLEND_MONTHS)
    trend = _personal_annual_trend(monthly_incomes) * w
    growth = GROWTH_BEFORE_PEAK + trend + sig.career_trend
    early_decline = sig.career_trend <= EARLY_DECLINE_THRESHOLD
    u = max(0.02, income_cv / BAND_WIDTH_CV_FRACTION)  # 밴드 폭 — 데이터 쌓일수록 좁아짐
    return sig, level, trend, growth, early_decline, u


def retirement_bands(
    monthly_incomes: list[float],
    monthly_living_target: float,
    income_cv: float,
    months_observed: int,
    base_year: int,
    signals: CareerSignals | None = None,
) -> tuple[list[RetirementBand], dict]:
    """3개 시나리오(보수/기본/낙관) × 신뢰구간 밴드 — 점이 아니라 구간(FPP 원칙).

    긱워커 전용: 커리어 신호(수주 간격·발주처·단가)가 성장률을 보정하고,
    신호가 악화 임계 아래면 연령 prior를 기다리지 않고 하락 국면을 즉시 시작한다.
    """
    sig, level, trend, growth, early_decline, u = _derive_params(
        monthly_incomes, monthly_living_target, income_cv, months_observed, signals
    )
    w = min(1.0, months_observed / TREND_BLEND_MONTHS)

    scenarios = {"cons": 1.0 - income_cv / 2, "base": 1.0, "opt": 1.0 + income_cv / 2}
    bands = []
    for name, m in scenarios.items():
        early = _cross_year(level, m * (1 - u), monthly_living_target, growth, base_year, early_decline)
        late = _cross_year(level, m * (1 + u), monthly_living_target, growth, base_year, early_decline)
        lo, hi = min(early, late), max(early, late)
        bands.append(RetirementBand(scenario=name, band_start_year=lo, band_end_year=hi,
                                    label=f"{lo} ~ {hi}"))
    assumptions = {
        "current_age": CURRENT_AGE, "peak_age": PEAK_AGE,
        "growth_before_peak": GROWTH_BEFORE_PEAK, "decline_after_peak": DECLINE_AFTER_PEAK,
        "personal_trend_annual": round(trend, 4), "trend_blend_weight": round(w, 3),
        "career_trend_annual": sig.career_trend, "early_decline": str(early_decline),
        "gap_ratio": sig.gap_ratio, "client_ratio": sig.client_ratio, "ticket_ratio": sig.ticket_ratio,
        "band_width": round(u, 4), "income_cv": round(income_cv, 4),
        "monthly_income_level": round(level, 2),
        "method": "긱워커 일감흐름 모델: 커리어 신호(수주간격·발주처·단가) 우선 + Mincer(1974) 연령 prior + 감쇠 외삽(Gardner-McKenzie 1985), 구간 제시(FPP)",
    }
    return bands, assumptions


@dataclass(frozen=True)
class MonteCarlo:
    """부트스트랩 몬테카를로 은퇴 시뮬레이션 결과 — 미래를 runs번 살아본 분포.

    은퇴설계 실무 표준 기법(뱅가드·미래에셋류 시뮬레이터와 같은 계열)을 우리 데이터에 맞게:
    - 미래 소득 수준·연간 변동을 **내 월 소득의 경험 분포에서 재표집**(가정 분포 없음)
    - 성장률·하락 국면은 결정론 점화식과 동일 (커리어 신호·early_decline 반영)
    - seed 고정 → 같은 입력 = 같은 분포 (재현성·감사 대응, temperature 0과 같은 정신)
    """

    runs: int
    band_start_year: int   # P10 — 1,000개 미래 중 이르게 은퇴한 쪽 10%
    median_year: int       # P50
    band_end_year: int     # P90
    years: list[int] = field(default_factory=list)  # 전체 표본 (route가 확률 계산 후 폐기)


def monte_carlo_retirement(
    monthly_incomes: list[float],
    monthly_living_target: float,
    income_cv: float,
    months_observed: int,
    base_year: int,
    signals: CareerSignals | None = None,
    runs: int = 1000,
    seed: int = 42,
) -> MonteCarlo:
    """미래를 runs번 시뮬레이션해 은퇴 해의 분포를 얻는다 (순수 함수, seed 고정).

    각 미래: ① 연 소득 수준 = 월 소득 12개 부트스트랩 재표집 평균
             ② 매년 경험적 변동 곱(내 월 소득 / 중앙값 비율에서 재표집) — 순서 위험 반영
             ③ 성장·하락은 결정론 점화식과 동일한 파라미터
             ④ 하락 국면에서 (변동 반영) 소득이 생활비 아래로 → 그 해를 기록
    """
    _sig, level, _trend, growth, early_decline, _u = _derive_params(
        monthly_incomes, monthly_living_target, income_cv, months_observed, signals
    )
    rng = random.Random(seed)
    pool = [m for m in monthly_incomes if m > 0] or [level]
    ratios = [m / level for m in pool] if level > 0 else [1.0]

    years_out: list[int] = []
    for _ in range(runs):
        income = statistics.mean(rng.choice(pool) for _ in range(12))  # ① 수준 재표집
        age, year = CURRENT_AGE, base_year
        retired = None
        for _ in range(MAX_HORIZON_YEARS):
            declining = early_decline or age >= PEAK_AGE
            rate = -DECLINE_AFTER_PEAK if declining else growth
            effective = income * rng.choice(ratios)                     # ② 그 해의 변동
            income *= 1.0 + rate                                        # ③ 추세
            age += 1
            year += 1
            if declining and effective < monthly_living_target:         # ④ 교차
                retired = year
                break
        years_out.append(retired if retired is not None else base_year + MAX_HORIZON_YEARS)

    years_out.sort()
    q = lambda p: years_out[min(runs - 1, int(p * (runs - 1)))]  # noqa: E731
    return MonteCarlo(
        runs=runs, band_start_year=q(0.10), median_year=q(0.50), band_end_year=q(0.90),
        years=years_out,
    )


def _yearly_levels(level: float, growth: float, base_year: int, early_decline: bool, n_years: int) -> list[float]:
    """_cross_year와 같은 점화식으로 연도별 월 소득 수준을 기록 (밴드-경로 일치 보장)."""
    income, age = level, CURRENT_AGE
    out = [income]
    for _ in range(n_years):
        declining = early_decline or age >= PEAK_AGE
        rate = -DECLINE_AFTER_PEAK if declining else growth
        income *= 1.0 + rate
        age += 1
        out.append(income)
    return out


def income_path(
    monthly_incomes: list[float],
    monthly_living_target: float,
    income_cv: float,
    months_observed: int,
    base_year: int,
    signals: CareerSignals | None = None,
    end_year: int | None = None,
) -> IncomePath:
    """차트용 연도별 일감 흐름 경로 — retirement_bands와 같은 파라미터·점화식.

    base = 기본 시나리오, lo/hi = ±u 신뢰구간 (밴드 탐색이 쓰는 것과 동일한 폭).
    end_year 미지정 시 기본 시나리오 밴드 끝 + 3년까지 그린다.
    """
    _, level, _, growth, early_decline, u = _derive_params(
        monthly_incomes, monthly_living_target, income_cv, months_observed, signals
    )
    if end_year is None:
        bands, _ = retirement_bands(
            monthly_incomes, monthly_living_target, income_cv, months_observed, base_year, signals
        )
        end_year = next(b for b in bands if b.scenario == "base").band_end_year + 3
    n_years = max(1, min(MAX_HORIZON_YEARS, end_year - base_year))

    base = _yearly_levels(level, growth, base_year, early_decline, n_years)
    years = list(range(base_year, base_year + n_years + 1))
    peak_idx = max(range(len(base)), key=base.__getitem__)
    return IncomePath(
        years=years,
        base=[round(v, 2) for v in base],
        lo=[round(v * (1 - u), 2) for v in base],
        hi=[round(v * (1 + u), 2) for v in base],
        peak_year=years[peak_idx],
    )
