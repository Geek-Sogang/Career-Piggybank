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


class ForecastResponse(BaseModel):
    income_gap: IncomeGapOut
    retirement: list[RetirementBandOut]
    monthly_income_level: float
    monthly_living_target: float
    income_cv: float
    assumptions: dict[str, float | int | str]


@router.get("", response_model=ForecastResponse)
def get_forecast() -> ForecastResponse:
    """원장의 income 시계열로 다음 수입 창(Croston식)과 은퇴 밴드(Mincer prior 외삽)를 산출."""
    _boot()
    txns = db.list_txns()
    income_dates = [t["date"] for t in txns if t["kind"] == "income" and t["direction"] == "in"]

    by_month: dict[str, float] = defaultdict(float)
    for t in txns:
        if t["kind"] == "income" and t["direction"] == "in":
            by_month[t["date"][:7]] += t["amount"]
    monthly_incomes = [by_month[m] for m in sorted(by_month)]

    est = bank_flow.profile_from_store()
    base_year = int(max(income_dates)[:4]) if income_dates else 2025

    gap = forecast.next_income_window(income_dates)
    bands, assumptions = forecast.retirement_bands(
        monthly_incomes=monthly_incomes,
        monthly_living_target=est.profile.expected_monthly_living,
        income_cv=est.profile.income_cv,
        months_observed=est.months_observed,
        base_year=base_year,
    )
    return ForecastResponse(
        income_gap=IncomeGapOut(**gap.__dict__),
        retirement=[RetirementBandOut(**b.__dict__) for b in bands],
        monthly_income_level=assumptions["monthly_income_level"],  # type: ignore[arg-type]
        monthly_living_target=round(est.profile.expected_monthly_living, 2),
        income_cv=round(est.profile.income_cv, 4),
        assumptions=assumptions,
    )
