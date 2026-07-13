"""예측 라우트 — 원장 시계열 → 다음 수입 창 + 은퇴 밴드 (전부 결정론, 가정 노출)."""
from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.routes.bank import _boot
from app.orchestration import bank_flow
from app.engines import forecast, income_streams, tax_envelope
from app.store import db

router = APIRouter(prefix="/v1/forecast", tags=["forecast"])


class IncomeGapOut(BaseModel):
    median_gap_days: float
    window_days: tuple[float, float]
    last_income_date: str
    expected_next_date: str
    window: tuple[str, str]
    observed_deposits: int
    calibration_runs: int
    reasons: list[str]


class RetirementBandOut(BaseModel):
    scenario: str
    band_start_year: int
    band_end_year: int
    label: str


class CareerSignalsOut(BaseModel):
    gap_ratio: float
    client_ratio: float
    ticket_ratio: float
    career_trend: float
    reasons: list[str]


class IncomePathOut(BaseModel):
    """차트가 그대로 그리는 연도별 경로 — 곡선·신뢰구간 띠·정점 전부 이 좌표에서 나온다."""

    years: list[int]
    base: list[float]
    lo: list[float]
    hi: list[float]
    peak_year: int
    living_target: float


class StreamCandidateOut(BaseModel):
    source: str
    label: str
    expected_date: str
    basis: str


class PendingSettlementOut(BaseModel):
    counterparty: str
    advance_date: str
    advance_amount: float
    expected_date: str
    basis: str


class StaleSettlementOut(BaseModel):
    counterparty: str
    advance_date: str
    advance_amount: float
    question: str


class StreamsOut(BaseModel):
    """소득 물줄기 분해 — 분류기 라벨(플랫폼·advance)이 예측의 전처리가 된다."""

    platform_channels: int
    repeat_clients: int
    one_off_per_month: float
    candidates: list[StreamCandidateOut]
    pending_settlements: list[PendingSettlementOut]
    stale_settlements: list[StaleSettlementOut]
    composite_next: StreamCandidateOut | None
    reasons: list[str]


class MonteCarloOut(BaseModel):
    """부트스트랩 몬테카를로 — 미래를 1,000번 살아본 은퇴 해 분포 (seed 고정, 재현 가능)."""

    runs: int
    band_start_year: int          # P10
    median_year: int              # P50
    band_end_year: int            # P90
    prob_in_base_band: float      # 결정론 기본 밴드 안에 떨어진 미래의 비율


class FundedRetirementOut(BaseModel):
    """자금 달성형 은퇴 (B) — 저축이 은퇴 넘버에 도달하는 해. 소득 소멸형(A)과 병행.

    A(위 retirement/mc)는 '일감이 생활을 못 버티는 해', B는 '충분히 모아 그만둘 수 있는 해'.
    저축이 예측을 움직인다 — 저축 앱의 은퇴 예측이라면 이 정의가 논리적으로 맞다.
    """

    target: float                 # 은퇴 넘버 = 연 생활비 ÷ 4%
    funded_year: int              # 결정론 달성 해 (미달이면 지평선 끝)
    reached: bool                 # 지평선 안에 도달했나
    annual_surplus0: float        # 첫 해 저축 여력(세후 소득 − 생활비) — 0이면 저축 불가
    mc_p10: int                   # 부트스트랩 분포: 이르게 달성한 10%
    mc_median: int
    mc_p90: int
    years: list[int]              # 누적 저축 경로 x축
    savings_path: list[float]     # 연도별 누적 저축 (차트용)
    reasons: list[str]


class ForecastResponse(BaseModel):
    income_gap: IncomeGapOut
    retirement: list[RetirementBandOut]
    career_signals: CareerSignalsOut
    path: IncomePathOut
    streams: StreamsOut
    mc: MonteCarloOut
    funded: FundedRetirementOut
    monthly_income_level: float
    monthly_living_target: float
    income_cv: float
    assumptions: dict[str, float | int | str]


