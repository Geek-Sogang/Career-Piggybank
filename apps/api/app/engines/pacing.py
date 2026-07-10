"""금액 페이싱 — 결정론 층 (엔진, 판단 아님).

3층 페이싱의 ①·② + 번역:
- ① 산수 — 목표별 기본 페이스 = 남은 금액 ÷ 남은 입금 횟수 (자유 계수 0 — 나눗셈일 뿐).
  기한이 있으면 입금 리듬(F03 간격 중앙값)으로 남은 입금 횟수를 세고, 없으면
  DEFAULT_PACING_DEPOSITS회에 나눠 담는 것을 기본으로 한다(정의 — 문서화된 측정 창).
- ② 버퍼 우선 보호 — 여윳돈 슬라이스에서 버퍼 부족분을 먼저 채운 뒤에만 목표로 간다.
  "가뭄을 버틸 돈이 목표 저축보다 먼저" — 순차 배분과 같은 원리, 순서가 곧 안전.
- 번역 — 에이전트(⑤b)의 스탠스(보류/기본/당김 — 번호만)를 원화로 옮긴다.
  합계 = 슬라이스 보존 불변식: 남는 것은 전부 버퍼로 (반올림 오차 흡수 포함).

LLM 없음 — 우선순위·속도 '판단'은 agents/amount_pacing(⑤b)의 몫이고,
이 파일은 그 판단이 주어졌을 때 정답이 있는 산수만 한다.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

DEFAULT_PACING_DEPOSITS = 6   # 기한 없는 목표의 기본 분할 횟수 (정의 — 측정 창)
MULTIPLIERS = {"보류": 0.0, "기본": 1.0, "당김": 1.5}  # 스탠스 메뉴 → 배속 (번역표)


@dataclass(frozen=True)
class GoalPace:
    goal_id: str
    name: str
    base: float        # ① 산수 페이스 (스탠스 적용 전)
    stance: str        # ⑤b 판단 (보류/기본/당김) — 폴백이면 "기본"
    amount: float      # 번역된 이번 배분액


@dataclass(frozen=True)
class PacingPlan:
    available: float
    buffer_first: float          # ② 버퍼 부족분 우선 충당액
    goals: tuple[GoalPace, ...]
    buffer_rest: float           # 남은 전부 (합계 보존의 흡수처)
    reasons: tuple[str, ...]

    def split(self) -> dict[str, float]:
        """저장·승인용 — buffer + 목표별 금액. 합계 == available 보장."""
        out: dict[str, float] = {"buffer": round(self.buffer_first + self.buffer_rest, 2)}
        for g in self.goals:
            out[g.goal_id] = g.amount
        return out


def deposits_until(target_date: str | None, today: str, gap_days: float | None) -> int:
    """기한까지 남은 입금 횟수 — 입금 리듬(간격 중앙값)으로 센다. 최소 1."""
    if target_date is None or gap_days is None or gap_days <= 0:
        return DEFAULT_PACING_DEPOSITS
    try:
        days_left = (date.fromisoformat(target_date) - date.fromisoformat(today)).days
    except ValueError:
        return DEFAULT_PACING_DEPOSITS
    if days_left <= 0:
        return 1
    return max(1, round(days_left / gap_days))


def base_pace(goal: dict, today: str, gap_days: float | None) -> float:
    """① 산수 — 남은 금액 ÷ 남은 입금 횟수. 이미 달성한 목표는 0."""
    remaining = max(0.0, float(goal["target_amount"]) - float(goal["balance"]))
    if remaining == 0:
        return 0.0
    n = deposits_until(goal.get("target_date"), today, gap_days)
    return round(remaining / n, 2)


def translate(
    available: float,
    goals: list[dict],
    priorities: list[str],
    stances: dict[str, str],
    buffer_shortfall: float,
    today: str,
    gap_days: float | None,
) -> PacingPlan:
    """스탠스 판단 → 원화 번역. 순서: ②버퍼 보호 → 우선순위대로 목표 → 나머지 버퍼.

    합계 보존 불변식: split() 합 == available (반올림 오차는 버퍼가 흡수).
    """
    if available < 0:
        raise ValueError("available must be >= 0")
    reasons: list[str] = []
    remaining = available

    # ② 버퍼 우선 보호 — 가뭄을 버틸 돈이 목표보다 먼저
    buffer_first = round(min(remaining, max(0.0, buffer_shortfall)), 2)
    remaining = round(remaining - buffer_first, 2)
    if buffer_first > 0:
        reasons.append(
            f"버퍼가 목표치보다 {buffer_shortfall:,.0f}원 부족해 {buffer_first:,.0f}원을 먼저 채워요"
            " — 가뭄을 버틸 돈이 목표 저축보다 먼저예요"
        )

    by_id = {g["id"]: g for g in goals}
    ordered = [by_id[gid] for gid in priorities if gid in by_id]

    paced: list[GoalPace] = []
    for g in ordered:
        stance = stances.get(g["id"], "기본")
        mult = MULTIPLIERS.get(stance, 1.0)
        base = base_pace(g, today, gap_days)
        goal_room = max(0.0, float(g["target_amount"]) - float(g["balance"]))
        amount = round(min(base * mult, goal_room, remaining), 2)
        remaining = round(remaining - amount, 2)
        paced.append(GoalPace(goal_id=g["id"], name=g["name"], base=base,
                              stance=stance, amount=amount))
        if amount > 0:
            reasons.append(f"'{g['name']}' {amount:,.0f}원 — 기본 페이스 {base:,.0f}원의 {stance}")

    if remaining > 0:
        reasons.append(f"남은 {remaining:,.0f}원은 여윳돈(버퍼)으로 — 합계는 항상 보존돼요")

    return PacingPlan(
        available=round(available, 2), buffer_first=buffer_first,
        goals=tuple(paced), buffer_rest=remaining, reasons=tuple(reasons),
    )
