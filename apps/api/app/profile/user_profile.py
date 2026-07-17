"""사용자 프로필 aggregate — 원장을 한 번만 읽어 프로필 전 조각을 합성하는 SSOT.

이전엔 배분·추천 소비자마다 원장을 다시 읽어 같은 상류 계산을 따로 돌렸다: 입금 1건에
career_signals 2회·income_streams 3회·factsheet 통째 재빌드가 배분 핫패스에서 벌어졌다.
이 aggregate가 그 조립을 한 곳으로 모은다 — 원장 읽기 1회 → 공유 상류 계산(팩트·커리어
신호·스트림) 1회 → 소비자에게 슬라이스 제공.

원칙 그대로: 여기는 조립(계산·결정론)만 한다. 판단(AI)은 agents/, 흐름은 orchestration,
정책 override(밴딧)는 여전히 그걸 아는 호출자(bank_flow)가 얹는다 — 이 파일은 정책을 모른다.
값은 기존 함수를 그대로 재사용해 만든다(동작 불변): 소비자가 이걸 쓰든 옛 경로를 쓰든 같은 수.
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass

from app.engines import career_verification, facts as facts_svc
from app.engines import forecast, gig_profile, income_streams, spending_profile
from app.engines.career_verification import CareerVerification
from app.engines.allocator import BIAS_MIN_SAMPLES, AllocationContext
from app.engines.facts import Fact
from app.engines.forecast import CareerSignals, IncomeGap
from app.engines.gig_profile import GigProfile
from app.engines.income_streams import IncomeStreams
from app.engines.spending_profile import ProfileEstimate, Txn
from app.store import db

DEFAULT_PERSONA = "developer"      # profile_from_store 기본 페르소나와 동기화
ADJUSTMENT_LOOKBACK = 5            # 조정 성향 집계에 쓰는 최근 조정 건수 (bank_flow와 동일)


def _buffer_bias(allocations: list[dict]) -> float:
    """행동 신호 — 최근 조정에서 사용자가 버퍼를 얼마나 늘려 왔나 (중앙값, 원).

    bank_flow.buffer_adjustment_bias와 같은 산식이되, 이미 읽어 둔 allocations를 재사용한다
    (원장 재조회 제거). 이력이 BIAS_MIN_SAMPLES 미만이거나 중앙값이 0 이하면 0 — 늘리는
    습관만 선반영(보수적).
    """
    deltas = [
        float(a["final"].get("buffer", 0)) - float(a["proposed"].get("buffer", 0))
        for a in allocations
        if a["status"] == "adjusted" and a["final"]
    ][-ADJUSTMENT_LOOKBACK:]
    if len(deltas) < BIAS_MIN_SAMPLES:
        return 0.0
    return max(0.0, statistics.median(deltas))


@dataclass(frozen=True)
class UserProfile:
    """이 사용자가 누구인가 — 소득·긱 구조·스트림·성향·행동을 한 객체로 합친 aggregate.

    전 필드는 원장에서 잰 결정론 산출물(persona_axes만 판독 스냅샷 — 없으면 None).
    소비자(배분·추천·페이싱)는 여기서 슬라이스를 받고, 상류 계산을 다시 하지 않는다.
    """

    as_of: str | None                 # 원장 마지막 거래일 (스트림·예정수입 기준점)
    months_observed: int              # 거래가 있는 달력 월 수 (전체 거래 기준)
    income_dates: tuple[str, ...]     # 확정 income 입금일 (원장 순서 — 정책 분위수·간격 산출용)
    spending: ProfileEstimate         # 소비 파라미터(월경비·생활비·소득변동·평균입금 + 블렌드)
    signals: CareerSignals            # 커리어 추세 신호 (한 번만 계산)
    streams: IncomeStreams            # 소득 스트림 분해 (한 번만 계산)
    gap: IncomeGap | None             # 다음 수입까지 예상 간격 (income 이력 없으면 None)
    factsheet: tuple[Fact, ...]       # 팩트 12종 (한 번만 빌드)
    gig: GigProfile                   # 긱워커 소득 프로필 (facts·signals·streams 합성)
    career: CareerVerification        # 커리어 검증 점수·단계·상품 한도(결정론)
    persona_axes: dict | None         # 금액 판단에 사용 가능한 최신 심리 4축(없거나 stale이면 None)
    persona_staleness: dict | None    # 판독 스냅샷 신선도 (판독 없으면 None — 다운스트림 경고용)
    buffer_bias: float                # 조정 성향(행동) — 버퍼를 늘려온 중앙값
    has_confirmed_incoming: bool      # 확정 예정 수입(예정 이벤트 or 미결 잔금)이 있는가

    @property
    def gig_archetype(self) -> str:
        """배분 시트·마이 화면이 앞세우는 긱 정체성 한 줄."""
        return self.gig.archetype

    def allocation_context(self) -> AllocationContext:
        """배분 엔진용 긱 컨텍스트 — 정책 override는 호출자가 얹는다 (여기는 순수 산출).

        bank_flow.context_from_store와 동일한 값을 상류 재계산 없이 만든다.
        """
        return AllocationContext(
            expected_gap_days=self.gap.median_gap_days if self.gap else None,
            early_decline=self.signals.career_trend <= forecast.EARLY_DECLINE_THRESHOLD,
            single_source_dependence=self.gig.is_single_source,   # 긱 구조 → 버퍼 쿠션
            buffer_bias=self.buffer_bias,
        )


def build_user_profile(persona: str | None = None) -> UserProfile:
    """원장을 한 번만 읽어 프로필 전 조각을 합성한다 (순수 읽기, 상태 변경 없음).

    공유 상류(팩트·커리어 신호·스트림)를 각 1회만 계산해 gig·배분·추천이 같은 값을 쓰게 한다.
    미확정 라벨(needs_review)은 어떤 통계에도 못 들어간다 — 확인 후에만 반영(원칙 그대로).
    """
    all_txns = db.list_txns()
    allocations = db.list_allocations()
    events = db.list_events()
    expected_events = db.list_expected_events()
    snapshot = db.latest_snapshot()
    career = career_verification.latest(events)
    staleness = facts_svc.snapshot_staleness(snapshot, len(all_txns))
    # 돈과 상품을 결정하는 소비자에는 신선도가 확인된 축만 공급한다. 오래됐거나 판정할 수
    # 없는 스냅샷은 /profile/persona 화면에는 남지만, 다음 판독 전까지 구조 기반 폴백으로 간다.
    effective_axes = (
        snapshot["axes"]
        if snapshot and snapshot.get("axes") and staleness and staleness.get("stale") is False
        else None
    )

    income_txns = [
        t for t in all_txns
        if t["kind"] == "income" and t["direction"] == "in" and not t["needs_review"]
    ]
    as_of = max((t["date"] for t in all_txns), default=None)
    months = len({t["date"][:7] for t in all_txns})

    # ── 공유 상류 계산 — 각 1회 (이전엔 소비자마다 재계산) ──
    factsheet = facts_svc.build_factsheet(all_txns, allocations, events)
    signals = forecast.career_signals(income_txns)
    streams = income_streams.decompose(
        income_txns, months_observed=float(months), as_of=as_of,
    )
    gap = forecast.next_income_window([t["date"] for t in income_txns]) if income_txns else None

    spend_txns = [
        Txn(date=t["date"], amount=t["amount"], kind=t["kind"])  # type: ignore[arg-type]
        for t in all_txns
        if t["kind"] in ("income", "expense", "living") and not t["needs_review"]
    ]
    spending = spending_profile.estimate(spend_txns, persona or career.job or DEFAULT_PERSONA)
    gig = gig_profile.build_gig_profile(factsheet, signals, streams)

    future_events = [e for e in expected_events if not as_of or e["date"] > as_of]
    has_incoming = bool(future_events) or bool(streams.pending_settlements)

    return UserProfile(
        as_of=as_of,
        months_observed=months,
        income_dates=tuple(t["date"] for t in income_txns),
        spending=spending,
        signals=signals,
        streams=streams,
        gap=gap,
        factsheet=tuple(factsheet),
        gig=gig,
        career=career,
        persona_axes=effective_axes,
        persona_staleness=staleness,
        buffer_bias=_buffer_bias(allocations),
        has_confirmed_incoming=has_incoming,
    )
