"""⑤a 봉투 추천 에이전트 — 이 사람에게 필요한 목표 봉투를 추천한다 (판정만, 개설은 사람).

역할 하나: "어떤 봉투가 필요한가"만. 금액(그건 ⑤b 페이싱)도, 개설(그건 사람)도 아니다.

가드레일(문법 그대로):
- 잠긴 prefix(세금·경비)는 추천 대상이 아니다 — 법·사실은 취향의 영역 밖.
- 근거 인용 강제 — 어느 팩트 때문인지(예: F04 공백 66일 → '일 없는 달' 봉투) 대야 채택.
- 직군→봉투 하드코딩 표 금지 — 추천은 팩트·페르소나에서만 나온다.
- 이름은 구체적으로 — "안전망봉투" 같은 추상어 대신 "일 없는 달"("사라진 회사 복지"는
  내부 설계 근거일 뿐 사용자에게 보이지 않는다).
- 폴백 = 추천 없음(빈 목록) — 지어내지 않는다. 기본 여윳돈(버퍼)은 항상 있으니 안전.

peer 소스(또래 봉투 통계)는 v1 데모에 데이터가 없어 정직하게 제외 — 팩트 근거만.
호출 주기: 온보딩·소득 패턴 변화 시에만(매 입금 아님) — 오케스트레이션 코드가 정한다.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.core.config import settings
from app.core import llm
from app.engines.facts import Fact
from app.engines.gig_profile import GigProfile

MAX_RECOMMENDATIONS = 3
MAX_NAME_CHARS = 20
LOCKED_PREFIX = ("세금", "경비")   # 추천 금지 — 잠긴 층의 이름을 참칭할 수 없다


@dataclass(frozen=True)
class EnvelopeIdea:
    name: str                  # 구체적 이름 ("일 없는 달")
    why: str                   # 사용자에게 보일 한 줄
    evidence: tuple[str, ...]  # 근거 팩트 ID (접지 게이트 통과분)

    def as_dict(self) -> dict:
        return {"name": self.name, "why": self.why, "evidence": list(self.evidence)}


_SYSTEM = (
    "너는 긱워커 가계부의 목표 봉투 추천 에이전트다. 팩트시트(원장에서 결정론으로 측정된 "
    "사실)와 페르소나 축, 이미 있는 봉투를 보고 — 이 사람에게 필요한 목표 봉투를 최대 "
    f"{MAX_RECOMMENDATIONS}개 추천한다.\n"
    "규칙:\n"
    "- 이름은 구체적인 한국어로 (예: '일 없는 달', '연말 장비 교체'). 추상어 금지.\n"
    "- 세금·경비 봉투는 이미 시스템이 관리한다 — 추천하지 마라.\n"
    "- 이미 있는 봉투와 겹치는 목적은 추천하지 마라.\n"
    "- 긱 소득 구조는 추천의 '우선순위'를 정할 뿐, 추천을 없애지 않는다. 구조 위험이 높으면"
    " 그에 맞는 봉투를 앞세워라: 단일 의존→소득 공백/다각화, 고변동→'일 없는 달', 감속 국면→"
    "은퇴·버퍼, N잡→스트림별. 구조 위험이 낮아도(안정·다각화) 팩트에 근거가 있으면 추천은"
    " 그대로 한다 — 구조는 순서를 바꿀 뿐이다. 근거 팩트는 반드시 달아라(구조는 F01 변동성·"
    "F02 집중도·F04 공백에서 나온다 — 직군 이름으로 찍지 마라).\n"
    "- 각 추천에 반드시 근거 팩트 ID를 단다. 근거 없는 추천은 하지 마라.\n"
    "- 추천할 것이 없으면 빈 목록을 내라 — 억지로 채우지 마라.\n"
    '출력은 JSON만: {"recommendations": [{"name": "...", "why": "한 문장", '
    '"evidence": ["F04"]}, ...]}'
)


def _context(facts: list[Fact], axes: dict | None, existing: list[dict],
             gig: GigProfile | None = None) -> str:
    lines = ["[팩트시트]"]
    for f in facts:
        if f.value is not None:
            lines.append(f"{f.id} · {f.label} = {f.display}  (참고: {f.band})")
    if gig is not None:
        lines.append("\n[긱 소득 구조 (측정된 구조 — 이 사람의 긱 리스크)]")
        lines.append(f"유형: {gig.archetype}")
        lines.append(f"집중도: {gig.concentration} · 변동성: {gig.volatility} · 국면: {gig.phase}")
        if gig.is_multi_gig:
            lines.append("N잡: 성격 다른 소득원 2종 이상 — 스트림별로 나눠 볼 여지")
    if axes:
        lines.append("\n[페르소나 축 (0~1)]")
        for a in axes.values():
            lines.append(f"{a['label']} = {a['value']}")
    lines.append("\n[이미 있는 봉투]")
    if existing:
        lines.extend(f"- {g['name']} (목표 {g['target_amount']:,.0f}원)" for g in existing)
    else:
        lines.append("- (없음 — 기본 여윳돈 버퍼만)")
    return "\n".join(lines)


def recommend(facts: list[Fact], axes: dict | None, existing: list[dict],
              gig: GigProfile | None = None) -> list[EnvelopeIdea]:
    """봉투 추천 판독 — 게이트 실패·LLM 다운이면 빈 목록 (지어내지 않음).

    gig(측정된 긱 소득 구조)를 주면 추천이 그 구조 위험에 맞춰 갈린다 — 판단은 LLM,
    접지 게이트는 그대로(근거 팩트 실존 필수). 구조는 팩트에서 나오므로 근거는 여전히 F##.
    """
    measured = {f.id for f in facts if f.value is not None}
    out = llm.chat_json(_SYSTEM, _context(facts, axes, existing, gig),
                        model=settings.ollama_model_coach)
    if not isinstance(out, dict) or not isinstance(out.get("recommendations"), list):
        return []

    existing_names = {g["name"].strip() for g in existing}
    ideas: list[EnvelopeIdea] = []
    for item in out["recommendations"][:MAX_RECOMMENDATIONS]:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()[:MAX_NAME_CHARS]
        why = str(item.get("why", "")).strip()[:120]
        raw = item.get("evidence")
        evidence = tuple(e for e in raw if e in measured) if isinstance(raw, list) else ()
        # 게이트: 이름 실재 · 잠긴 층 참칭 금지 · 중복 금지 · 접지(근거 팩트 실존) 필수
        if not name or not why:
            continue
        if any(lock in name for lock in LOCKED_PREFIX):
            continue
        if name in existing_names:
            continue
        if not evidence:
            continue  # 근거 없는 추천은 폐기 — 접지 게이트
        ideas.append(EnvelopeIdea(name=name, why=why, evidence=evidence))
    return ideas