@router.get("", response_model=ForecastResponse)
def get_forecast() -> ForecastResponse:
    """원장의 income 시계열로 다음 수입 창(Croston식)과 은퇴 밴드(Mincer prior 외삽)를 산출."""
    _boot()
    txns = db.list_txns()
    # 미확정(needs_review) 라벨은 예측에 들어가지 않는다 — 확신 없으면 반영 금지 원칙은
    # 분류만이 아니라 그 라벨을 소비하는 모든 통계에 적용된다 (7/4 검증에서 발견)
    income_txns = [
        t for t in txns
        if t["kind"] == "income" and t["direction"] == "in" and not t["needs_review"]
    ]
    income_dates = [t["date"] for t in income_txns]

    by_month: dict[str, float] = defaultdict(float)
    for t in income_txns:
        by_month[t["date"][:7]] += t["amount"]
    monthly_incomes = [by_month[m] for m in sorted(by_month)]
    signals = forecast.career_signals(income_txns)  # 긱워커 전용 신호 — 우리 원장만 가능

    est = bank_flow.profile_from_store()
    base_year = int(max(income_dates)[:4]) if income_dates else 2025

    gap = forecast.next_income_window(income_dates)
    bands, assumptions = forecast.retirement_bands(
        monthly_incomes=monthly_incomes,
        monthly_living_target=est.profile.expected_monthly_living,
        income_cv=est.profile.income_cv,
        months_observed=est.months_observed,
        base_year=base_year,
        signals=signals,
    )
    future_events = [
        e for e in db.list_expected_events()
        if not income_dates or e["date"] > max(income_dates)
    ]
    as_of = max((t["date"] for t in txns), default=None)
    streams = income_streams.decompose(
        income_txns, months_observed=float(est.months_observed),
        user_events=future_events, as_of=as_of,
    )
    composite = income_streams.composite_next(
        streams, after=max(income_dates) if income_dates else "1970-01-01"
    )

    base_band = next(b for b in bands if b.scenario == "base")
    mc = forecast.monte_carlo_retirement(
        monthly_incomes=monthly_incomes,
        monthly_living_target=est.profile.expected_monthly_living,
        income_cv=est.profile.income_cv,
        months_observed=est.months_observed,
        base_year=base_year,
        signals=signals,
    )
    in_band = sum(1 for y in mc.years if base_band.band_start_year <= y <= base_band.band_end_year)

    # B — 자금 달성형: 세율(연 매출 기준 실효 추가세율)로 저축 여력을 계산해 은퇴 넘버 도달 해를 낸다
    tax_rate = max(0.0, tax_envelope.estimate_annual_tax(est.profile.annual_gross).effective_tax_rate)
    funded = forecast.funded_retirement(
        monthly_incomes=monthly_incomes,
        monthly_living_target=est.profile.expected_monthly_living,
        tax_rate=tax_rate,
        income_cv=est.profile.income_cv,
        months_observed=est.months_observed,
        base_year=base_year,
        signals=signals,
        monthly_expense=est.profile.expected_monthly_expense,  # 경비도 실제 유출 — 저축 여력에서 뺀다
    )

    path = forecast.income_path(
        monthly_incomes=monthly_incomes,
        monthly_living_target=est.profile.expected_monthly_living,
        income_cv=est.profile.income_cv,
        months_observed=est.months_observed,
        base_year=base_year,
        signals=signals,
        end_year=base_band.band_end_year + 3,
    )
    return ForecastResponse(
        income_gap=IncomeGapOut(**gap.__dict__),
        retirement=[RetirementBandOut(**b.__dict__) for b in bands],
        career_signals=CareerSignalsOut(**signals.__dict__),
        path=IncomePathOut(
            **path.__dict__, living_target=round(est.profile.expected_monthly_living, 2)
        ),
        streams=StreamsOut(
            platform_channels=streams.platform_channels,
            repeat_clients=streams.repeat_clients,
            one_off_per_month=streams.one_off_per_month,
            candidates=[StreamCandidateOut(**c.__dict__) for c in streams.candidates],
            pending_settlements=[PendingSettlementOut(**p.__dict__) for p in streams.pending_settlements],
            stale_settlements=[StaleSettlementOut(**st.__dict__) for st in streams.stale_settlements],
            composite_next=StreamCandidateOut(**composite.__dict__) if composite else None,
            reasons=streams.reasons,
        ),
        mc=MonteCarloOut(
            runs=mc.runs, band_start_year=mc.band_start_year, median_year=mc.median_year,
            band_end_year=mc.band_end_year, prob_in_base_band=round(in_band / mc.runs, 3),
        ),
        funded=FundedRetirementOut(
            target=funded.target, funded_year=funded.funded_year, reached=funded.reached,
            annual_surplus0=funded.annual_surplus0, mc_p10=funded.mc_p10,
            mc_median=funded.mc_median, mc_p90=funded.mc_p90, years=funded.years,
            savings_path=funded.savings_path, reasons=funded.reasons,
        ),
        monthly_income_level=assumptions["monthly_income_level"],  # type: ignore[arg-type]
        monthly_living_target=round(est.profile.expected_monthly_living, 2),
        income_cv=round(est.profile.income_cv, 4),
        assumptions=assumptions,
    )
