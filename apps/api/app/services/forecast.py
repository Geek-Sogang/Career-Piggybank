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
- Bengen, W.P. (1994) "Determining Withdrawal Rates Using Historical Data", Journal of
  Financial Planning; Cooley/Hubbard/Walz (1998) "Trinity study". — 안전인출률(4% 룰) →
  자금 달성형 은퇴의 '은퇴 넘버' = 연 생활비 ÷ 0.04 = 25배.
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
from collections.abc import Callable
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

# ── 자금 달성형 은퇴 (funded retirement) — 소득 소멸형(A)과 병행하는 두 번째 정의 ──
# A(_cross_year·MC)는 "일감이 생활을 못 버티는 해"(소득 소멸). B는 "충분히 모아서 그만둘
# 수 있는 해"(자금 달성) — 저축이 예측을 움직이므로 저축 앱의 동기부여와 논리적으로 맞는다.
SAFE_WITHDRAWAL_RATE = 0.04    # 4% 룰(Bengen 1994·Trinity 1998) — 은퇴 넘버 = 연 생활비 ÷ 0.04
REAL_RETURN_ON_SAVINGS = 0.03  # 은퇴자금 실질 수익률(물가 차감 후, 보수적 prior — assumptions 노출)


@dataclass(frozen=True)
class IncomeGap:
    """다음 수입 예측 — Croston식 분리: 간격 분포만 다룬다 (크기는 프로필 담당)."""

    median_gap_days: float
    window_days: tuple[float, float]      # P25~P75 (Syntetos-Boylan: 평균 대신 분위수)
    last_income_date: str
    expected_next_date: str
    window: tuple[str, str]
    observed_deposits: int
    calibration_runs: int = 0   # 자기보정에 쓴 워크포워드 백테스트 횟수 (0=분위수 폴백)
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


def _walkforward_halfwidth(days: list[date]) -> tuple[float, int] | None:
    """자기보정(conformal 정신) — 과거로 돌아가 예측해 보고 실제 오차 분포로 창 폭을 정한다.

    i번째 입금을 그 이전 이력만으로 예측했을 때의 |오차|들을 모아 P80을 창 반폭으로.
    틀려온 만큼 넓어지고, 맞아온 만큼 좁아진다 — 백테스트 2회 미만이면 None(분위수 폴백).
    """
    errors: list[float] = []
    for i in range(3, len(days)):
        hist_gaps = [float((b - a).days) for a, b in zip(days[:i], days[1:i])]
        pred = days[i - 1] + timedelta(days=statistics.median(hist_gaps))
        errors.append(abs(float((days[i] - pred).days)))
    if len(errors) < 2:
        return None
    return _quantile(sorted(errors), 0.8), len(errors)


def next_income_window(income_dates: list[str]) -> IncomeGap:
    """입금 날짜들 → 간격 분포(중앙값·IQR)로 다음 수입 창을 예측 (Croston 1972 분리 원칙).

    이력이 충분하면 창 폭은 분위수 대신 **워크포워드 백테스트 실측 오차**(자기보정)로 정한다.
    """
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

    lo, hi = p25, p75
    calibration_runs = 0
    cal = _walkforward_halfwidth(days)
    if cal is not None:
        half, calibration_runs = cal
        if calibration_runs < 5:  # 소표본 보호 — P80이 사실상 max가 되는 구간은 분위수와 혼합
            half = 0.5 * half + 0.5 * ((p75 - p25) / 2)
        lo, hi = max(0.0, med - half), med + half
        reasons.append(
            f"창 자기보정: 과거로 돌아가 {calibration_runs}회 예측해 본 실측 오차 P80 ±{half:.0f}일 — "
            "틀릴수록 넓어지고 맞을수록 좁아져요"
        )

    return IncomeGap(
        median_gap_days=round(med, 1),
        window_days=(round(lo, 1), round(hi, 1)),
        last_income_date=last.isoformat(),
        expected_next_date=(last + timedelta(days=med)).isoformat(),
        window=((last + timedelta(days=lo)).isoformat(), (last + timedelta(days=hi)).isoformat()),
        observed_deposits=len(days),
        calibration_runs=calibration_runs,
        reasons=reasons,
    )


GAP_WEIGHT, CLIENT_WEIGHT, TICKET_WEIGHT = 0.5, 0.25, 0.25  # 간격=선행지표 최고 가중(Granger)
EARLY_DECLINE_THRESHOLD = -0.015  # (호환용 기준점) 배분 엔진의 버퍼 +1개월 판단에 사용

