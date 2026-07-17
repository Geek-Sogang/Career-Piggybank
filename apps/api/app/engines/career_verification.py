"""커리어 검증 점수와 금융상품 한도 — 결정론 단일 소유자.

커리어 연결은 소비 성향이나 배분 금액을 바꾸지 않는다. 검증된 이력과 연결 소스는
금융 신뢰도(점수·검증 단계·상품 한도)에만 반영해, 생활금융 개인화와 신용평가를 섞지 않는다.
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


@dataclass(frozen=True)
class CareerVerification:
    job: str
    sources: tuple[str, ...]
    score: int
    stage: str
    limit: int

    def as_dict(self) -> dict:
        return {
            "job": self.job,
            "sources": list(self.sources),
            "score": self.score,
            "stage": self.stage,
            "limit": self.limit,
            "verified": {
                "count": VERIFIED_COUNT,
                "streak_months": STREAK_MONTHS,
                "span_months": SPAN_MONTHS,
            },
        }


def compute(sources: list[str] | tuple[str, ...], job: str = "developer") -> CareerVerification:
    """활성 연결 소스 → 점수·단계·검증 한도. 알 수 없는 소스는 점수에 넣지 않는다."""
    active = tuple(sorted({s for s in sources if s in SOURCE_SCORES}))
    score = HISTORY_SCORE + sum(SOURCE_SCORES[s] for s in active)
    if "hometax" in active or "kosa" in active:
        stage, multiplier = "확정", 1.0
    elif len(active) >= 2:
        stage, multiplier = "준검증", 0.7
    else:
        stage, multiplier = "잠정", 0.4
    limit = round(score * 5_000 * multiplier / 100_000) * 100_000
    return CareerVerification(job=job, sources=active, score=score, stage=stage, limit=limit)


def latest(events: list[dict]) -> CareerVerification:
    """최신 모바일 동기화 이벤트를 읽고, 없으면 연결 전 상태로 시작한다."""
    updates = [e for e in events if e["type"] == "career_verification_updated"]
    if not updates:
        return compute([], "developer")
    payload = updates[-1].get("payload", {})
    return compute(payload.get("sources") or [], payload.get("job") or "developer")
