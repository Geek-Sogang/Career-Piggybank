"""팩트시트 — 원장·이력을 결정론으로 잰 사실의 목록 (페르소나 엔진의 입력).

원칙:
- **사실은 측정값이다** — "몰아쓰기 74%"에 튜닝 여지가 없다. 자유 계수 0.
- **참고구간(band) 병기** — 값이 높은지 낮은지의 기준점. 실측(probe4)에서 밴드가 없으면
  LLM이 "0%를 충동"으로 읽는 부호 오류가 났고, 밴드를 주니 소멸했다. 밴드는 값을 정하는
  공식이 아니라 판단 맥락(사실 정의 층 — 정의를 숨기지 않고 함께 인쇄한다).
- **정의 병기** — 각 팩트에 측정 정의를 붙여 감사 가능하게 ("이 74%는 어떻게 쟀나").
- **미확정 라벨 제외** — needs_review 거래는 모든 통계에서 제외 (7/4 검증 원칙).
- **O(1) 고정 크기** — 원장이 자라도 팩트시트는 자라지 않는다. 축적은 팩트 수를 늘리는 게
  아니라 값을 정확하게 만든다 (표본↑ → 신뢰↑, n 필드로 노출).

카탈로그 v1 = 12종 (소득 4 · 소비 5 · 행동 3). 지금 데이터로 정직하게 잴 수 있는 것만 —
새 팩트 추가는 골든셋 절제 실험(그 팩트가 축 정확도를 올리는가)을 통과할 때만.

LLM 없음 — 이 파일은 엔진(계산)이다. 판독(팩트→축)은 PR B의 profile_read 에이전트 몫.
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass
from datetime import date, timedelta

FACTSHEET_VER = "v1"

BURST_WINDOW_DAYS = 3       # 입금 후 며칠을 '몰아쓰기 창'으로 보나 (정의)
DROUGHT_RATIO = 0.5         # 가뭄달 = 소득이 중앙값의 이 비율 미만인 달 (정의)
GAP_RISK_DAYS = 45          # 무수입 공백 위험 기준 (밴드)

# 고정비 판정 (유철 피드백) — 정산 다음날 빠지는 월세·구독 자동이체를 '몰아쓰기'로
# 오독하지 않기 위해, 세 규칙을 모두 만족하는 지출처만 고정비로 보고 F06/F05에서 분리한다.
FIXED_MIN_COUNT = 3            # 최소 반복 횟수 (2번으론 주기인지 우연인지 알 수 없음)
FIXED_INTERVAL_LO = 25        # 월 단위 고정비 간격 하한(일)
FIXED_INTERVAL_HI = 35        # 월 단위 고정비 간격 상한(일)
FIXED_INTERVAL_CV_MAX = 0.3   # 주 단위 구독 등 규칙적 지출까지 잡는 간격 변동 상한
FIXED_AMOUNT_RATIO_MAX = 1.3  # 금액 최대/최소 비 (공과금 계절 변동까지 허용)


@dataclass(frozen=True)
class Fact:
    """측정된 사실 1건 — 값 + 기준점 + 정의 + 표본 수."""

    id: str            # "F01"
    label: str         # 한국어 이름
    value: float | None  # 측정값 (None = 관측 부족 — 지어내지 않는다)
    display: str       # 사람이 읽는 형태 ("74%" / "66일")
    band: str          # 참고구간 — 높냐 낮냐의 기준점 (판단 맥락, 공식 아님)
    definition: str    # 측정 정의 — 감사용
    n: int             # 표본 수 — 축적될수록 커진다 (신뢰의 근거)

    def as_dict(self) -> dict:
        return {
            "id": self.id, "label": self.label, "value": self.value,
            "display": self.display, "band": self.band,
            "definition": self.definition, "n": self.n,
        }


def _months_span(dates: list[str]) -> list[str]:
    """첫 거래 달부터 마지막 거래 달까지 달력 월 전부 (빈 달 포함 — 0원 달도 사실이다)."""
    if not dates:
        return []
    first, last = min(d[:7] for d in dates), max(d[:7] for d in dates)
    months = []
    y, m = int(first[:4]), int(first[5:7])
    while f"{y:04d}-{m:02d}" <= last:
        months.append(f"{y:04d}-{m:02d}")
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return months


def _cv(values: list[float]) -> float | None:
    if len(values) < 2:
        return None
    mean = sum(values) / len(values)
    if mean == 0:
        return None
    return statistics.pstdev(values) / mean


def _fixed_payees(livings: list[dict]) -> set[str]:
    """고정비 지출처 판정 — 세 규칙을 모두 만족하는 상대만 (전부 결정론, 유철 피드백).

    ① 같은 지출처 3회 이상 (2번으론 반복인지 우연인지 알 수 없다 — 간격 2개는 있어야)
    ② 간격 중앙값 25~35일(월 단위) 또는 간격 CV < 0.3(주 단위 구독 등 규칙적)
    ③ 금액 최대/최소 ≤ 1.3 (공과금 계절 변동까지 커버)

    품목별 원장을 전제한다 — 정산 다음날 빠지는 월세·구독 자동이체가 '몰아쓰기(F06)'로,
    가뭄에 못 줄인 생계 최저선이 '자기통제 낮음(F05)'으로 오독되는 걸 막는다.
    """
    by_cp: dict[str, list[dict]] = {}
    for t in livings:
        by_cp.setdefault(str(t.get("counterparty", "")).strip(), []).append(t)

    fixed: set[str] = set()
    for cp, items in by_cp.items():
        if not cp or len(items) < FIXED_MIN_COUNT:
            continue
        ds = sorted(date.fromisoformat(t["date"]) for t in items)
        gaps = [float((b - a).days) for a, b in zip(ds, ds[1:]) if (b - a).days > 0]
        if len(gaps) < FIXED_MIN_COUNT - 1:
            continue
        med = statistics.median(gaps)
        mean_gap = statistics.mean(gaps)
        gap_cv = statistics.pstdev(gaps) / mean_gap if mean_gap > 0 else 1.0
        periodic = (FIXED_INTERVAL_LO <= med <= FIXED_INTERVAL_HI) or (gap_cv < FIXED_INTERVAL_CV_MAX)
        amounts = [t["amount"] for t in items]
        stable = (max(amounts) / min(amounts) <= FIXED_AMOUNT_RATIO_MAX) if min(amounts) > 0 else False
        if periodic and stable:
            fixed.add(cp)
    return fixed


def build_factsheet(txns: list[dict], allocations: list[dict], events: list[dict]) -> list[Fact]:
    """원장(txns)·배분 이력·행동 이벤트에서 팩트시트를 만든다 — 전부 결정론.

    미확정(needs_review) 거래는 입력에서 제외한다 — 확신 없으면 어떤 통계에도 반영 금지.
    """
    txns = [t for t in txns if not t.get("needs_review")]
    incomes = [t for t in txns if t["kind"] == "income" and t["direction"] == "in"]
    livings = [t for t in txns if t["kind"] == "living"]
    expenses = [t for t in txns if t["kind"] == "expense"]

    all_dates = [t["date"] for t in txns]
    months = _months_span(all_dates)

    income_by_month = {m: 0.0 for m in months}
    living_by_month = {m: 0.0 for m in months}
    for t in incomes:
        income_by_month[t["date"][:7]] += t["amount"]
    for t in livings:
        living_by_month[t["date"][:7]] += t["amount"]

    facts: list[Fact] = []

    # ── 소득 ──
    inc_values = [income_by_month[m] for m in months]
    cv = _cv(inc_values)
    facts.append(Fact(
        "F01", "월 소득 변동계수 (CV)", None if cv is None else round(cv, 2),
        "관측 부족" if cv is None else f"{cv:.2f}",
        "직장인 ~0.1 · 긱워커 중간 ~0.4 · 0.7 이상 매우 높음",
        "관측 구간 달력 월 전체(빈 달 0원 포함)의 월 소득 표준편차 ÷ 평균",
        len(months),
    ))

    by_source: dict[str, float] = {}
    for t in incomes:
        by_source[t["counterparty"]] = by_source.get(t["counterparty"], 0.0) + t["amount"]
    total_income = sum(by_source.values())
    top_share = (max(by_source.values()) / total_income) if total_income > 0 else None
    facts.append(Fact(
        "F02", "소득원 집중도", None if top_share is None else round(top_share, 2),
        "관측 부족" if top_share is None else
        f"{len(by_source)}곳 · 최대 {top_share:.0%}",
        "50% 이상이면 한 곳이 끊길 때 소득 절벽 위험",
        "소득원별 합계 중 최대 소득원의 비중",
        len(incomes),
    ))

    gaps: list[int] = []
    if len(incomes) >= 2:
        ds = sorted(date.fromisoformat(t["date"]) for t in incomes)
        gaps = [(b - a).days for a, b in zip(ds, ds[1:])]
    facts.append(Fact(
        "F03", "입금 간격 중앙값",
        None if not gaps else float(statistics.median(gaps)),
        "관측 부족" if not gaps else f"{statistics.median(gaps):.0f}일",
        "다음 수입까지 버틸 유동성 기간의 단위",
        "확정 income 입금일 사이 간격(일)의 중앙값",
        len(gaps),
    ))
    facts.append(Fact(
        "F04", "최장 무수입 공백",
        None if not gaps else float(max(gaps)),
        "관측 부족" if not gaps else f"{max(gaps)}일",
        f"{GAP_RISK_DAYS}일 이상이면 위험 신호 — 그 기간을 버틸 버퍼가 필요",
        "확정 income 입금일 사이 간격(일)의 최댓값",
        len(gaps),
    ))

    # ── 소비 ──
    drought_resp = None
    liv_months = [m for m in months if living_by_month[m] > 0]
    if len(liv_months) >= 2 and any(inc_values):
        med_income = statistics.median(inc_values)
        droughts = [m for m in liv_months if income_by_month[m] < DROUGHT_RATIO * med_income]
        normals = [m for m in liv_months if m not in droughts]
        if droughts and normals:
            drought_living = statistics.median(living_by_month[m] for m in droughts)
            normal_living = statistics.median(living_by_month[m] for m in normals)
            if normal_living > 0:
                drought_resp = drought_living / normal_living - 1
    facts.append(Fact(
        "F05", "가뭄달 지출 반응",
        None if drought_resp is None else round(drought_resp, 2),
        "가뭄달 관측 없음" if drought_resp is None else f"{drought_resp:+.0%}",
        "-30% 이상 줄이면 탄력적(잘 줄이는 사람) · -10% 미만이면 경직(못 줄이는 사람)",
        f"소득이 중앙값의 {DROUGHT_RATIO:.0%} 미만인 달의 생활비 중앙값 ÷ 평상달 중앙값 - 1",
        len(liv_months),
    ))

    # 고정비(월세·구독 자동이체)는 몰아쓰기가 아니다 — 변동 지출만으로 F06을 잰다.
    # 단 고정비를 빼면 남는 변동 지출이 없으면(합계 1줄 원장 등) 분리 불가 → 전체로 폴백
    # (품목별 원장이 아니면 기존 동작 유지 — 회귀 없음).
    total_living = sum(t["amount"] for t in livings)   # F09 저축여력률에서 쓰임
    fixed = _fixed_payees(livings)
    variable = [t for t in livings if str(t.get("counterparty", "")).strip() not in fixed]
    total_variable = sum(t["amount"] for t in variable)
    if fixed and total_variable > 0:
        burst_base, base_desc = variable, f"고정비 {len(fixed)}곳 제외 변동 생활비"
    else:
        burst_base, base_desc = livings, "전체 생활비"

    burst = None
    total_base = sum(t["amount"] for t in burst_base)
    if incomes and total_base > 0:
        windows = []
        for t in incomes:
            d0 = date.fromisoformat(t["date"])
            windows.append((d0, d0 + timedelta(days=BURST_WINDOW_DAYS)))
        in_window = sum(
            t["amount"] for t in burst_base
            if any(w0 <= date.fromisoformat(t["date"]) <= w1 for w0, w1 in windows)
        )
        burst = in_window / total_base
    facts.append(Fact(
        "F06", "입금 후 몰아쓰기", None if burst is None else round(burst, 2),
        "관측 부족" if burst is None else f"{burst:.0%}",
        "20% 미만이면 분산 소비(계획적) · 50% 이상이면 강한 몰아쓰기(충동적)",
        f"입금 후 {BURST_WINDOW_DAYS}일 내 {base_desc} 지출 합 ÷ {base_desc} 지출 합 "
        "— 고정비는 성향이 아니라 구조라 뺀다",
        len(burst_base),
    ))

    liv_values = [living_by_month[m] for m in liv_months]
    liv_cv = _cv(liv_values)
    facts.append(Fact(
        "F07", "월 생활비 변동계수", None if liv_cv is None else round(liv_cv, 2),
        "관측 부족" if liv_cv is None else f"{liv_cv:.2f}",
        "0.3 미만이면 안정적 지출",
        "생활비가 있는 달들의 월 생활비 표준편차 ÷ 평균",
        len(liv_months),
    ))

    total_expense = sum(t["amount"] for t in expenses)
    exp_ratio = (total_expense / total_income) if total_income > 0 else None
    facts.append(Fact(
        "F08", "경비 비율", None if exp_ratio is None else round(exp_ratio, 2),
        "관측 부족" if exp_ratio is None else f"{exp_ratio:.0%}",
        "일 유지비의 무게 — 경비 인정만큼 과세표준이 줄어 절세와 직결",
        "확정 경비(expense) 합 ÷ 확정 소득(income) 합",
        len(expenses),
    ))

    surplus = None
    if total_income > 0:
        surplus = (total_income - total_living - total_expense) / total_income
    facts.append(Fact(
        "F09", "저축 여력률", None if surplus is None else round(surplus, 2),
        "관측 부족" if surplus is None else f"{surplus:.0%}",
        "0.2 이상이면 목표 봉투를 굴릴 여유가 있는 편",
        "(소득 − 생활비 − 경비) ÷ 소득 — 관측 구간 전체 합 기준",
        len(txns),
    ))

    # ── 행동 (events 계측 — 없으면 정직하게 '관측 없음') ──
    tag_events = [e for e in events if e["type"] == "txn_tagged"]
    tag_weeks: set[str] = set()
    for e in tag_events:
        d = date.fromisoformat(e["ts"][:10])
        tag_weeks.add(f"{d.isocalendar().year}-W{d.isocalendar().week:02d}")
    facts.append(Fact(
        "F10", "수기 태깅 활동", float(len(tag_events)) if tag_events else None,
        "관측 없음" if not tag_events else f"{len(tag_events)}건 · {len(tag_weeks)}주에 걸침",
        "꾸준할수록 데이터가 또렷해지고 개인화가 정확해진다 (참여·성실 신호)",
        "txn_tagged 이벤트 수와 활동 주 수 (이벤트 로그 계측)",
        len(tag_events),
    ))

    decided = [a for a in allocations if a["status"] in ("confirmed", "adjusted", "rejected")]
    confirm_rate = None
    if decided:
        confirm_rate = sum(1 for a in decided if a["status"] == "confirmed") / len(decided)
    facts.append(Fact(
        "F11", "무수정 승인율", None if confirm_rate is None else round(confirm_rate, 2),
        "결정 이력 없음" if confirm_rate is None else f"{confirm_rate:.0%} ({len(decided)}건 중)",
        "높을수록 제안이 취향에 맞는다 — 시스템 성능 지표이자 행동 신호",
        "결정된 배분 중 무수정 승인(confirmed)의 비율",
        len(decided),
    ))

    buffer_deltas = [
        float(a["final"].get("buffer", 0)) - float(a["proposed"].get("buffer", 0))
        for a in allocations
        if a["status"] == "adjusted" and a["final"]
    ]
    med_delta = statistics.median(buffer_deltas) if buffer_deltas else None
    facts.append(Fact(
        "F12", "조정 방향 (버퍼)", None if med_delta is None else round(med_delta, 2),
        "조정 이력 없음" if med_delta is None else f"버퍼 {med_delta:+,.0f}원 (중앙값)",
        "양수 = 버퍼를 늘려온 습관(미래지향) · 음수 = 지금 쓸 돈을 늘려온 습관(현재선호)",
        "조정된 배분의 (최종 버퍼 − 제안 버퍼) 중앙값",
        len(buffer_deltas),
    ))

    return facts


def factsheet_dict(facts: list[Fact]) -> dict:
    """스냅샷 저장·API 응답용 직렬화."""
    return {
        "version": FACTSHEET_VER,
        "count": len(facts),
        "facts": [f.as_dict() for f in facts],
    }


STALE_NEW_TXNS = 5  # 스냅샷 이후 새 거래가 이만큼 쌓이면 페르소나 재판독을 권한다 (정의)


def snapshot_staleness(snap: dict | None, txn_count_now: int) -> dict | None:
    """페르소나 스냅샷 신선도 — 원장은 최신인데 축은 예전일 수 있다 (다운스트림 경고용).

    스냅샷이 없으면 None(페르소나 자체가 없음). 구버전 스냅샷(원장 크기 기록 없음)은
    stale=None — 판정 불가를 정직하게 표기하고 재판독을 권한다. 판정만 하고
    재판독을 자동 실행하지는 않는다(LLM 호출은 명시적 트리거로만 — 핫패스 보호).
    """
    if snap is None:
        return None
    src = snap.get("source_txn_count")
    if src is None:
        return {"new_txns": None, "stale": None, "threshold": STALE_NEW_TXNS,
                "note": "스냅샷에 원장 크기 기록이 없어 신선도를 판정할 수 없어요 — 재판독을 권해요"}
    new = max(0, txn_count_now - int(src))
    return {"new_txns": new, "stale": new >= STALE_NEW_TXNS, "threshold": STALE_NEW_TXNS}
