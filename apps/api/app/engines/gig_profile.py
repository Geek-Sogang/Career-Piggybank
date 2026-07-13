"""긱워커 소득 프로필 — 페르소나의 '긱 특화' 층 (전부 결정론, LLM 아님).

기존 심리 4축(위험감내·시간선호·자기통제·계획성)은 일반 개인금융 성향이라 배달라이더든
프리랜서든 뭉개진다. 긱워커다움은 팩트(변동성·소득원 구조·수입 리듬·국면)에 있는데
정작 페르소나로 안 올라온다 — 이 층이 그걸 1급 프로필로 세운다.

"측정된 AI" 서사와 맞물린다: **구조는 측정(여기, 결정론·항상 있음), 성향은 AI(profile_read)**.
그래서 risk_tolerance의 LLM 불안정성을 안 타고, 판독 전에도 항상 보인다.

밴드 임계값은 새로 짓지 않고 팩트의 이미 캘리브레이션된 밴드를 재사용한다(F01: 긱 중간
~0.4·0.7 이상 매우 높음 / F02: 50% 이상 소득 절벽 위험) — '미검증 상수'를 늘리지 않기 위함.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.engines.facts import Fact
from app.engines.forecast import SOFT_DECLINE_START, CareerSignals
from app.engines.income_streams import IncomeStreams

# F01·F02 밴드에서 그대로 가져온 경계 (새 상수 아님 — 팩트 정의와 동기화)
VOL_MID = 0.4        # F01: 긱워커 중간 ~0.4
VOL_HIGH = 0.7       # F01: 0.7 이상 매우 높음
CONCENTRATION_RISK = 0.5   # F02: 50% 이상이면 한 곳 끊길 때 소득 절벽
GROWTH_START = -SOFT_DECLINE_START   # 국면: +0.005 이상 성장 / SOFT_DECLINE_START 이하 감속


@dataclass(frozen=True)
class GigProfile:
    """긱워커 소득 구조 4차원 + 한 줄 유형 — 전부 원장에서 잰 사실."""

    volatility: str        # "안정" / "변동" / "고변동" / "관측 부족"
    volatility_cv: float | None
    concentration: str     # "단일 의존" / "소수 집중" / "다각화" / "관측 부족"
    top_source_share: float | None
    rhythm: str            # "플랫폼 정기형" / "프로젝트 반복형" / "착수금-잔금형" / "다중 스트림(N잡)" / "리듬 형성 중"
    is_multi_gig: bool     # N잡 여부 (성격 다른 소득원 2종 이상)
    phase: str             # "성장기" / "안정기" / "감속 주의"
    archetype: str         # 사용자에게 보일 한 줄 긱워커 유형
    notes: list[str] = field(default_factory=list)

    @property
    def is_single_source(self) -> bool:
        """소득 절벽 위험 — 한 채널이 소득의 절반 이상. 배분이 버퍼 쿠션을 얹는 결정론 게이트.

        임계값은 여기(긱 프로필)가 소유한다 — 소비자는 이 판정을 재계산하지 않고 인용만 한다.
        '관측 부족'은 False(지어내지 않음).
        """
        return self.concentration == "단일 의존"

    def as_dict(self) -> dict:
        return {
            "volatility": self.volatility, "volatility_cv": self.volatility_cv,
            "concentration": self.concentration, "top_source_share": self.top_source_share,
            "rhythm": self.rhythm, "is_multi_gig": self.is_multi_gig,
            "phase": self.phase, "archetype": self.archetype, "notes": self.notes,
        }


def _volatility(cv: float | None) -> tuple[str, str]:
    if cv is None:
        return "관측 부족", ""
    if cv >= VOL_HIGH:
        return "고변동", f"소득 변동계수 {cv:.2f} — 롤러코스터형(직장인의 7배 수준)"
    if cv >= VOL_MID:
        return "변동", f"소득 변동계수 {cv:.2f} — 긱워커 평균대의 출렁임"
    return "안정", f"소득 변동계수 {cv:.2f} — 긱 기준 안정적인 편"


def _concentration(top_share: float | None, sources: int) -> tuple[str, str]:
    if top_share is None:
        return "관측 부족", ""
    if top_share >= CONCENTRATION_RISK:
        return "단일 의존", (
            f"소득의 {top_share:.0%}가 한 곳에서 나와요 — 그 채널이 끊기면 소득 절벽 위험"
        )
    if sources <= 2:
        return "소수 집중", f"소득원 {sources}곳 · 최대 {top_share:.0%} — 아직 좁은 편"
    return "다각화", f"소득원 {sources}곳으로 분산 — 한 곳이 흔들려도 버틸 여지"


def _rhythm(streams: IncomeStreams) -> tuple[str, bool, str]:
    """수입 리듬 분류 + N잡 판정 — 성격 다른 소득원이 2종 이상이면 다중 스트림(N잡)."""
    kinds = sum([
        streams.platform_channels > 0,
        streams.repeat_clients > 0,
        streams.one_off_per_month >= 1.0,
    ])
    has_advance = bool(streams.pending_settlements)
    multi = (streams.platform_channels + streams.repeat_clients) >= 2 and kinds >= 2

    if multi:
        return "다중 스트림(N잡)", True, (
            f"플랫폼 {streams.platform_channels}곳 · 반복 발주처 {streams.repeat_clients}곳 — "
            "성격 다른 소득이 섞여 있어 리듬을 따로 봐야 정확해요"
        )
    if has_advance:
        return "착수금-잔금형", False, (
            f"진행 중 계약 {len(streams.pending_settlements)}건 — 착수금이 오면 잔금이 예정된 미래 수입"
        )
    if streams.platform_channels >= 1 and streams.repeat_clients == 0:
        return "플랫폼 정기형", False, f"플랫폼 정산 {streams.platform_channels}곳 위주 — 준고정 주기"
    if streams.repeat_clients >= 1:
        return "프로젝트 반복형", False, f"반복 발주처 {streams.repeat_clients}곳 — 재수주 리듬"
    return "리듬 형성 중", False, "아직 반복 신호가 적어 리듬을 특정하기 일러요(콜드스타트)"


def _phase(career_trend: float) -> tuple[str, str]:
    if career_trend >= GROWTH_START:
        if career_trend > GROWTH_START:
            return "성장기", f"커리어 신호 {career_trend:+.1%}/년 — 수주·단가가 붙는 추세"
        return "안정기", "커리어 신호 중립 — 수주 흐름이 유지되는 편"
    if career_trend <= SOFT_DECLINE_START:
        return "감속 주의", f"커리어 신호 {career_trend:+.1%}/년 — 수주 간격·발주처·단가가 나빠지는 추세"
    return "안정기", f"커리어 신호 {career_trend:+.1%}/년 — 대체로 유지"


def _archetype(vol: str, conc: str, rhythm: str, phase: str, multi: bool) -> str:
    """가장 도드라지는(actionable) 특징을 앞세운 한 줄 — 긱워커가 자기를 알아보게."""
    if phase == "감속 주의":
        return f"{phase} · {rhythm} — 노후·버퍼를 지금 챙길 국면의 긱워커"
    if vol == "고변동" and conc == "단일 의존":
        return "고변동 · 단일 플랫폼 의존 — 가장 취약한 긱 구조라 버퍼가 생명줄"
    if multi:
        return "다중 스트림(N잡) — 성격 다른 소득을 굴리는 멀티 긱워커"
    if rhythm == "착수금-잔금형":
        return "착수금-잔금 프로젝트형 — 진행 계약이 다음 수입을 예고하는 긱워커"
    if vol == "고변동":
        return "고변동 긱워커 — 큰 대금이 가끔, 세금·가뭄 대비가 핵심"
    if conc == "다각화":
        return "다각화 긱워커 — 소득원을 흩어 리스크를 낮춘 편"
    return f"{vol} · {conc} · {rhythm} 긱워커"


def build_gig_profile(
    facts: list[Fact], signals: CareerSignals, streams: IncomeStreams,
) -> GigProfile:
    """팩트·커리어 신호·스트림 분해 → 긱워커 소득 프로필 (순수 함수, 결정론)."""
    fm = {f.id: f for f in facts}
    cv = fm["F01"].value if "F01" in fm else None
    top_share = fm["F02"].value if "F02" in fm else None
    sources = streams.platform_channels + streams.repeat_clients

    vol, vol_note = _volatility(cv)
    conc, conc_note = _concentration(top_share, sources)
    rhythm, multi, rhythm_note = _rhythm(streams)
    phase, phase_note = _phase(signals.career_trend)

    notes = [n for n in (vol_note, conc_note, rhythm_note, phase_note) if n]
    return GigProfile(
        volatility=vol, volatility_cv=cv,
        concentration=conc, top_source_share=top_share,
        rhythm=rhythm, is_multi_gig=multi,
        phase=phase,
        archetype=_archetype(vol, conc, rhythm, phase, multi),
        notes=notes,
    )
