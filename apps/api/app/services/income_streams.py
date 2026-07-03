"""소득 스트림 분해 — 긱워커 소득은 하나의 시계열이 아니라 성격이 다른 물줄기의 혼합이다.

"플랫폼 정산 주기만이 전부가 아니잖아, 발주도 있고"(7/4)에 대한 구현 답.
전부를 한 주머니에 넣고 간격 중앙값을 내면 주기적인 것과 무작위인 것이 서로를 뭉갠다.
그래서 **분류기가 만든 라벨로 소득을 4갈래로 분해**하고, 갈래별로 다른 방법을 쓴다:

| 스트림 | 배정 근거 (분류기 출력 재사용) | 방법 |
|---|---|---|
| A. 플랫폼 정산 | 정산 채널명·플랫폼 힌트 (classifier와 동일 판정) | 채널별 간격 중앙값 → 주기 |
| B. 반복 발주처 | 같은 counterparty 2회 이상 | 발주처별 간격 중앙값 |
| C. 착수금→잔금 | subtype == "advance" 관측, 이후 같은 상대 입금 없음 | **진행 중 계약 추적** — 예정 이벤트 |
| D. 신규/일회성 | 나머지 | 시점 예측 포기, 도착률(건/월)만 |

C가 보석이다: 착수금이 들어왔다는 건 잔금이 온다는 신호 — 원장이 이미 미래를 조금 안다.
D는 원장 어디에도 신호가 없다 — 이 구멍은 모델이 아니라 코치의 대화(§6-2⑥)가 메운다.

전부 결정론. 다음 수입 창은 스트림별 예상 이벤트의 합성(가장 이른 후보)이고,
후보가 하나도 없으면(콜드스타트) 기존 간격 통계(next_income_window)로 폴백한다.
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from datetime import date, timedelta

from app.services.classifier import SETTLEMENT_NAME_TOKEN, _looks_platform

MIN_OBS_FOR_RHYTHM = 2          # 채널/발주처 리듬 추정에 필요한 최소 관측
DEFAULT_SETTLEMENT_LAG = 30.0   # 착수금→잔금 관측 쌍이 없을 때 기본 간격(일)
STALE_LAG_MULTIPLIER = 2.0      # 예상 lag의 2배가 지나도 잔금이 없으면 '지연' — 추적을 멈추고 사람에게 묻는다


@dataclass(frozen=True)
class StreamCandidate:
    """다음 수입 예상 이벤트 1개 — 어느 물줄기에서 왜 그렇게 예상하는지까지."""

    source: str        # platform | repeat_client | pending_settlement
    label: str         # 채널/발주처 이름
    expected_date: str
    basis: str         # 근거 문장 (한국어)


@dataclass(frozen=True)
class PendingSettlement:
    """진행 중 계약 — 착수금은 관측됐고 잔금은 아직인 상태."""

    counterparty: str
    advance_date: str
    advance_amount: float
    expected_date: str
    basis: str


@dataclass(frozen=True)
class StaleSettlement:
    """지연된 계약 — 잔금이 예상보다 오래 안 들어옴. 예측을 오염시키는 대신 질문이 된다."""

    counterparty: str
    advance_date: str
    advance_amount: float
    question: str      # 코치가 던질 확인 질문 (결정론 템플릿)


@dataclass(frozen=True)
class IncomeStreams:
    platform_channels: int
    repeat_clients: int
    one_off_per_month: float          # 신규/일회성 도착률 (건/월)
    candidates: list[StreamCandidate] = field(default_factory=list)
    pending_settlements: list[PendingSettlement] = field(default_factory=list)
    stale_settlements: list[StaleSettlement] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)


def _is_platform(name: str) -> bool:
    return _looks_platform(name) or SETTLEMENT_NAME_TOKEN in name


def _median_gap(dates: list[date]) -> float | None:
    if len(dates) < MIN_OBS_FOR_RHYTHM:
        return None
    ds = sorted(dates)
    return float(statistics.median((b - a).days for a, b in zip(ds, ds[1:])))


def _advance_lag(txns: list[dict]) -> tuple[float, str]:
    """착수금→잔금 실측 간격 — 같은 상대의 advance 이후 첫 입금까지. 쌍이 없으면 기본값."""
    lags: list[float] = []
    by_cp: dict[str, list[dict]] = {}
    for t in sorted(txns, key=lambda t: t["date"]):
        by_cp.setdefault(t["counterparty"].strip(), []).append(t)
    for items in by_cp.values():
        for i, t in enumerate(items):
            if t.get("subtype") == "advance":
                later = [x for x in items[i + 1:] if x.get("subtype") != "advance"]
                if later:
                    lags.append(
                        float((date.fromisoformat(later[0]["date"]) - date.fromisoformat(t["date"])).days)
                    )
    if lags:
        return statistics.median(lags), f"내 계약 이력의 착수금→잔금 간격 중앙값 {statistics.median(lags):.0f}일"
    return DEFAULT_SETTLEMENT_LAG, f"착수금→잔금 관측 쌍 없음 — 기본값 {DEFAULT_SETTLEMENT_LAG:.0f}일(콜드스타트)"


def decompose(
    income_txns: list[dict],
    months_observed: float = 0.0,
    user_events: list[dict] | None = None,
    as_of: str | None = None,
) -> IncomeStreams:
    """income 거래(date·amount·counterparty·subtype) → 스트림 분해 (순수 함수).

    user_events: 코치가 대화로 수집한 예정 수입(§6-2⑥) — 스트림 D의 구멍을 사람이 메운 것.
    """
    txns = sorted(income_txns, key=lambda t: t["date"])
    reasons: list[str] = []
    candidates: list[StreamCandidate] = []

    by_cp: dict[str, list[dict]] = {}
    for t in txns:
        by_cp.setdefault(t["counterparty"].strip(), []).append(t)

    # A. 플랫폼 정산 — 채널별 주기
    platform_names = [cp for cp in by_cp if _is_platform(cp)]
    for cp in platform_names:
        dates = [date.fromisoformat(t["date"]) for t in by_cp[cp]]
        gap = _median_gap(dates)
        if gap is not None:
            expected = max(dates) + timedelta(days=gap)
            candidates.append(StreamCandidate(
                source="platform", label=cp, expected_date=expected.isoformat(),
                basis=f"'{cp}' 정산 주기 {gap:.0f}일 (관측 {len(dates)}건)",
            ))

    # B. 반복 발주처 — 발주처별 리듬 (플랫폼 제외)
    repeat_names = [
        cp for cp, items in by_cp.items()
        if not _is_platform(cp) and len(items) >= MIN_OBS_FOR_RHYTHM
    ]
    for cp in repeat_names:
        dates = [date.fromisoformat(t["date"]) for t in by_cp[cp]]
        gap = _median_gap(dates)
        if gap is not None and gap > 0:
            expected = max(dates) + timedelta(days=gap)
            candidates.append(StreamCandidate(
                source="repeat_client", label=cp, expected_date=expected.isoformat(),
                basis=f"'{cp}' 재수주 리듬 {gap:.0f}일 (관측 {len(dates)}건)",
            ))

    # C. 착수금→잔금 — 진행 중 계약 추적 (원장이 이미 아는 미래).
    #    예상 lag의 2배가 지나도 안 들어오면 '지연' — 예측 후보에서 빼고 코치 질문으로 전환
    #    (오염된 예측을 방치하는 대신, 모르게 된 것을 사람에게 묻는다 = 확인 게이트 문법)
    lag, lag_basis = _advance_lag(txns)
    ref = date.fromisoformat(as_of) if as_of else (
        date.fromisoformat(txns[-1]["date"]) if txns else None
    )
    pending: list[PendingSettlement] = []
    stale: list[StaleSettlement] = []
    for cp, items in by_cp.items():
        for i, t in enumerate(items):
            if t.get("subtype") == "advance":
                settled = any(x.get("subtype") != "advance" for x in items[i + 1:])
                if settled:
                    continue
                adv = date.fromisoformat(t["date"])
                expected = adv + timedelta(days=lag)
                if ref is not None and ref > adv + timedelta(days=lag * STALE_LAG_MULTIPLIER):
                    stale.append(StaleSettlement(
                        counterparty=cp, advance_date=t["date"], advance_amount=t["amount"],
                        question=(
                            f"'{cp}' 잔금이 예상({expected.isoformat()})보다 오래 걸리고 있어요 — "
                            "들어왔는데 다른 이름이었나요, 아니면 아직인가요?"
                        ),
                    ))
                    continue
                pending.append(PendingSettlement(
                    counterparty=cp, advance_date=t["date"], advance_amount=t["amount"],
                    expected_date=expected.isoformat(), basis=lag_basis,
                ))
                candidates.append(StreamCandidate(
                    source="pending_settlement", label=cp, expected_date=expected.isoformat(),
                    basis=f"'{cp}' 착수금 {t['amount']:,.0f}원 관측 — 잔금 예상 ({lag_basis})",
                ))

    # 사용자가 직접 알려준 예정 수입 — 스트림 D의 구멍을 대화가 메운다 (가장 강한 후보)
    for ev in user_events or []:
        amount_txt = f" {ev['amount']:,.0f}원" if ev.get("amount") else ""
        candidates.append(StreamCandidate(
            source="user_reported", label=ev["label"], expected_date=ev["date"],
            basis=f"코치에게 직접 알려주신 예정 수입: {ev['label']}{amount_txt}",
        ))

    # D. 신규/일회성 — 시점은 못 맞힌다. 도착률만 정직하게
    one_off = [
        cp for cp, items in by_cp.items()
        if not _is_platform(cp) and len(items) < MIN_OBS_FOR_RHYTHM
        and not any(t.get("subtype") == "advance" for t in items)
    ]
    rate = round(len(one_off) / months_observed, 2) if months_observed > 0 else 0.0

    candidates.sort(key=lambda c: c.expected_date)
    reasons.append(
        f"소득 물줄기 분해: 플랫폼 {len(platform_names)}곳 · 반복 발주처 {len(repeat_names)}곳 · "
        f"진행 중 계약 {len(pending)}건 · 신규/일회성 월 {rate:.1f}건"
    )
    if not candidates:
        reasons.append("리듬 있는 물줄기가 아직 없음 — 전체 간격 통계로 폴백(콜드스타트)")
    if one_off and months_observed > 0:
        reasons.append("신규 발주는 원장에 신호가 없어요 — 진행 중인 영업은 코치에게 알려주시면 반영해요")

    if stale:
        reasons.append(f"지연된 계약 {len(stale)}건 — 예측에서 제외하고 코치가 확인을 요청해요")

    return IncomeStreams(
        platform_channels=len(platform_names),
        repeat_clients=len(repeat_names),
        one_off_per_month=rate,
        candidates=candidates,
        pending_settlements=pending,
        stale_settlements=stale,
        reasons=reasons,
    )


def composite_next(streams: IncomeStreams, after: str) -> StreamCandidate | None:
    """다음 수입 = 스트림별 예상 이벤트 중 기준일 이후 가장 이른 것. 없으면 None(폴백 신호)."""
    future = [c for c in streams.candidates if c.expected_date >= after]
    pool = future or streams.candidates
    return pool[0] if pool else None
