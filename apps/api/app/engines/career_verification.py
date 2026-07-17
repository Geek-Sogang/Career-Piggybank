"""커리어 검증 점수와 `커리어 저금통` 성장의 결정론 단일 소유자.

서로 다른 세 층을 섞지 않는다.
- 검증 신뢰: `career_job_verified` 사건과 외부 연결만 점수·단계를 움직인다.
- 성장 경험치: 검증된 일감과 1회성 미션이 커리어 저금통의 XP·레벨만 움직인다.
- 금융 판단: 점수·XP·레벨 모두 상품 자격·금리·한도·배분 금액을 결정하지 않는다.

자동 입금 분류는 커리어 검증이 아니다. 다중 자료 확인이 끝나 명시적인 검증 사건이 기록된
일감만 검증 건수와 XP에 반영한다.
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

XP_PER_VERIFIED_JOB = 30


@dataclass(frozen=True)
class MissionDefinition:
    id: str
    title: str
    xp: int
    source: str | None = None
    event_type: str | None = None


MISSIONS = (
    MissionDefinition("connect_github", "GitHub 작업 활동 연결", 20, source="github"),
    MissionDefinition("connect_hometax", "홈택스 신고소득 연결", 30, source="hometax"),
    MissionDefinition("connect_kosa", "KOSA 경력자료 연결", 25, source="kosa"),
    MissionDefinition("connect_mydata", "마이데이터 소득 흐름 연결", 20, source="mydata"),
    MissionDefinition("connect_behance", "Behance 포트폴리오 연결", 15, source="behance"),
    MissionDefinition("connect_portfolio", "포트폴리오 작업물 등록", 15, source="portfolio"),
    MissionDefinition("create_goal", "첫 목표 봉투 만들기", 20, event_type="goal_created"),
    MissionDefinition("tag_income", "애매한 입금 직접 확인", 15, event_type="txn_tagged"),
    MissionDefinition("approve_allocation", "첫 입금 배분 승인", 25, event_type="allocation_decided"),
)


@dataclass(frozen=True)
class LevelDefinition:
    level: int
    title: str
    threshold: int
    reward: str
    node_type: str


LEVELS = (
    LevelDefinition(1, "첫 동전", 0, "기본 저금통", "character"),
    LevelDefinition(2, "일감 모으기", 80, "하나머니 혜택 확인", "reward"),
    LevelDefinition(3, "정산 새싹", 180, "새싹 스킨", "character"),
    LevelDefinition(4, "리듬 수집가", 320, "우대금리 쿠폰 확인", "reward"),
    LevelDefinition(5, "든든 저금통", 500, "저금통 1차 성장", "character"),
    LevelDefinition(6, "커리어 성장", 720, "파킹통장 우대 확인", "reward"),
    LevelDefinition(7, "신뢰 수집가", 980, "직군 소품", "character"),
    LevelDefinition(8, "자산 설계자", 1_280, "환율·수수료 혜택 확인", "reward"),
    LevelDefinition(9, "커리어 자산가", 1_620, "반짝 스킨", "character"),
    LevelDefinition(10, "프로 긱워커", 2_000, "커리어 마스터 배지", "character"),
)


@dataclass(frozen=True)
class VerifiedHistory:
    count: int
    streak_months: int
    span_months: int
    recent: tuple[dict, ...]

    @property
    def score(self) -> int:
        return self.count * 10 + self.streak_months * 10 + self.span_months * 4

    def as_dict(self) -> dict:
        return {
            "count": self.count,
            "streak_months": self.streak_months,
            "span_months": self.span_months,
            "recent": list(self.recent),
        }


@dataclass(frozen=True)
class CareerPiggybank:
    xp: int
    work_xp: int
    mission_xp: int
    level: int
    level_title: str
    max_level: int
    current_threshold: int
    next_threshold: int | None
    xp_to_next: int
    progress: float
    completed_missions: int
    missions: tuple[dict, ...]

    def as_dict(self) -> dict:
        return {
            "xp": self.xp,
            "work_xp": self.work_xp,
            "mission_xp": self.mission_xp,
            "level": self.level,
            "level_title": self.level_title,
            "max_level": self.max_level,
            "current_threshold": self.current_threshold,
            "next_threshold": self.next_threshold,
            "xp_to_next": self.xp_to_next,
            "progress": self.progress,
            "completed_missions": self.completed_missions,
            "missions": list(self.missions),
            "levels": [level.__dict__ for level in LEVELS],
            "reward_is_example": True,
        }


@dataclass(frozen=True)
class CareerVerification:
    job: str
    sources: tuple[str, ...]
    score: int
    stage: str
    review_ready: bool
    stage_basis: str
    verified: VerifiedHistory
    piggybank: CareerPiggybank

    def as_dict(self) -> dict:
        return {
            "job": self.job,
            "sources": list(self.sources),
            "score": self.score,
            "stage": self.stage,
            "score_breakdown": {
                "verified_history": self.verified.score,
                "connected_sources": sum(SOURCE_SCORES[s] for s in self.sources),
            },
            "review_connection": {
                "available": self.review_ready,
                "label": "검증자료로 심사 연결" if self.review_ready else "검증자료 준비 중",
                "basis": self.stage_basis,
            },
            "verified": self.verified.as_dict(),
            "piggybank": self.piggybank.as_dict(),
        }


def _month_index(date: str) -> int:
    year, month = date[:7].split("-")
    return int(year) * 12 + int(month)


def _history(events: list[dict] | tuple[dict, ...], txns: list[dict] | tuple[dict, ...]) -> VerifiedHistory:
    verified_ids = {
        event.get("ref_id") for event in events
        if event.get("type") == "career_job_verified" and event.get("ref_id")
    }
    jobs = [
        txn for txn in txns
        if txn.get("id") in verified_ids
        and txn.get("kind") == "income"
        and txn.get("direction") == "in"
        and not txn.get("needs_review")
    ]
    jobs.sort(key=lambda txn: (txn.get("date", ""), txn.get("seq", 0)), reverse=True)
    months = sorted({_month_index(txn["date"]) for txn in jobs})
    longest = 0
    run = 0
    previous: int | None = None
    for month in months:
        run = run + 1 if previous is not None and month == previous + 1 else 1
        longest = max(longest, run)
        previous = month
    span = months[-1] - months[0] + 1 if months else 0
    recent = tuple({
        "id": txn["id"],
        "date": txn["date"],
        "amount": txn["amount"],
        "counterparty": txn["counterparty"],
        "memo": txn.get("memo") or "검증된 일감",
    } for txn in jobs[:5])
    return VerifiedHistory(count=len(jobs), streak_months=longest, span_months=span, recent=recent)


def _eligible_income_event_ids(events: list[dict] | tuple[dict, ...]) -> tuple[str, ...]:
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


def _mission_done(mission: MissionDefinition, active: tuple[str, ...], events: list[dict] | tuple[dict, ...]) -> bool:
    if mission.source:
        return mission.source in active
    if mission.event_type == "goal_created":
        return any(event.get("type") == "goal_created" for event in events)
    if mission.event_type == "txn_tagged":
        return any(
            event.get("type") == "txn_tagged" and (event.get("payload") or {}).get("kind") == "income"
            for event in events
        )
    if mission.event_type == "allocation_decided":
        return bool(_eligible_income_event_ids(events))
    return False


def _piggybank(active: tuple[str, ...], history: VerifiedHistory,
               events: list[dict] | tuple[dict, ...]) -> CareerPiggybank:
    missions = tuple({
        "id": mission.id,
        "title": mission.title,
        "xp": mission.xp,
        "completed": _mission_done(mission, active, events),
    } for mission in MISSIONS)
    work_xp = history.count * XP_PER_VERIFIED_JOB
    mission_xp = sum(mission["xp"] for mission in missions if mission["completed"])
    xp = work_xp + mission_xp
    current = LEVELS[0]
    for level in LEVELS:
        if xp >= level.threshold:
            current = level
    next_level = LEVELS[current.level] if current.level < len(LEVELS) else None
    if next_level:
        span = next_level.threshold - current.threshold
        progress = (xp - current.threshold) / span if span else 1.0
        xp_to_next = max(0, next_level.threshold - xp)
    else:
        progress, xp_to_next = 1.0, 0
    return CareerPiggybank(
        xp=xp,
        work_xp=work_xp,
        mission_xp=mission_xp,
        level=current.level,
        level_title=current.title,
        max_level=len(LEVELS),
        current_threshold=current.threshold,
        next_threshold=next_level.threshold if next_level else None,
        xp_to_next=xp_to_next,
        progress=round(max(0.0, min(1.0, progress)), 4),
        completed_missions=sum(1 for mission in missions if mission["completed"]),
        missions=missions,
    )


def compute(
    sources: list[str] | tuple[str, ...],
    job: str = "developer",
    events: list[dict] | tuple[dict, ...] = (),
    txns: list[dict] | tuple[dict, ...] = (),
) -> CareerVerification:
    """검증 사건·외부 연결·원장 → 평판 점수·단계·커리어 저금통 성장."""
    active = tuple(sorted({source for source in sources if source in SOURCE_SCORES}))
    history = _history(events, txns)
    score = history.score + sum(SOURCE_SCORES[source] for source in active)
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
        verified=history,
        piggybank=_piggybank(active, history, events),
    )


def latest(events: list[dict], txns: list[dict] | tuple[dict, ...] = ()) -> CareerVerification:
    """최신 연결 상태를 읽되, 최초 시드는 실제 source_connected 사건을 복원한다."""
    updates = [event for event in events if event.get("type") == "career_verification_updated"]
    if updates:
        payload = updates[-1].get("payload", {})
        sources = payload.get("sources") or []
        job = payload.get("job") or "developer"
    else:
        sources = [
            (event.get("payload") or {}).get("source") for event in events
            if event.get("type") == "source_connected"
        ]
        job = "developer"
    return compute(sources, job, events, txns)
