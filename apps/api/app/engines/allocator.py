"""봉투 배분 제안 엔진 (waterfall allocator).

입금 1건을 세금 → 경비 → 즉시가용 → 여윳돈 순의 폭포수 룰로 나눈 '제안'을 만든다.
세금은 결정론 세율(tax_envelope), 경비·즉시가용은 예상치까지 갭 채우기,
남는 전부가 여윳돈 — 그래서 많이 들어온 달은 여윳돈 비중이 저절로 커진다.

핵심 원칙 (멘토링 7/1 · 기획서 §6-2):
- AI/통계는 파라미터(예상 월경비·생활비·소득 변동성)만 공급하고, 배분은 이 결정론 룰이 한다.
- 엔진의 출력은 '실행'이 아니라 '제안' — 피기 코치를 거쳐 사용자가 승인/조정해야 반영된다.
- 평소 패턴이면 자동 적용 가능(needs_confirmation=False), 평소와 다른 입금만 코치가 확인을 요청한다.
- 모든 가정과 근거를 출력에 노출한다(숨은 계산 금지).
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.engines import tax_envelope

WINDFALL_RATIO = 1.5      # 평균 입금 대비 이 배수 이상이면 '평소와 다른 입금' → 코치 확인
BUFFER_MONTHS_MIN = 1.0   # 여윳돈(버퍼) 목표 하한 — 생활비 1개월치
BUFFER_MONTHS_MAX = 6.0   # 상한 — 6개월치
BUFFER_CV_SLOPE = 4.0     # 소득 변동계수 1당 버퍼 개월 수 가산

# ── 컨텍스트 보정 상수 (§6-2④ "다음 수입까지 공백에 맞춰 동적 조정") ──
LIVING_MONTHS_MAX = 2.0            # 수주 공백이 길어도 생활비 확보는 2개월치까지
EARLY_DECLINE_EXTRA_MONTHS = 1.0   # 커리어 신호 악화 시 버퍼 목표 가산(개월)
BIAS_CAP_FRACTION = 0.2            # 조정 성향 선반영 상한 — 입금액의 20%
BIAS_MIN_SAMPLES = 2               # 조정 이력 최소 건수 — 1건은 노이즈로 본다


@dataclass(frozen=True)
class AllocationContext:
    """긱워커 컨텍스트 — 수주 주기·커리어 추세·조정 성향(행동)이 배분 파라미터를 보정한다.

    전부 결정론 산출물이다: 수주 주기 = forecast.next_income_window(입금 간격 분포),
    커리어 추세 = forecast.career_signals(원장 신호), 조정 성향 = allocations 이력 통계.
    신호는 통계가 만들고 보정은 이 룰이 한다 — 여기에도 AI는 없다.
    """

    expected_gap_days: float | None = None  # 다음 수입까지 예상 간격(중앙값, 일)
    early_decline: bool = False             # 커리어 신호 악화(수주 간격↑·발주처↓·단가↓)
    buffer_bias: float = 0.0                # 조정 성향: 사용자가 버퍼로 늘려온 중앙값(원, ≥0)
    # 학습 배분 정책(allocation_policy)이 고른 버퍼 목표 개월 — None이면 기존 공식(하위 호환).
    # 이 엔진은 정책을 모른다: 값과 근거 문장만 받는다 (판단은 밖, 여기는 산수).
    buffer_months_override: float | None = None
    buffer_months_reason: str = ""


@dataclass(frozen=True)
class SpendingProfile:
    """배분에 필요한 사용자 파라미터 — 추후 지출 이력 통계(spending_profile 서비스)가 공급."""

    annual_gross: float              # 연 매출 추정(3.3% 원천징수 포함 총액), 원
    expected_monthly_expense: float  # 예상 월 경비(분류된 지출 이력 기반), 원
    expected_monthly_living: float   # 예상 월 생활비(즉시가용 목표), 원
    income_cv: float = 0.3           # 소득 변동계수(표준편차/평균) — 클수록 버퍼 목표 ↑
    avg_deposit: float = 0.0         # 평균 입금 건당 금액, 원 (0 = 이력 없음 → 항상 코치 확인)


@dataclass(frozen=True)
class EnvelopeBalances:
    """이번 달 각 봉투에 이미 쌓인 금액 — 갭 채우기의 기준점."""

    expense: float = 0.0
    spendable: float = 0.0
    buffer: float = 0.0


@dataclass(frozen=True)
class AllocationProposal:
    deposit: float
    tax: float                 # 세금봉투
    expense: float             # 경비봉투
    spendable: float           # 즉시가용(생활비)
    buffer: float              # 여윳돈(버퍼 + 투자 재원)
    buffer_target: float       # 여윳돈 목표 잔액(변동성 기반 n개월치 생활비)
    invest_available: float    # 배분 후 버퍼 목표 초과분 = 투자 제안 가능액
    windfall_ratio: float      # 이번 입금 / 평균 입금 (이력 없으면 0)
    needs_confirmation: bool   # True면 자동 적용하지 않고 피기 코치가 확인을 요청
    reasons: list[str] = field(default_factory=list)
    assumptions: dict[str, float] = field(default_factory=dict)


def buffer_target_months(income_cv: float) -> float:
    """소득이 들쭉날쭉할수록(변동계수 ↑) 버퍼 목표 개월 수를 늘린다."""
    months = BUFFER_MONTHS_MIN + BUFFER_CV_SLOPE * max(0.0, income_cv)
    return min(BUFFER_MONTHS_MAX, max(BUFFER_MONTHS_MIN, months))


def _won(v: float) -> str:
    return f"{v:,.0f}원"


def propose(
    deposit: float,
    profile: SpendingProfile,
    balances: EnvelopeBalances | None = None,
    context: AllocationContext | None = None,
) -> AllocationProposal:
    """입금 1건의 봉투 배분 제안을 생성한다 (순수 함수, 상태 변경 없음).

    context가 있으면 수주 주기(생활비 확보량)·커리어 추세(버퍼 두께)·조정 성향(선반영)이
    파라미터를 보정한다 — 없으면 기존 동작 그대로(하위 호환).
    """
    if deposit <= 0:
        raise ValueError("deposit must be positive")
    bal = balances or EnvelopeBalances()
    ctx = context or AllocationContext()
    reasons: list[str] = []

    # 1) 세금봉투 — 결정론 세율을 무조건 먼저 (법적 의무, AI 개입 금지 구간)
    annual = tax_envelope.estimate_annual_tax(profile.annual_gross)
    rate = max(0.0, annual.effective_tax_rate)
    tax = round(deposit * rate, 2)
    remaining = deposit - tax
    reasons.append(
        f"세금봉투 {_won(tax)}: 연 매출 {_won(profile.annual_gross)} 기준 "
        f"실효 추가세율 {rate:.1%}를 먼저 떼어 5월 종소세에 대비해요"
    )

    # 2) 경비봉투 — 예상 월 경비까지 갭 채우기
    expense_gap = max(0.0, profile.expected_monthly_expense - bal.expense)
    expense = round(min(remaining, expense_gap), 2)
    remaining -= expense
    if expense > 0:
        reasons.append(
            f"경비봉투 {_won(expense)}: 이번 달 예상 경비 {_won(profile.expected_monthly_expense)} 중 "
            f"{_won(bal.expense)}이 이미 있어 부족분만 채워요"
        )
    else:
        reasons.append("경비봉투 0원: 이번 달 예상 경비가 이미 채워져 있어요")

    # 3) 즉시가용 — 예상 월 생활비까지 갭 채우기.
    #    수주 주기 보정(§6-2④): 다음 수입까지 예상 공백이 한 달을 넘으면 그만큼 더 확보
    living_months = 1.0
    if ctx.expected_gap_days is not None:
        living_months = min(LIVING_MONTHS_MAX, max(1.0, ctx.expected_gap_days / 30.0))
    living_target = round(profile.expected_monthly_living * living_months, 2)
    living_gap = max(0.0, living_target - bal.spendable)
    spendable = round(min(remaining, living_gap), 2)
    remaining -= spendable
    if living_months > 1.05 and spendable > 0:
        reasons.append(
            f"즉시가용 {_won(spendable)}: 다음 수입까지 약 {ctx.expected_gap_days:.0f}일 예상 — "
            f"생활비를 {living_months:.1f}개월치({_won(living_target)})까지 확보해요"
        )
    elif spendable > 0:
        reasons.append(
            f"즉시가용 {_won(spendable)}: 이번 달 생활비 {_won(living_target)}까지 채워요"
        )
    else:
        reasons.append("즉시가용 0원: 이번 달 생활비가 이미 확보돼 있어요")

    # 4) 여윳돈 — 남는 전부. 반올림 오차도 여기서 흡수해 합계 == 입금액 보장.
    #    커리어 추세 보정: 신호 악화(수주 간격↑·발주처↓·단가↓)면 버퍼 목표를 더 두껍게
    buffer = round(deposit - tax - expense - spendable, 2)
    if ctx.buffer_months_override is not None:
        months = min(BUFFER_MONTHS_MAX, max(BUFFER_MONTHS_MIN, ctx.buffer_months_override))
        if ctx.buffer_months_reason:
            reasons.append(ctx.buffer_months_reason)
    else:
        months = buffer_target_months(profile.income_cv)
    if ctx.early_decline:
        months = min(BUFFER_MONTHS_MAX, months + EARLY_DECLINE_EXTRA_MONTHS)
        reasons.append(
            f"최근 수주 흐름이 감속 추세라 여윳돈 목표를 {EARLY_DECLINE_EXTRA_MONTHS:.0f}개월치 더 두껍게 잡았어요"
        )
    buffer_target = round(profile.expected_monthly_living * months, 2)

    # 조정 성향 선반영(행동 신호): 늘 버퍼를 늘려온 사용자의 습관을 제안에 미리 반영.
    # 세금·경비는 불가침 — 옮기는 건 즉시가용→여윳돈뿐, 상한은 입금액의 20%
    bias_applied = 0.0
    if ctx.buffer_bias > 0 and spendable > 0:
        bias_applied = round(min(ctx.buffer_bias, spendable, deposit * BIAS_CAP_FRACTION), 2)
        if bias_applied > 0:
            spendable = round(spendable - bias_applied, 2)
            buffer = round(buffer + bias_applied, 2)
            reasons.append(
                f"최근 배분에서 여윳돈을 늘려 오셔서 {_won(bias_applied)}을 미리 여윳돈으로 옮겨 제안해요"
            )

    after = bal.buffer + buffer
    invest_available = round(max(0.0, after - buffer_target), 2)
    if invest_available > 0:
        reasons.append(
            f"여윳돈 {_won(buffer)}: 버퍼 목표({months:.1f}개월치 생활비 {_won(buffer_target)})를 넘긴 "
            f"{_won(invest_available)}은 보수적으로 굴릴 수 있어요"
        )
    else:
        reasons.append(
            f"여윳돈 {_won(buffer)}: 소득 변동에 대비해 버퍼 목표 {_won(buffer_target)}"
            f"({months:.1f}개월치 생활비)까지 {_won(max(0.0, buffer_target - after))} 더 모아요"
        )

    # 평소와 다른 입금인가? — 이력이 없거나(콜드스타트) 평균의 1.5배 이상이면 코치 확인
    windfall = round(deposit / profile.avg_deposit, 2) if profile.avg_deposit > 0 else 0.0
    needs_confirmation = profile.avg_deposit <= 0 or windfall >= WINDFALL_RATIO
    if profile.avg_deposit <= 0:
        reasons.append("입금 이력이 아직 없어 첫 배분은 코치와 함께 확인해요")
    elif needs_confirmation:
        reasons.append(
            f"이번 입금은 평소({_won(profile.avg_deposit)})의 {windfall:.1f}배 — 코치가 확인을 요청해요"
        )

    return AllocationProposal(
        deposit=round(deposit, 2),
        tax=tax,
        expense=expense,
        spendable=spendable,
        buffer=buffer,
        buffer_target=buffer_target,
        invest_available=invest_available,
        windfall_ratio=windfall,
        needs_confirmation=needs_confirmation,
        reasons=reasons,
        assumptions={
            "effective_tax_rate": rate,
            "expected_monthly_expense": profile.expected_monthly_expense,
            "expected_monthly_living": profile.expected_monthly_living,
            "income_cv": profile.income_cv,
            "buffer_target_months": months,
            "windfall_threshold": WINDFALL_RATIO,
            "living_months": living_months,
            "expected_gap_days": ctx.expected_gap_days if ctx.expected_gap_days is not None else 0.0,
            "early_decline": 1.0 if ctx.early_decline else 0.0,
            "buffer_bias_applied": bias_applied,
            "buffer_months_from_policy": 1.0 if ctx.buffer_months_override is not None else 0.0,
        },
    )


def validate_adjustment(
    deposit: float, tax: float, expense: float, spendable: float, buffer: float,
    tolerance: float = 0.01,
) -> None:
    """사용자 조정값 검증 — 음수 금지, 합계는 입금액과 일치해야 한다."""
    parts = {"tax": tax, "expense": expense, "spendable": spendable, "buffer": buffer}
    for name, value in parts.items():
        if value < 0:
            raise ValueError(f"{name} must be >= 0")
    total = sum(parts.values())
    if abs(total - deposit) > tolerance:
        raise ValueError(f"sum of envelopes ({total}) must equal deposit ({deposit})")