# 하락 국면 연속화 — 임계값 절벽(−1.4%와 −1.6%가 은퇴 몇 년 차이) 대신 비례 전환.
SOFT_DECLINE_START = -0.005   # 이보다 나쁘면 하락 기여가 '비례해서' 시작
FULL_DECLINE_AT = -0.03       # 클램프 한계 — 여기서 완전 하락 국면(severity=1)


def decline_severity(career_trend: float) -> float:
    """커리어 신호 → 하락 국면 진입 정도 0~1 (연속 — 절벽 없음).

    0 = 기존 성장 경로 그대로, 1 = 연령을 기다리지 않고 즉시 −8% 하락 국면.
    지난달 −1.4% → 이번 달 −1.6%가 은퇴 밴드를 몇 년씩 점프시키는 절벽 효과를 없앤다.
    """
    if career_trend >= SOFT_DECLINE_START:
        return 0.0
    return min(1.0, (SOFT_DECLINE_START - career_trend) / (SOFT_DECLINE_START - FULL_DECLINE_AT))


def _year_rate(age: int, growth: float, severity: float) -> float:
    """그 해의 소득 변화율 — 정점 이후는 하락, 이전은 성장↔하락을 severity로 혼합."""
    if age >= PEAK_AGE:
        return -DECLINE_AFTER_PEAK
    return (1.0 - severity) * growth - severity * DECLINE_AFTER_PEAK


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

    # 같은날 입금 뭉침으로 후반 간격 중앙값이 0이면 간격 신호는 중립(0) —
    # "간격이 0으로 좁아졌다"는 신호가 아니라 신호 부재다 (1/0 크래시 가드 겸용)
    gap_term = (1.0 / gap_ratio - 1.0) if gap_ratio > 0 else 0.0
    career_trend = (
        GAP_WEIGHT * gap_term                     # 간격 좁아짐(+) / 벌어짐(−)
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
    severity: float = 0.0,
) -> int:
    """일감 흐름 경로가 목표 생활비 아래로 내려가는 해를 탐색.

    severity(0~1)만큼 하락 국면이 비례해서 앞당겨진다 — 신호 악화가 연속적으로 반영되고,
    긱워커의 은퇴는 정년이 아니라 일감 소멸 시점이기 때문. (절벽 스위치 아님)
    """
    income = level * multiplier
    age, year = CURRENT_AGE, base_year
    for _ in range(MAX_HORIZON_YEARS):
        rate = _year_rate(age, growth, severity)
        income *= 1.0 + rate
        age += 1
        year += 1
        if rate < 0 and income < target:
            return year
    return base_year + MAX_HORIZON_YEARS


