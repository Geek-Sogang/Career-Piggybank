"""세금봉투 결정론 엔진 (Tax-Envelope deterministic engine).

데모 1막의 핵심: 긱워커(3.3% 원천징수 사업소득자)의 입금 1건을
세금봉투 / 경비봉투 / 여윳돈 / 즉시가용으로 결정론적으로 분류하고,
5월 종합소득세 추가납부 예상액을 미리 적립해 '종소세 쇼크'를 제거한다.

모든 가정(경비율·세율 구간·버퍼 비율)은 출력에 그대로 노출한다 —
"숨은 계산"이 아니라 화면에서 검증 가능한 산수임을 보이기 위함(기획서 §9-3).
"""
from __future__ import annotations

from dataclasses import dataclass, field

# 2024 종합소득세 누진세율 (과세표준 상한, 세율, 누진공제) — 원 단위
TAX_BRACKETS: list[tuple[float, float, float]] = [
    (14_000_000, 0.06, 0),
    (50_000_000, 0.15, 1_260_000),
    (88_000_000, 0.24, 5_760_000),
    (150_000_000, 0.35, 15_440_000),
    (300_000_000, 0.38, 19_940_000),
    (500_000_000, 0.40, 25_940_000),
    (1_000_000_000, 0.42, 35_940_000),
    (float("inf"), 0.45, 65_940_000),
]

WITHHOLDING_RATE = 0.033  # 3.3% 원천징수 (소득세 3% + 지방소득세 0.3%)
LOCAL_TAX_RATE = 0.10     # 지방소득세 = 소득세의 10%
DEFAULT_EXPENSE_RATE = 0.30  # 단순경비율 가정(직군 평균) — 실제는 업종코드별
DEFAULT_BUFFER_RATIO = 0.30  # 세금·경비 제외 잔액 중 여윳돈으로 적립할 비율


def income_tax(taxable: float) -> float:
    """과세표준(사업소득금액)에 누진세율을 적용한 산출세액(지방세 제외)."""
    if taxable <= 0:
        return 0.0
    for ceiling, rate, quick_deduction in TAX_BRACKETS:
        if taxable <= ceiling:
            return max(0.0, taxable * rate - quick_deduction)
    return 0.0  # unreachable


@dataclass(frozen=True)
class AnnualTax:
    annual_gross: float
    expense_rate: float
    taxable: float
    income_tax: float
    local_tax: float
    total_tax: float
    already_withheld: float
    additional_due: float          # 5월에 추가로 내야 할 금액 (음수면 환급 예상)
    effective_tax_rate: float      # additional_due / annual_gross


def estimate_annual_tax(
    annual_gross: float, expense_rate: float = DEFAULT_EXPENSE_RATE
) -> AnnualTax:
    """연 매출(3.3% 원천징수분 포함 총액)로 종소세 추가납부 예상액을 추정.

    MVP 가정: 소득공제·세액공제는 0으로 두고 사업소득금액 = 매출×(1−경비율)만 본다.
    """
    taxable = annual_gross * (1 - expense_rate)
    inc = income_tax(taxable)
    local = inc * LOCAL_TAX_RATE
    total = inc + local
    withheld = annual_gross * WITHHOLDING_RATE
    additional = total - withheld
    eff = additional / annual_gross if annual_gross else 0.0
    return AnnualTax(
        annual_gross=round(annual_gross, 2),
        expense_rate=expense_rate,
        taxable=round(taxable, 2),
        income_tax=round(inc, 2),
        local_tax=round(local, 2),
        total_tax=round(total, 2),
        already_withheld=round(withheld, 2),
        additional_due=round(additional, 2),
        effective_tax_rate=round(eff, 6),
    )


@dataclass(frozen=True)
class Envelopes:
    deposit: float
    tax: float          # 세금봉투
    expense: float      # 경비봉투
    buffer: float       # 여윳돈
    spendable: float    # 즉시가용
    assumptions: dict[str, float] = field(default_factory=dict)


def split_deposit(
    deposit: float,
    annual_gross: float,
    expense_rate: float = DEFAULT_EXPENSE_RATE,
    buffer_ratio: float = DEFAULT_BUFFER_RATIO,
) -> Envelopes:
    """입금 1건을 4개 봉투로 결정론적 분류.

    세금봉투 = 입금 × (연 추가납부세액 / 연매출)  → 5월 쇼크 선적립
    경비봉투 = 입금 × 경비율                       → 운영비 대비
    여윳돈   = 잔액 × buffer_ratio                  → 변동성 버퍼/투자 재원
    즉시가용 = 나머지
    """
    annual = estimate_annual_tax(annual_gross, expense_rate)
    tax = deposit * max(0.0, annual.effective_tax_rate)
    expense = deposit * expense_rate
    remaining = max(0.0, deposit - tax - expense)
    buffer = remaining * buffer_ratio
    spendable = remaining - buffer
    return Envelopes(
        deposit=round(deposit, 2),
        tax=round(tax, 2),
        expense=round(expense, 2),
        buffer=round(buffer, 2),
        spendable=round(spendable, 2),
        assumptions={
            "expense_rate": expense_rate,
            "buffer_ratio": buffer_ratio,
            "withholding_rate": WITHHOLDING_RATE,
            "effective_tax_rate": annual.effective_tax_rate,
        },
    )
