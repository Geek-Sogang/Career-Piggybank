"""분류기 2단계 — 로컬 LLM 폴백 (멀티에이전트 문법).

멀티에이전트 문법 (ARCHITECTURE.md, 무조건 준수):
- **역할 분리**: 에이전트마다 하나의 일 — 분류 에이전트는 분류만, 판정 에이전트는 검증만.
- **오케스트레이션**: 흐름은 LLM이 아니라 이 파이썬 코드가 정한다.
  룰이 잡으면 LLM은 호출조차 안 됨 → unknown만 분류 에이전트 → 판정 에이전트 순.
- **가드레일**: AI는 판정만, 실행은 사람.
  · LLM 경로 확신도는 상한(0.75)을 넘지 못한다 — 룰(0.95)보다 항상 낮게.
  · 판정 에이전트가 반려하면 needs_review.
  · **LLM의 매출(income) 판정은 자동 반영 금지** — 세금·배분을 트리거하는 위험 판단이라
    사용자 확인 후 반영 (골든셋에서 개인 입금 오분류로 검증된 가드레일).
  · 고액 거래(100만원↑)는 판정 결과와 무관하게 무조건 needs_review(사용자에게 직접 질문).
  · LLM 다운/응답 깨짐이면 룰 결과(unknown→수기 태그)로 안전 폴백.
"""
from __future__ import annotations

from app.services import llm
from app.services.classifier import Classification, Kind, Subtype, TxnInput, classify

LLM_CONFIDENCE_CAP = 0.75      # LLM 경로는 룰 신호(0.9~0.95)보다 항상 낮은 확신도
LARGE_TXN_REVIEW = 1_000_000   # 이 금액 이상은 AI가 인지만 하고 무조건 사용자에게 물어봄

_VALID_KINDS: set[str] = {"income", "expense", "living"}
_VALID_SUBTYPES: set[str | None] = {"settlement", "advance", "subscription", "operating", None}

_CLASSIFY_SYSTEM = """너는 긱워커(프리랜서) 가계부의 거래 분류 에이전트다. 분류만 한다 — 배분·조언·설명은 네 일이 아니다.
거래 1건을 보고 JSON만 출력한다:
{"kind": "income|expense|living", "subtype": "settlement|advance|subscription|operating|null", "confidence": 0.0~1.0, "rationale": "판단 근거 한 문장(한국어)"}

kind 기준:
- income: 일감 매출 (발주처 대금, 플랫폼 정산). subtype: settlement=잔금/완료대금, advance=계약금/선금
- living: 개인 간 돈 (더치페이·회식비 정산·용돈·중고거래·환불). **개인 이름에게 받은 입금은 '일' 맥락이 명확하지 않으면 income이 아니라 living이다.**
- expense: 사업 경비 (소프트웨어 구독=subscription, 장비·호스팅·작업실=operating)

예시:
- 입금 45,000원 / 상대: 김철수 / 메모: 회식비 정산 → {"kind":"living","subtype":null,"confidence":0.8,"rationale":"개인 간 더치페이 정산 — 매출 아님"}
- 입금 300,000원 / 상대: ㈜브랜딩랩 / 메모: 로고 착수금 → {"kind":"income","subtype":"advance","confidence":0.8,"rationale":"발주처의 계약 착수금"}
- 입금 120,000원 / 상대: 이영희 / 메모: 없음 → {"kind":"living","subtype":null,"confidence":0.45,"rationale":"개인 입금, 맥락 없음 — 확신 낮음"}

확신이 없으면 confidence를 0.5 미만으로 낮춰라. 추측으로 확신을 부풀리지 마라."""

_JUDGE_SYSTEM = """너는 거래 분류의 판정 에이전트다. 판정만 한다 — 재분류하지 않는다.
분류 에이전트의 답이 거래 정보와 모순되지 않는지 검증하고 JSON만 출력한다:
{"approve": true|false, "reason": "판정 이유 한 문장(한국어)"}

반려(approve=false) 기준:
- 라벨이 거래 정보와 명백히 모순 (예: 출금인데 income)
- 근거(rationale)가 거래 정보에 없는 사실을 지어냄
- 개인 간 거래일 가능성이 높은데 income으로 단정함"""


