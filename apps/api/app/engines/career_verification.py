"""커리어 검증 점수·단계와 소득리듬 여정의 결정론 단일 소유자.

신뢰 층과 습관 층을 섞지 않는다.
- 신뢰 층: 검증 이력과 외부 연결만 점수·단계를 움직인다.
- 습관 층: 고유한 입금 사건의 배분 승인만 소득리듬 횟수를 움직인다.

점수는 이식 가능한 커리어 평판 신호이며 대출 한도 산식이 아니다. 확정 단계가 여는 것도
대출 자격이나 한도가 아니라, 연결된 검증자료를 상품 심사 화면으로 가져가는 통로뿐이다.
"""
from __future__ import annotations

from dataclasses import dataclass

SOURCE_SCORES: dict[str, int] = {
    "github": 30,
    "mydata": 50,
    "hometax": 40,
    "kosa": 35,
    "behance": 30,
    "portfolio": 20,
}
VERIFIED_COUNT = 12
STREAK_MONTHS = 8
SPAN_MONTHS = 30
HISTORY_SCORE = VERIFIED_COUNT * 10 + STREAK_MONTHS * 10 + SPAN_MONTHS * 4

JOURNEY_STEPS = 5
JOURNEY_REWARDS = (
    "성장 시작",
    "하나머니 혜택 확인",
    "우대금리 쿠폰 확인",
    "파킹통장 우대 확인",
    "환율·수수료 혜택 확인",
)


@dataclass(frozen=True)
class IncomeRhythmJourney:
    """달력 대신 검증 가능한 사건으로 전진하는 표시용 여정.

    `step`은 보상·캐릭터 성장 UI에만 쓰인다. 커리어 점수, 상품 적합성, 한도에는
    어떤 영향도 주지 않는다.
    """

    step: int
    total_steps: int
    trust_events: int
    confirmed_income_events: int
    completed_kinds: tuple[str, ...]
    current_reward: str
    next_reward: str | None
    next_requirement: str | None

    def as_dict(self) -> dict:
        return {
            "step": self.step,
            "total_steps": self.total_steps,
            "trust_events": self.trust_events,
            "confirmed_income_events": self.confirmed_income_events,
            "completed_kinds": list(self.completed_kinds),
            "current_reward": self.current_reward,
            "next_reward": self.next_reward,
            "next_requirement": self.next_requirement,
            "calendar_streak_used": False,
        }


@dataclass(frozen=True)
class CareerVerification:
    job: str
    sources: tuple[str, ...]
    score: int
    stage: str
    review_ready: bool
    stage_basis: str
    journey: IncomeRhythmJourney

    def as_dict(self) -> dict:
        return {
            "job": self.job,
            "sources": list(self.sources),
            "score": self.score,
            "stage": self.stage,
            "score_breakdown": {
                "verified_history": HISTORY_SCORE,
                "connected_sources": sum(SOURCE_SCORES[s] for s in self.sources),
            },
            "review_connection": {
                "available": self.review_ready,
                "label": "검증자료로 심사 연결" if self.review_ready else "검증자료 준비 중",
                "basis": self.stage_basis,
            },
            "verified": {
                "count": VERIFIED_COUNT,
                "streak_months": STREAK_MONTHS,
                "span_months": SPAN_MONTHS,
            },
            "journey": self.journey.as_dict(),
        }


def _eligible_income_event_ids(events: list[dict] | tuple[dict, ...]) -> tuple[str, ...]:
    """소득리듬으로 인정할 고유 입금 사건만 사건 순서대로 돌려준다.

    승인·조정된 실제 입금 배분이면서 API가 `rhythm_eligible`로 기록한 경우만 인정한다.
    거절, 목표 페이싱, 앱 열기, txn_id 없는 수동 제안은 제외한다. 같은 입금에 대한 재시도는
    `income_event_id` 중복 제거로 한 번만 센다.
    """
    seen: set[str] = set()
    result: list[str] = []
    for event in events:
        if event.get("type") != "allocation_decided":
            continue
        payload = event.get("payload") or {}
        income_event_id = payload.get("income_event_id")
        if payload.get("rhythm_eligible") is not True or not isinstance(income_event_id, str):
            continue
        if not income_event_id or income_event_id in seen:
            continue
        seen.add(income_event_id)
        result.append(income_event_id)
    return tuple(result)


def _next_requirement(active: tuple[str, ...], stage: str, rhythm_count: int, step: int) -> str | None:
    if step >= JOURNEY_STEPS:
        return None
    if not active:
        return "커리어 소스 한 곳을 연결해 첫 검증 발판을 열어요"
    if stage != "확정":
        return "홈택스 또는 KOSA를 연결해 신고소득·경력을 확인해요"
    if rhythm_count == 0:
        return "다음 입금 배분을 승인하면 소득리듬 발판이 열려요"
    return "새 검증 소스를 연결하거나 다음 입금 배분을 승인해요"


def _journey(active: tuple[str, ...], stage: str, events: list[dict] | tuple[dict, ...]) -> IncomeRhythmJourney:
    income_event_ids = _eligible_income_event_ids(events)
    # 첫 칸은 기존 검증 이력으로 시작한다. 이후 칸은 신뢰 사건과 고유 소득 사건이 채우되,
    # 종류를 그대로 노출해 점수와 습관이 같은 신호처럼 보이지 않게 한다.
    completed = tuple(
        (["trust"] * len(active) + ["income_rhythm"] * len(income_event_ids))[: JOURNEY_STEPS - 1]
    )
    step = 1 + len(completed)
    return IncomeRhythmJourney(
        step=step,
        total_steps=JOURNEY_STEPS,
        trust_events=len(active),
        confirmed_income_events=len(income_event_ids),
        completed_kinds=completed,
        current_reward=JOURNEY_REWARDS[step - 1],
        next_reward=JOURNEY_REWARDS[step] if step < JOURNEY_STEPS else None,
        next_requirement=_next_requirement(active, stage, len(income_event_ids), step),
    )


def compute(
    sources: list[str] | tuple[str, ...],
    job: str = "developer",
    events: list[dict] | tuple[dict, ...] = (),
) -> CareerVerification:
    """활성 외부 소스와 사건 로그 → 점수·단계·심사 연결·소득리듬 여정."""
    active = tuple(sorted({s for s in sources if s in SOURCE_SCORES}))
    score = HISTORY_SCORE + sum(SOURCE_SCORES[s] for s in active)
    if "hometax" in active or "kosa" in active:
        stage = "확정"
        basis = "신고소득 또는 협회 경력을 확인해 검증자료를 심사 화면에 연결할 수 있어요"
    elif len(active) >= 2:
        stage = "준검증"
        basis = "서로 다른 두 소스를 연결했어요. 신고소득 또는 협회 경력 확인이 더 필요해요"
    else:
        stage = "잠정"
        basis = "연결된 자료가 아직 적어 검증 이력만 보여드려요"
    return CareerVerification(
        job=job,
        sources=active,
        score=score,
        stage=stage,
        review_ready=stage == "확정",
        stage_basis=basis,
        journey=_journey(active, stage, events),
    )


def latest(events: list[dict]) -> CareerVerification:
    """최신 모바일 동기화 이벤트와 전체 사건 로그를 함께 읽는다."""
    updates = [e for e in events if e["type"] == "career_verification_updated"]
    if not updates:
        return compute([], "developer", events)
    payload = updates[-1].get("payload", {})
    return compute(payload.get("sources") or [], payload.get("job") or "developer", events)