def _derive_params(
    monthly_incomes: list[float],
    monthly_living_target: float,
    income_cv: float,
    months_observed: int,
    signals: CareerSignals | None,
) -> tuple[CareerSignals, float, float, float, float, float]:
    """밴드와 경로가 공유하는 파라미터 한 벌 — 두 계산이 어긋나지 않도록 한 곳에서만 유도."""
    sig = signals or CareerSignals(1.0, 1.0, 1.0, 0.0, [])
    level = statistics.median(monthly_incomes) if monthly_incomes else monthly_living_target
    w = min(1.0, months_observed / TREND_BLEND_MONTHS)
    trend = _personal_annual_trend(monthly_incomes) * w
    growth = GROWTH_BEFORE_PEAK + trend + sig.career_trend
    severity = decline_severity(sig.career_trend)
    u = max(0.02, income_cv / BAND_WIDTH_CV_FRACTION)  # 밴드 폭 — 데이터 쌓일수록 좁아짐
    return sig, level, trend, growth, severity, u


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
    sig, level, trend, growth, severity, u = _derive_params(
        monthly_incomes, monthly_living_target, income_cv, months_observed, signals
    )
    w = min(1.0, months_observed / TREND_BLEND_MONTHS)

    scenarios = {"cons": 1.0 - income_cv / 2, "base": 1.0, "opt": 1.0 + income_cv / 2}
    bands = []
    for name, m in scenarios.items():
        early = _cross_year(level, m * (1 - u), monthly_living_target, growth, base_year, severity)
        late = _cross_year(level, m * (1 + u), monthly_living_target, growth, base_year, severity)
        lo, hi = min(early, late), max(early, late)
        bands.append(RetirementBand(scenario=name, band_start_year=lo, band_end_year=hi,
                                    label=f"{lo} ~ {hi}"))
    assumptions = {
        "current_age": CURRENT_AGE, "peak_age": PEAK_AGE,
        "growth_before_peak": GROWTH_BEFORE_PEAK, "decline_after_peak": DECLINE_AFTER_PEAK,
        "personal_trend_annual": round(trend, 4), "trend_blend_weight": round(w, 3),
        "career_trend_annual": sig.career_trend,
        "early_decline": str(severity >= 1.0), "decline_severity": round(severity, 3),
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
    _sig, level, _trend, growth, severity, _u = _derive_params(
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
            rate = _year_rate(age, growth, severity)
            effective = income * rng.choice(ratios)                     # ② 그 해의 변동
            income *= 1.0 + rate                                        # ③ 추세
            age += 1
            year += 1
            if rate < 0 and effective < monthly_living_target:          # ④ 교차
                retired = year
                break
        years_out.append(retired if retired is not None else base_year + MAX_HORIZON_YEARS)

    years_out.sort()
    q = lambda p: years_out[min(runs - 1, int(p * (runs - 1)))]  # noqa: E731
    return MonteCarlo(
        runs=runs, band_start_year=q(0.10), median_year=q(0.50), band_end_year=q(0.90),
        years=years_out,
    )


def _yearly_levels(level: float, growth: float, base_year: int, severity: float, n_years: int) -> list[float]:
    """_cross_year와 같은 점화식으로 연도별 월 소득 수준을 기록 (밴드-경로 일치 보장)."""
    income, age = level, CURRENT_AGE
    out = [income]
    for _ in range(n_years):
        income *= 1.0 + _year_rate(age, growth, severity)
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
    _, level, _, growth, severity, u = _derive_params(
        monthly_incomes, monthly_living_target, income_cv, months_observed, signals
    )
    if end_year is None:
        bands, _ = retirement_bands(
            monthly_incomes, monthly_living_target, income_cv, months_observed, base_year, signals
        )
        end_year = next(b for b in bands if b.scenario == "base").band_end_year + 3
    n_years = max(1, min(MAX_HORIZON_YEARS, end_year - base_year))

    base = _yearly_levels(level, growth, base_year, severity, n_years)
    years = list(range(base_year, base_year + n_years + 1))
    peak_idx = max(range(len(base)), key=base.__getitem__)
    return IncomePath(
        years=years,
        base=[round(v, 2) for v in base],
        lo=[round(v * (1 - u), 2) for v in base],
        hi=[round(v * (1 + u), 2) for v in base],
        peak_year=years[peak_idx],
    )


# ── 자금 달성형 은퇴 (B) — 저축이 은퇴 넘버에 도달하는 해 ──

@dataclass(frozen=True)
class FundedRetirement:
    """'충분히 모아서 그만둘 수 있는' 해 — 소득 소멸형(A)과 병행하는 두 번째 은퇴 정의.

    은퇴 넘버 = 연 생활비 ÷ 안전인출률(4% 룰) = 남은 평생을 저축으로 감당하는 수준.
    누적 저축이라 '한 달 삐끗'에 안 흔들리고(변동성은 도달 속도로 반영), 저축이 예측을
    움직인다 — 소득 소멸형은 저축을 아예 안 보므로 이 둘은 서로 다른 질문에 답한다.
    """

    target: float               # 은퇴 넘버 (도달해야 할 누적 저축, 원)
    funded_year: int            # 누적 저축이 target을 넘는 첫 해 (미달이면 지평선 끝)
    reached: bool               # MAX_HORIZON_YEARS 안에 도달했나
    years: list[int]            # 누적 저축 경로 x축 (차트용)
    savings_path: list[float]   # 연도별 누적 저축 (차트용)
    annual_surplus0: float      # 첫 해 저축 여력 = 세후 소득 − 연 생활비 (0이면 저축 불가)
    mc_p10: int                 # 부트스트랩 분포: 이르게 달성한 10%
    mc_median: int
    mc_p90: int
    reasons: list[str] = field(default_factory=list)


def _annual_surplus(monthly_income: float, annual_living: float, tax_rate: float) -> float:
    """그 해 저축 여력 = 세후 연소득 − 연 생활비 (음수면 0 — 저축 못 함)."""
    after_tax = monthly_income * 12.0 * (1.0 - max(0.0, min(1.0, tax_rate)))
    return max(0.0, after_tax - annual_living)


def _accumulate_to_target(
    start_income: float, annual_living: float, tax_rate: float, target: float,
    growth: float, severity: float, base_year: int, current_savings: float,
    year_income: Callable[[int, float], float] | None = None,
) -> tuple[int | None, list[float]]:
    """누적 저축 점화식 — 매년 (기존 저축×(1+수익률) + 저축여력). target 도달 해와 경로 반환.

    year_income(i, trend_income)이 주어지면 그 해 실현 소득을 대신 쓴다(몬테카를로 변동용).
    """
    income, savings, age = start_income, max(0.0, current_savings), CURRENT_AGE
    path = [round(savings, 2)]
    funded: int | None = None
    for i in range(MAX_HORIZON_YEARS):
        realized = year_income(i, income) if year_income else income
        savings = savings * (1.0 + REAL_RETURN_ON_SAVINGS) + _annual_surplus(
            realized, annual_living, tax_rate
        )
        if funded is None and savings >= target:
            funded = base_year + i
        income *= 1.0 + _year_rate(age, growth, severity)
        age += 1
        path.append(round(savings, 2))
    return funded, path


def funded_retirement(
    monthly_incomes: list[float],
    monthly_living_target: float,
    tax_rate: float,
    income_cv: float,
    months_observed: int,
    base_year: int,
    signals: CareerSignals | None = None,
    current_savings: float = 0.0,
    runs: int = 1000,
    seed: int = 42,
) -> FundedRetirement:
    """자금 달성형 은퇴 — 결정론 경로 + 부트스트랩 분포 (순수 함수, seed 고정).

    저축이 예측을 움직인다: 소득이 생활비를 넉넉히 웃돌수록·현재 저축이 많을수록 앞당겨지고,
    소득이 들쭉날쭉하면(변동성↑) 나쁜 해가 저축을 늦춰 밴드가 넓어지고 중앙값이 뒤로 간다.
    """
    _sig, level, _trend, growth, severity, _u = _derive_params(
        monthly_incomes, monthly_living_target, income_cv, months_observed, signals
    )
    annual_living = monthly_living_target * 12.0
    target = annual_living / SAFE_WITHDRAWAL_RATE if SAFE_WITHDRAWAL_RATE > 0 else float("inf")
    horizon_end = base_year + MAX_HORIZON_YEARS

    funded, path = _accumulate_to_target(
        level, annual_living, tax_rate, target, growth, severity, base_year, current_savings
    )
    years = list(range(base_year, base_year + len(path)))
    surplus0 = _annual_surplus(level, annual_living, tax_rate)

    # 부트스트랩 — 미래 소득을 내 월 소득 경험 분포에서 재표집 (가정 분포 없음, 순서 위험 반영).
    # 노이즈는 평균 1(÷pool 평균)이라 MC가 결정론 경로(level)를 중심으로 흔들린다 — 중앙값 기준
    # 비율과 평균 기준 수준을 섞어 소득을 이중으로 부풀리던 편향을 없앤다.
    rng = random.Random(seed)
    pool = [m for m in monthly_incomes if m > 0] or [level]
    pool_mean = statistics.mean(pool)
    noise = [m / pool_mean for m in pool] if pool_mean > 0 else [1.0]
    mc_years: list[int] = []
    for _ in range(runs):
        draws = [rng.choice(noise) for _ in range(MAX_HORIZON_YEARS)]
        f, _p = _accumulate_to_target(
            level, annual_living, tax_rate, target, growth, severity, base_year,
            current_savings, year_income=lambda i, inc, d=draws: inc * d[i],
        )
        mc_years.append(f if f is not None else horizon_end)
    mc_years.sort()
    q = lambda p: mc_years[min(runs - 1, int(p * (runs - 1)))]  # noqa: E731

    reasons = [
        f"은퇴 넘버 {target:,.0f}원 = 연 생활비 {annual_living:,.0f}원 ÷ 안전인출률 "
        f"{SAFE_WITHDRAWAL_RATE:.0%}(4% 룰) — 이만큼 모으면 저축만으로 생활 가능",
    ]
    if surplus0 <= 0:
        reasons.append("지금은 세후 소득이 생활비를 넘지 못해 저축 여력이 없어요 — 소득↑ 또는 생활비↓가 먼저")
    elif funded is None:
        reasons.append(
            f"현재 저축 속도(연 {surplus0:,.0f}원 + 실질수익 {REAL_RETURN_ON_SAVINGS:.0%})로는 "
            f"{MAX_HORIZON_YEARS}년 내 달성이 어려워요 — 저축을 늘리면 앞당겨져요"
        )
    else:
        reasons.append(
            f"현재 저축 속도면 {funded}년에 은퇴 넘버 도달 — 90%가 {q(0.90)}년 이전(변동성 반영)"
        )

    return FundedRetirement(
        target=round(target, 2),
        funded_year=funded if funded is not None else horizon_end,
        reached=funded is not None,
        years=years,
        savings_path=path,
        annual_surplus0=round(surplus0, 2),
        mc_p10=q(0.10), mc_median=q(0.50), mc_p90=q(0.90),
        reasons=reasons,
    )
