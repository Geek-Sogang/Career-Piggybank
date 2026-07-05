"""⑤b 금액 페이싱 에이전트 — 이번 입금에서 목표들의 우선순위·속도만 판단한다.

역할 하나: "어느 목표를 먼저, 어떤 속도로"라는 취향 판단. 원화는 만들지 않는다 —
번역(산수·버퍼 보호·합계 보존)은 services/pacing 엔진의 몫이고, 잔액 이동은 사람 승인 후다.

같은 목표·같은 소득이라도 페르소나가 페이싱을 가른다 — 여기가 "이름 붙이기(commodity)"와
"얼마씩(진짜 상품)"이 갈리는 지점이다.

판단 = 번호만 선택 (재현성 경계):
- 우선순위: 목표 ID의 순열
- 스탠스: 목표별 {보류 | 기본 | 당김} — 배속 번역표(MULTIPLIERS)는 pacing 엔진에
게이트(결정론): 순열 완전성 · 스탠스 메뉴 · 근거 접지 → 실패는 산수 폴백
  (기본 페이스 ×1.0, 우선순위 = 기한 임박순) — 판단이 죽어도 페이싱은 산다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.config import settings
from app.services import llm
from app.services.facts import Fact
from app.services.pacing import MULTIPLIERS

STANCE_MENU = tuple(MULTIPLIERS)   # ("보류", "기본", "당김")

_FACT_ID = re.compile(r"^(F\d{2})\b")


def _normalize_evidence(raw: list, measured: set[str]) -> tuple[list[str], list[str]]:
    """근거 정규화 — 'F04 (설명…)' 형식 노이즈에서 ID만 추출한다.

    관용은 형식에만: ID가 아예 없는 항목(축 언급 등)은 조용히 버리고,
    추출된 ID가 실측 팩트가 아니면(지어냄) 그대로 접지 실패다 — 발명 검사는 그대로 세다.
    """
    ids: list[str] = []
    invented: list[str] = []
    for item in raw:
        m = _FACT_ID.match(str(item).strip())
        if not m:
            continue
        fid = m.group(1)
        (ids if fid in measured else invented).append(fid)
    return ids, invented


@dataclass(frozen=True)
class PacingJudgment:
    priorities: tuple[str, ...]        # 목표 ID 순열
    stances: dict[str, str]            # goal_id → 보류/기본/당김
    evidence: tuple[str, ...]
    reason: str
    fallback: bool
    gate_failures: tuple[str, ...]

    def as_dict(self) -> dict:
        return {
            "priorities": list(self.priorities), "stances": self.stances,
            "evidence": list(self.evidence), "reason": self.reason,
            "fallback": self.fallback, "gate_failures": list(self.gate_failures),
        }


def _deadline_order(goals: list[dict]) -> tuple[str, ...]:
    """산수 폴백의 우선순위 — 기한 임박순, 기한 없으면 만든 순."""
    return tuple(
        g["id"] for g in sorted(goals, key=lambda g: (g.get("target_date") is None,
                                                      g.get("target_date") or "", g["seq"]))
    )


def _fallback(goals: list[dict], failures: list[str]) -> PacingJudgment:
    return PacingJudgment(
        priorities=_deadline_order(goals),
        stances={g["id"]: "기본" for g in goals},
        evidence=(), reason="산수 폴백 — 기본 페이스 ×1.0, 기한 임박순",
        fallback=True, gate_failures=tuple(failures),
    )


def _system_prompt() -> str:
    menu = " | ".join(STANCE_MENU)
    return (
        "너는 긱워커 가계부의 금액 페이싱 판단 에이전트다. 이번 입금의 여윳돈을 목표 "
        "봉투들에 나눌 때 — 어느 목표를 먼저, 어떤 속도로 갈지만 판단한다. 원화 계산은 "
        "네 일이 아니다(산수 엔진이 번역한다).\n"
        "팩트시트(측정된 사실)와 페르소나 축을 보고 판단하라. 예: 수주 공백이 길면 "
        "기한 없는 목표는 '보류'하고 안전을 앞세운다, 여유가 있고 기한이 임박하면 '당김'.\n"
        f"스탠스 보기 (반드시 이 셋 중 하나): {menu}\n"
        '출력은 JSON만: {"priorities": ["목표ID", ...  — 전체 목표를 한 번씩], '
        '"stances": {"목표ID": "보류|기본|당김", ...}, '
        '"evidence": ["F04"], "reason": "한 문장"}\n'
        'evidence는 팩트 ID 문자열만 (예: ["F04", "F09"]) — 설명·괄호 붙이지 마라.'
    )


def _context(goals: list[dict], facts: list[Fact], axes: dict | None) -> str:
    lines = ["[목표 봉투]"]
    for g in goals:
        deadline = g.get("target_date") or "기한 없음"
        lines.append(
            f"{g['id']} · {g['name']} — 목표 {g['target_amount']:,.0f}원 중 "
            f"{g['balance']:,.0f}원 모음 · {deadline}"
        )
    lines.append("\n[팩트시트]")
    for f in facts:
        if f.value is not None:
            lines.append(f"{f.id} · {f.label} = {f.display}  (참고: {f.band})")
    if axes:
        lines.append("\n[페르소나 축 (0~1)]")
        for a in axes.values():
            lines.append(f"{a['label']} = {a['value']}")
    return "\n".join(lines)


def judge(goals: list[dict], facts: list[Fact], axes: dict | None) -> PacingJudgment:
    """페이싱 판단 — 게이트 실패·LLM 다운이면 산수 폴백 (페이싱은 항상 산다)."""
    if not goals:
        return PacingJudgment((), {}, (), "목표 없음", False, ())

    out = llm.chat_json(_system_prompt(), _context(goals, facts, axes),
                        model=settings.ollama_model_coach)
    if not isinstance(out, dict):
        return _fallback(goals, ["llm_unavailable"])

    failures: list[str] = []
    goal_ids = {g["id"] for g in goals}

    # 게이트 1 — 우선순위는 전체 목표의 순열이어야 한다 (빠짐·중복·유령 금지)
    raw_pri = out.get("priorities")
    priorities = [p for p in raw_pri] if isinstance(raw_pri, list) else []
    if sorted(map(str, priorities)) != sorted(goal_ids):
        failures.append("priorities_not_permutation")

    # 게이트 2 — 스탠스는 메뉴에서만
    raw_st = out.get("stances")
    stances = dict(raw_st) if isinstance(raw_st, dict) else {}
    for gid in goal_ids:
        if stances.get(gid) not in STANCE_MENU:
            failures.append(f"stance_menu:{gid}")

    # 게이트 3 — 접지: 근거 팩트 실존 (형식 노이즈는 정규화, 지어낸 ID는 탈락)
    measured = {f.id for f in facts if f.value is not None}
    raw_ev = out.get("evidence")
    evidence, invented = _normalize_evidence(
        raw_ev if isinstance(raw_ev, list) else [], measured
    )
    if invented:
        failures.append(f"grounding:{','.join(invented)}")

    if failures:
        return _fallback(goals, failures)

    return PacingJudgment(
        priorities=tuple(map(str, priorities)),
        stances={str(k): str(v) for k, v in stances.items()},
        evidence=tuple(evidence),
        reason=str(out.get("reason", "")).strip()[:200],
        fallback=False, gate_failures=(),
    )
