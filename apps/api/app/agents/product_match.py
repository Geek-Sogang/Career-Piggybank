"""⑥ 상품 매칭 에이전트 — 적격 후보 중 이 사람에게 맞는 하나 상품을 고른다 (가입은 사람).

역할 하나: "적격 후보 중 지금 이 사람에게 무엇이 맞는가"만. 후보 생성(그건 적합성
veto 필터 — 결정론)도, 가입(그건 사람)도 아니다.

가드레일(문법 그대로):
- 메뉴 게이트 — 후보 목록 밖의 상품 ID는 폐기. 부적합 상품은 애초에 메뉴에 없다
  (적합성 veto가 선행) — AI가 고르되, 고를 수 없는 것이 구조로 정해져 있다.
- 접지 게이트 — 근거 팩트 ID 인용 강제. 근거 없는 매칭은 폐기.
- 숫자 게이트 — 문구의 3자리 이상 숫자가 컨텍스트에 없으면 그 문구를 버리고
  후보의 결정론 템플릿(basis)으로 교체 (코치 PR #9의 숫자 검증기 문법).
- 폴백 = 룰 — LLM 다운·전부 게이트 탈락이면 후보 순서 상위 2개 + 결정론 문구.

호출 주기: 명시 요청·페르소나 스냅샷 갱신 시에만 — 입금 핫패스가 아니다
(핫패스의 즉시 훅은 services/product_match.hooks_for 룰이 그대로 담당).
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.config import settings
from app.core import llm
from app.engines.facts import Fact
from app.engines.product_match import MAX_HOOKS, Candidate

_DIGITS = re.compile(r"\d[\d,\.]*")


@dataclass(frozen=True)
class ProductPick:
    product_id: str
    name: str
    envelope: str
    line: str                  # 사용자에게 보일 한 줄 (LLM 통과분 또는 결정론 템플릿)
    evidence: tuple[str, ...]  # 근거 팩트 ID (접지 게이트 통과분 — rule 폴백은 빈 튜플)
    source: str                # "llm" / "rule"

    def as_dict(self) -> dict:
        return {"product_id": self.product_id, "name": self.name, "envelope": self.envelope,
                "line": self.line, "evidence": list(self.evidence), "source": self.source}


_SYSTEM = (
    "너는 긱워커 가계부의 하나은행 상품 매칭 에이전트다. 적격 후보 목록(적합성 검증을 "
    "이미 통과한 상품들)과 팩트시트, 페르소나 축, 목표 봉투를 보고 — 지금 이 사람에게 "
    f"맞는 상품을 최대 {MAX_HOOKS}개 고른다.\n"
    "규칙:\n"
    "- product_id는 반드시 [적격 후보] 목록에 있는 ID만. 목록 밖 상품은 절대 금지.\n"
    "- 각 선택에 반드시 근거 팩트 ID를 단다 (예: [\"F02\"]). 근거 없는 선택은 하지 마라.\n"
    "- why는 이 사람의 팩트에 기대 한 문장. 컨텍스트에 없는 숫자를 지어내지 마라.\n"
    "- 맞는 상품이 없으면 빈 목록을 내라 — 억지로 채우지 마라.\n"
    '출력은 JSON만: {"picks": [{"product_id": "parking", "why": "한 문장", '
    '"evidence": ["F02"]}, ...]}'
)


def _context(candidates: list[Candidate], facts: list[Fact],
             axes: dict | None, goals: list[dict]) -> str:
    lines = ["[적격 후보 — 이 중에서만 고를 수 있다]"]
    lines.extend(f"- {c.product_id}: {c.name} · {c.basis}" for c in candidates)
    lines.append("\n[팩트시트]")
    for f in facts:
        if f.value is not None:
            lines.append(f"{f.id} · {f.label} = {f.display}  (참고: {f.band})")
    if axes:
        lines.append("\n[페르소나 축 (0~1)]")
        lines.extend(f"{a['label']} = {a['value']}" for a in axes.values())
    lines.append("\n[목표 봉투]")
    if goals:
        lines.extend(f"- {g['name']} (목표 {g['target_amount']:,.0f}원)" for g in goals)
    else:
        lines.append("- (없음 — 기본 여윳돈 버퍼만)")
    return "\n".join(lines)


def _numbers_grounded(line: str, context_text: str) -> bool:
    """문구의 3자리 이상 숫자가 컨텍스트 숫자의 부분열인지 — 코치 숫자 검증기 문법."""
    ctx_tokens = [t.replace(",", "").replace(".", "")
                  for t in _DIGITS.findall(context_text)]
    for token in _DIGITS.findall(line):
        digits = token.replace(",", "").replace(".", "")
        if len(digits) <= 2:
            continue
        if not any(digits in ctx for ctx in ctx_tokens):
            return False
    return True


def _rule_fallback(candidates: list[Candidate]) -> list[ProductPick]:
    """LLM 다운·전부 탈락 → 후보 순서 상위 MAX_HOOKS개 + 결정론 문구 (지어내지 않음)."""
    return [
        ProductPick(c.product_id, c.name, c.envelope, c.basis, (), "rule")
        for c in candidates[:MAX_HOOKS]
    ]


def select(candidates: list[Candidate], facts: list[Fact],
           axes: dict | None, goals: list[dict]) -> list[ProductPick]:
    """상품 매칭 판독 — 게이트 3종(메뉴·접지·숫자) 통과분만, 실패는 룰 폴백."""
    if not candidates:
        return []
    menu = {c.product_id: c for c in candidates}
    measured = {f.id for f in facts if f.value is not None}
    context_text = _context(candidates, facts, axes, goals)

    out = llm.chat_json(_SYSTEM, context_text, model=settings.ollama_model_coach)
    if not isinstance(out, dict) or not isinstance(out.get("picks"), list):
        return _rule_fallback(candidates)

    picks: list[ProductPick] = []
    seen: set[str] = set()
    for item in out["picks"][:MAX_HOOKS]:
        if not isinstance(item, dict):
            continue
        pid = str(item.get("product_id", "")).strip()
        if pid not in menu or pid in seen:
            continue  # 메뉴 게이트 — 후보 밖 상품·중복은 폐기 (발명 차단)
        raw = item.get("evidence")
        evidence = tuple(e for e in raw if e in measured) if isinstance(raw, list) else ()
        if not evidence:
            continue  # 접지 게이트 — 근거 팩트 없는 매칭은 폐기
        cand = menu[pid]
        why = str(item.get("why", "")).strip()[:120]
        # 숫자 게이트 — 지어낸 숫자면 문구만 결정론 템플릿으로 교체 (선택은 유지)
        line = why if why and _numbers_grounded(why, context_text) else cand.basis
        picks.append(ProductPick(pid, cand.name, cand.envelope, line, evidence, "llm"))
        seen.add(pid)

    return picks if picks else _rule_fallback(candidates)
