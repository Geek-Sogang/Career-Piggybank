"""또래 봉투 추천 — "나와 비슷한 사람들은 어떤 봉투를 만들었나" (전부 결정론).

봉투 추천의 두 번째 소스(설계 §봉투 집합 개인화): ⑤a는 '내 팩트'에서 봉투를 떠올리고,
여기는 '남들의 개설 관찰'에서 떠올린다 — 카탈로그는 사용자 개설이 풀에 기여하며 자란다.

매칭 2단:
① 직군별 — 같은 직군(developer/designer/creator)의 풀을 먼저 본다. 풀이 얇으면
  전체 직군으로 넓히고 그 사실을 표기한다(숨은 확장 금지).
② 직군 안에서 페르소나 유사도 — 내 축(위험감내·시간선호·자기통제·계획성)과 만든 사람
  축의 거리로 가중한다. 유사도 = 1 − 평균|Δ| (양쪽 다 측정된 축만 — 폴백 축은 비교에서
  제외, 지어낸 중립끼리의 가짜 일치를 막는다).

LLM 없음 — 유사도·가중 비중·중앙값 전부 산수라서 services/에 산다. 추천은 판정일 뿐,
개설은 사용자가 탭해서 결정한다 (⑤a와 같은 가드레일).
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass

MIN_SAME_JOB_POOL = 5   # 같은 직군 풀이 이보다 얇으면 전체 직군으로 확장 (정의)
TOP_N = 3               # 추천 상한 (정의)
AXIS_KEYS = ("risk_tolerance", "time_preference", "self_control", "planning")


@dataclass(frozen=True)
class PeerIdea:
    """또래 추천 1건 — 이름 + 제안 금액 + 통계 근거 (전부 관찰된 사실)."""

    name: str
    suggested_amount: float    # 그 봉투를 만든 또래들의 목표액 중앙값
    share: float               # 유사도 가중 비중 (0~1) — "비슷한 사람들 사이에서의 인기"
    count: int                 # 그 봉투를 만든 또래 수
    pool: int                  # 비교한 또래 풀 크기
    scope: str                 # "job"(같은 직군) / "all"(풀이 얇아 전체로 확장)
    basis: str                 # 사용자에게 보일 근거 한 줄

    def as_dict(self) -> dict:
        return {
            "name": self.name, "suggested_amount": self.suggested_amount,
            "share": self.share, "count": self.count, "pool": self.pool,
            "scope": self.scope, "basis": self.basis,
        }


def similarity(my_axes: dict | None, peer_axes: dict | None) -> float | None:
    """페르소나 유사도 = 1 − 평균|축 차이|. 비교 가능한 축이 없으면 None.

    폴백 축(판독이 중립으로 기권한 축)은 비교에서 제외 — 중립 0.5끼리의 일치는
    '비슷한 성향'이 아니라 '둘 다 모름'이다.
    """
    if not my_axes or not peer_axes:
        return None
    diffs: list[float] = []
    for key in AXIS_KEYS:
        mine, theirs = my_axes.get(key), peer_axes.get(key)
        if not isinstance(mine, dict) or not isinstance(theirs, dict):
            continue
        if mine.get("fallback") or theirs.get("fallback"):
            continue
        mv, tv = mine.get("value"), theirs.get("value")
        if isinstance(mv, (int, float)) and isinstance(tv, (int, float)):
            diffs.append(abs(float(mv) - float(tv)))
    if not diffs:
        return None
    return round(1.0 - sum(diffs) / len(diffs), 4)


def recommend(
    job: str,
    my_axes: dict | None,
    existing_names: set[str],
    peers: list[dict],
) -> list[PeerIdea]:
    """직군 → 페르소나 유사도 순의 또래 봉투 추천 (순수 함수).

    페르소나가 없으면(판독 전) 유사도 가중 없이 직군 인기순 — 그 사실을 근거에 표기.
    """
    same_job = [p for p in peers if p["job"] == job]
    scope = "job" if len(same_job) >= MIN_SAME_JOB_POOL else "all"
    pool = same_job if scope == "job" else peers
    if not pool:
        return []

    # 또래별 가중치 — 유사도(측정 가능하면) 또는 1(인기순)
    weights: list[tuple[dict, float]] = []
    personalized = False
    for p in pool:
        sim = similarity(my_axes, p.get("axes"))
        if sim is not None:
            personalized = True
        weights.append((p, sim if sim is not None else 0.0))
    if not personalized:
        weights = [(p, 1.0) for p in pool]   # 콜드스타트 — 인기순으로 정직하게

    total_w = sum(w for _, w in weights) or 1.0
    by_name: dict[str, dict] = {}
    for p, w in weights:
        name = p["name"].strip()
        if name in existing_names:
            continue   # 이미 만든 봉투는 다시 권하지 않는다
        slot = by_name.setdefault(name, {"w": 0.0, "count": 0, "amounts": []})
        slot["w"] += w
        slot["count"] += 1
        slot["amounts"].append(float(p["target_amount"]))

    job_label = {"developer": "개발자", "designer": "디자이너", "creator": "크리에이터"}.get(job, job)
    ideas: list[PeerIdea] = []
    for name, s in by_name.items():
        share = round(s["w"] / total_w, 3)
        who = f"나와 성향이 비슷한 {job_label}" if (personalized and scope == "job") else (
            f"{job_label}" if scope == "job" else "긱워커 또래")
        basis = (
            f"{who} {len(pool)}명 중 {s['count']}명이 만든 봉투"
            + (f" — 유사 성향 가중 {share:.0%}" if personalized else " (성향 판독 전 — 직군 인기순)")
        )
        ideas.append(PeerIdea(
            name=name,
            suggested_amount=round(statistics.median(s["amounts"]), 0),
            share=share, count=s["count"], pool=len(pool), scope=scope, basis=basis,
        ))
    ideas.sort(key=lambda i: (-i.share, -i.count, i.name))
    return ideas[:TOP_N]
