"""예측 라우트 — 원장 시계열 → 다음 수입 창 + 은퇴 밴드 (전부 결정론, 가정 노출)."""
from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.routes.bank import _boot
from app.services import bank_flow, forecast
from app.store import db

router = APIRouter(prefix="/v1/forecast", tags=["forecast"])


class IncomeGapOut(BaseModel):
    median_gap_days: float
    window_days: tuple[float, float]
    last_income_date: str
    expected_next_date: str
    window: tuple[str, str]
    observed_deposits: int
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


class ForecastResponse(BaseModel):
    income_gap: IncomeGapOut
    retirement: list[RetirementBandOut]
    career_signals: CareerSignalsOut
    path: IncomePathOut
    monthly_income_level: float
    monthly_living_target: float
    income_cv: float
    assumptions: dict[str, float | int | str]


@router.get("", response_model=ForecastResponse)
def get_forecast() -> ForecastResponse:
    """원장의 income 시계열로 다음 수입 창(Croston식)과 은퇴 밴드(Mincer prior 외삽)를 산출."""
    _boot()
    txns = db.list_txns()
    income_txns = [t for t in txns if t["kind"] == "income" and t["direction"] == "in"]
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
    base_band = next(b for b in bands if b.scenario == "base")
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
        monthly_income_level=assumptions["monthly_income_level"],  # type: ignore[arg-type]
        monthly_living_target=round(est.profile.expected_monthly_living, 2),
        income_cv=round(est.profile.income_cv, 4),
        assumptions=assumptions,
    )
