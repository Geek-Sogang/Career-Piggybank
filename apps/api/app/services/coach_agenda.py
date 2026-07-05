"""코치 어젠다 큐 — 피기가 아직 말하지 않은 사건을 트리아지해 발화거리로 만든다 (PR D).

이벤트 로그(spoken=0)가 큐이고, 여기는 **트리아지 룰(코드)**이다:
무엇을 먼저(우선순위), 무엇을 묶어(같은 타입 요약), 무엇을 침묵할지(저신호)는
전부 결정론 — ⑨ 피기 발화의 가드레일 그대로 "트리아지는 코드 룰".

발화문은 결정론 템플릿(숫자는 이벤트 payload 인용만) — LLM이 죽어도 벨은 산다.
조정/거절 후속 질문이 행동축 플라이휠의 입구다: 답이 다시 이벤트로 쌓여 페르소나를 돌린다.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.services import bank_flow, income_streams
from app.store import db

# 침묵 타입 — 발화 가치가 없는 저신호. consume 시 조용히 spoken 처리(큐 비우기).
_SILENT_TYPES = frozenset({"txn_tagged", "goal_created", "pacing_decided"})


@dataclass(frozen=True)
class AgendaItem:
    kind: str                    # follow_up_adjust / follow_up_reject / deposit_briefing / stale_settlement
    priority: int                # 1이 가장 먼저 (질문 > 브리핑)
    line: str                    # 피기가 건넬 말 — 결정론 템플릿 (숫자는 payload 인용만)
    event_ids: tuple[str, ...]   # 이 항목이 소비하는 이벤트 (consume 시 spoken 처리)

    def as_dict(self) -> dict:
        return {"kind": self.kind, "priority": self.priority, "line": self.line,
                "event_ids": list(self.event_ids)}


# 이벤트 payload의 action 표기 — 결정 라우트는 요청 동사(adjust/reject)를 그대로 기록한다
_ADJUST_ACTIONS = frozenset({"adjust", "adjusted"})
_REJECT_ACTIONS = frozenset({"reject", "rejected"})


def _adjust_follow_up(ev: dict) -> AgendaItem:
    """조정/거절 후속 질문 — 행동축 플라이휠의 입구 (답변이 다음 페르소나 판독의 재료)."""
    action = ev["payload"].get("action")
    delta = float(ev["payload"].get("buffer_delta") or 0.0)
    if action in _REJECT_ACTIONS:
        return AgendaItem(
            kind="follow_up_reject", priority=1,
            line="지난 배분 제안을 거절하셨어요 — 어떤 부분이 안 맞았는지 알려주시면 다음 제안에 반영할게요.",
            event_ids=(ev["id"],),
        )
    direction = "늘리" if delta > 0 else "줄이"
    return AgendaItem(
        kind="follow_up_adjust", priority=1,
        line=(f"지난 배분에서 여윳돈을 {abs(delta):,.0f}원 {direction}셨네요 — "
              "다음부터 이 방향을 기본으로 반영할까요?"),
        event_ids=(ev["id"],),
    )


def build() -> tuple[list[AgendaItem], list[str]]:
    """미발화 이벤트 → (어젠다 항목, 침묵 처리할 이벤트 id) — 순수 읽기, 상태 변경 없음.

    stale 계약 질문은 이벤트가 아니라 스트림 분해의 현재 상태에서 합성한다
    (event_ids 없음 — 원장이 갱신되면 스스로 사라지는 살아있는 질문).
    """
    items: list[AgendaItem] = []
    silent_ids: list[str] = []
    deposit_events: list[dict] = []

    for ev in db.unspoken_events():
        if ev["type"] in _SILENT_TYPES:
            silent_ids.append(ev["id"])
        elif ev["type"] == "allocation_decided":
            action = ev["payload"].get("action")
            if action in _ADJUST_ACTIONS or action in _REJECT_ACTIONS:
                items.append(_adjust_follow_up(ev))
            else:
                silent_ids.append(ev["id"])   # confirm은 노이즈 — 침묵
        elif ev["type"] == "deposit_received":
            deposit_events.append(ev)
        else:
            silent_ids.append(ev["id"])       # 모르는 타입은 침묵 — 지어내지 않는다

    # 입금 묶음 브리핑 — 같은 타입은 1건으로 (알림 폭주 금지)
    if deposit_events:
        total = sum(float(e["payload"].get("amount") or 0.0) for e in deposit_events)
        items.append(AgendaItem(
            kind="deposit_briefing", priority=2,
            line=(f"새 입금 {len(deposit_events)}건, 총 {total:,.0f}원을 배분해뒀어요 — "
                  "확인해 주시면 봉투로 옮길게요."),
            event_ids=tuple(e["id"] for e in deposit_events),
        ))

    # ① 잔금 지연 질문 — 고아였던 StaleSettlement.question이 여기서 입을 얻는다
    txns = db.list_txns()
    incomes = [t for t in txns if t["kind"] == "income" and t["direction"] == "in"
               and not t["needs_review"]]
    if incomes:
        est = bank_flow.profile_from_store()
        streams = income_streams.decompose(
            incomes, months_observed=float(est.months_observed),
            as_of=max(t["date"] for t in txns),
        )
        for s in streams.stale_settlements:
            items.append(AgendaItem(
                kind="stale_settlement", priority=1, line=s.question, event_ids=(),
            ))

    items.sort(key=lambda i: i.priority)
    return items, silent_ids
