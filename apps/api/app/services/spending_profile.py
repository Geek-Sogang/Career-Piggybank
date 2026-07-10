"""지출·소득 프로필 예측기 (spending profile estimator).

분류기(classifier)가 라벨을 붙인 거래 이력에서 allocator의 입력 파라미터
(연 매출·예상 월경비·예상 생활비·소득 변동성·평균 입금)를 산출한다.

AI 아님 — 전부 결정론 통계다 (설명가능성 원칙):
- 평균 대신 **중앙값**: 긱워커 소득·지출은 이상치가 많아 평균이 잘 속는다.
- 변동성 = 월 소득의 변동계수(CV, 표준편차/평균) → allocator의 버퍼 목표 개월 수로.
- **콜드스타트**: 이력이 3개월 미만이면 직군 프리셋과 가중 혼합해 시작하고,
  데이터가 쌓일수록 개인 통계로 자연 전환한다 (기획서 §12 부트스트랩).

MVP 가정: 달력 월 단위 집계, 진행 중인 달의 불완전성은 무시한다.
"""
from __future__ import annotations

import statistics
from collections import defaultdict
from dataclasses import dataclass
from typing import Literal

from app.services.allocator import SpendingProfile

TxnKind = Literal["income", "expense", "living"]  # 일감매출 / 경비 / 개인(생활)

COLD_START_MONTHS = 3  # 이 개월 수부터 100% 개인 데이터 사용


@dataclass(frozen=True)
class Txn:
    """분류기가 라벨을 붙인 거래 1건."""

    date: str          # ISO "YYYY-MM-DD" (월 집계에는 앞 7자리만 사용)
    amount: float      # 원, 항상 양수 (방향은 kind가 결정)
    kind: TxnKind


# 직군 프리셋 — 콜드스타트용 통계 가정치 (데모 상수, 실서비스는 코호트 통계로 교체)
PERSONA_PRESETS: dict[str, SpendingProfile] = {
    "developer": SpendingProfile(
        annual_gross=36_000_000, expected_monthly_expense=400_000,
        expected_monthly_living=1_200_000, income_cv=0.35, avg_deposit=900_000,
    ),
    "designer": SpendingProfile(
        annual_gross=30_000_000, expected_monthly_expense=500_000,
        expected_monthly_living=1_100_000, income_cv=0.45, avg_deposit=700_000,
    ),
    "creator": SpendingProfile(
        annual_gross=24_000_000, expected_monthly_expense=350_000,
        expected_monthly_living=1_000_000, income_cv=0.60, avg_deposit=400_000,
    ),
}
DEFAULT_PERSONA = "developer"


@dataclass(frozen=True)
class ProfileEstimate:
    profile: SpendingProfile
    months_observed: int    # 거래가 있는 달력 월 수
    blend_weight: float     # 개인 데이터 가중치 (0=프리셋 100%, 1=개인 100%)
    persona: str
    notes: list[str]


def _monthly_sums(txns: list[Txn], kind: TxnKind) -> list[float]:
    """해당 종류 거래의 월별 합계 (거래가 있는 달만)."""
    by_month: dict[str, float] = defaultdict(float)
    for t in txns:
        if t.kind == kind:
            by_month[t.date[:7]] += t.amount
    return [by_month[m] for m in sorted(by_month)]


def _blend(observed: float, preset: float, w: float) -> float:
    return round(w * observed + (1 - w) * preset, 2)


def estimate(txns: list[Txn], persona: str = DEFAULT_PERSONA) -> ProfileEstimate:
    """라벨된 거래 이력 → allocator 입력 프로필 (순수 함수)."""
    preset = PERSONA_PRESETS.get(persona) or PERSONA_PRESETS[DEFAULT_PERSONA]
    persona_used = persona if persona in PERSONA_PRESETS else DEFAULT_PERSONA
    notes: list[str] = []

    months = {t.date[:7] for t in txns}
    months_observed = len(months)
    w = min(1.0, months_observed / COLD_START_MONTHS)
    if w < 1.0:
        notes.append(
            f"이력 {months_observed}개월 — '{persona_used}' 직군 프리셋과 "
            f"{1 - w:.0%} 혼합 (3개월부터 100% 개인 데이터)"
        )

    incomes = _monthly_sums(txns, "income")
    expenses = _monthly_sums(txns, "expense")
    livings = _monthly_sums(txns, "living")
    deposits = [t.amount for t in txns if t.kind == "income"]

    # 세금용 연매출은 '합계' 개념 — 중앙값이 아니라 관측 소득 합의 연환산이다.
    # 중앙값은 큰 대금을 이상치로 깎지만, 세금에선 바로 그 대금이 내야 할 과세 매출이라
    # 중앙값×12는 항상 실제 연합계보다 작게 잡혀 세금봉투가 모자라게 쌓인다.
    # (6개월 [100,100,100,100,100,700]만 → median×12 = 1,200만 vs 연환산 2,400만.)
    # 큰 대금 왜곡은 '평소 1.5배↑ → 코치 확인' 플래그가 배분 단계에서 잡는다.
    annual_income = sum(incomes) / months_observed * 12 if incomes else preset.annual_gross

    # 생활비·경비·평균입금은 중앙값 유지 (이상치 둔감 — 이쪽은 '평소 얼마'가 맞다)
    monthly_expense = (
        statistics.median(expenses) if expenses else preset.expected_monthly_expense
    )
    monthly_living = statistics.median(livings) if livings else preset.expected_monthly_living
    avg_deposit = statistics.median(deposits) if deposits else preset.avg_deposit

    # 소득 변동계수 — 최소 2개월 있어야 산출, 아니면 프리셋
    if len(incomes) >= 2 and statistics.mean(incomes) > 0:
        cv = statistics.pstdev(incomes) / statistics.mean(incomes)
    else:
        cv = preset.income_cv
        notes.append("소득 관측이 2개월 미만 — 변동성은 직군 프리셋 사용")

    profile = SpendingProfile(
        annual_gross=_blend(annual_income, preset.annual_gross, w),
        expected_monthly_expense=_blend(monthly_expense, preset.expected_monthly_expense, w),
        expected_monthly_living=_blend(monthly_living, preset.expected_monthly_living, w),
        income_cv=round(w * cv + (1 - w) * preset.income_cv, 4),  # 비율값 — 원화용 _blend(2자리) 금지
        avg_deposit=_blend(avg_deposit, preset.avg_deposit, w),
    )
    return ProfileEstimate(
        profile=profile,
        months_observed=months_observed,
        blend_weight=round(w, 4),
        persona=persona_used,
        notes=notes,
    )