def _txn_brief(txn: TxnInput) -> str:
    direction = "입금" if txn.direction == "in" else "출금"
    memo = f" / 메모: {txn.memo}" if txn.memo else ""
    return f"{direction} {txn.amount:,.0f}원 / 상대: {txn.counterparty}{memo} / 날짜: {txn.date}"


def _classify_agent(txn: TxnInput) -> dict | None:
    """에이전트 1 — 분류만. 검증된 스키마의 dict 또는 None."""
    out = llm.chat_json(_CLASSIFY_SYSTEM, _txn_brief(txn))
    if not out or out.get("kind") not in _VALID_KINDS:
        return None
    subtype = out.get("subtype")
    if subtype in ("null", ""):
        subtype = None
    if subtype not in _VALID_SUBTYPES:
        subtype = None
    try:
        confidence = min(1.0, max(0.0, float(out.get("confidence", 0))))
    except (TypeError, ValueError):
        return None
    return {
        "kind": out["kind"], "subtype": subtype, "confidence": confidence,
        "rationale": str(out.get("rationale", ""))[:200],
    }


def _judge_agent(txn: TxnInput, proposal: dict) -> dict:
    """에이전트 2 — 판정만. LLM 실패 시 보수적으로 반려."""
    user = (
        f"거래: {_txn_brief(txn)}\n"
        f"분류 에이전트의 답: kind={proposal['kind']}, subtype={proposal['subtype']}, "
        f"confidence={proposal['confidence']}, 근거: {proposal['rationale']}"
    )
    out = llm.chat_json(_JUDGE_SYSTEM, user)
    if not out or not isinstance(out.get("approve"), bool):
        return {"approve": False, "reason": "판정 에이전트 응답 없음 — 보수적으로 반려"}
    return {"approve": out["approve"], "reason": str(out.get("reason", ""))[:200]}


def classify_with_fallback(txn: TxnInput) -> Classification:
    """오케스트레이터 — 조건 분기·흐름 제어는 코드가 한다.

    룰 매치 → 그대로 반환 (LLM 미호출)
    unknown → 분류 에이전트 → 판정 에이전트 → 가드레일 적용
    """
    rule_result = classify(txn)
    if rule_result.kind != "unknown":
        return rule_result  # 룰이 잡았으면 LLM은 호출조차 하지 않는다

    proposal = _classify_agent(txn)
    if proposal is None:
        # LLM 다운/스키마 위반 → 룰 결과(unknown, 수기 태그)로 안전 폴백
        return Classification(
            kind=rule_result.kind, subtype=rule_result.subtype,
            confidence=rule_result.confidence, needs_review=True,
            signals=[*rule_result.signals, "AI 분류 에이전트 응답 없음 → 수기 태그"],
        )

    verdict = _judge_agent(txn, proposal)
    kind: Kind = proposal["kind"]
    subtype: Subtype = proposal["subtype"]
    confidence = min(proposal["confidence"], LLM_CONFIDENCE_CAP)  # 가드레일: 확신도 상한

    signals = [
        *rule_result.signals,
        f"AI 분류 에이전트: {kind}/{subtype or '-'} — {proposal['rationale']}",
        f"AI 판정 에이전트: {'승인' if verdict['approve'] else '반려'} — {verdict['reason']}",
    ]

    needs_review = not verdict["approve"]
    if kind == "income":  # 가드레일: 매출 판정은 세금·배분을 트리거하는 위험 판단 → 자동 반영 금지
        needs_review = True
        signals.append("AI의 매출(income) 판정은 자동 반영하지 않아요 — 확인 후 배분이 시작돼요")
    if txn.amount >= LARGE_TXN_REVIEW:  # 가드레일: 고액은 AI가 인지만, 결정은 사용자
        needs_review = True
        signals.append(
            f"고액 거래({txn.amount:,.0f}원 ≥ {LARGE_TXN_REVIEW:,}원) — AI 판정과 무관하게 직접 확인 요청"
        )

    return Classification(
        kind=kind, subtype=subtype, confidence=round(confidence, 2),
        needs_review=needs_review, signals=signals,
    )
