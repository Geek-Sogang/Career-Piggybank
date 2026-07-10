"""학습 배분 정책 — 버퍼 안전 수준(분위수)을 사용자 반응으로 배우는 온라인 학습 엔진.

LLM이 아니다 — Beta-Thompson 사후분포(산수)라서 services/에 산다. 배우는 건 하나뿐:
"이 사람은 수입 공백의 어느 분위수까지 대비하고 싶어 하는가" (안전 수준 취향).

버퍼 목표의 구조를 뒤집는다:
- 값은 측정에서 — 목표 개월 수 = 내 수입 공백 분포의 분위수 ÷ 30. "왜 4?"가 없다
  (기존 공식 1+4×CV의 BUFFER_CV_SLOPE 같은 자유 계수가 이 경로엔 없다).
- 선택은 학습에서 — 어느 분위수(P60/P75/P90)를 겨냥할지가 유일한 취향 문제고,
  그 취향을 사용자 반응(승인/조정/거절)의 사후분포가 배운다.
- 보상은 방향 인식(credits_for) — 버퍼를 위로 밀면 위쪽 분위수 arm에, 아래로 밀면
  아래쪽 arm에 크레딧을 준다. 버퍼 편집의 '방향'이 곧 원하는 안전 수준이고 그게 arm이
  정하는 결정변수라, 보상이 arm의 실제 판단과 연결된다(크기는 수용/조정 게이트로만).

informed prior — 학습은 보정이지 출발점이 아니다:
- 사전분포는 페르소나(④ 프로필 판독의 위험감내 축)가 정한다. 관측 0건이면 페르소나
  정책 그대로 행동하고, 반응이 쌓이면 개인 사후분포로 갈라진다.
- 사전분포는 DB에 저장하지 않는다 — 매 선택 시 최신 페르소나에서 계산하고, DB에는
  관측(보상)만 쌓는다. 페르소나가 갱신되면 prior도 따라온다.

수축(콜드스타트) — 킬테스트 KT-2의 교훈 그대로:
- 공백 관측이 SHRINK_FULL_GAPS 미만이면 분위수가 퇴화하므로 기존 공식을 사전분포로
  강등해 혼합한다. 공식은 소멸하는 게 아니라 관측에 밀려난다.

불가침: 세금·경비·합계 보존·사람 승인 게이트에는 손이 닿지 않는다 — 정책이 고르는 건
버퍼 '목표'(안전 수준)뿐이고, 배분 원화는 여전히 폭포수 잔여 계산이 정한다.

탐색(Thompson 샘플링)은 기본 꺼짐(사후 평균 argmax·동률은 안전한 쪽) —
오프라인 백테스트에서 고정 정책을 이기면 켠다(백테스트 게이트).
"""
from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import date

from app.core.config import settings
from app.engines.allocator import BUFFER_MONTHS_MAX, BUFFER_MONTHS_MIN, buffer_target_months
from app.store import db

ARMS: tuple[float, ...] = (0.60, 0.75, 0.90)   # 안전 분위수 메뉴 — 표준 분위수 (자유 계수 아님)
ARM_IDS: dict[float, str] = {0.60: "P60", 0.75: "P75", 0.90: "P90"}
NEUTRAL_QUANTILE = 0.75    # 페르소나 없음 → 가운데 arm 중심의 중립 prior (정의)
PRIOR_STRENGTH = 2.0       # informed prior 유사관측 수 — 실제 반응 2~3건이면 선택이 바뀌는 강도 (정의)
PRIOR_WIDTH = 0.30         # prior 삼각가중 반경 — 인접 arm(거리 0.15)은 절반 가중 (정의)
SHRINK_FULL_GAPS = 8       # 분위수 100% 반영에 필요한 공백 관측 수 — TREND_BLEND_MONTHS와 같은 수축 문법
CONTEXT_KEY = "global"     # 단일 사용자 데모 — 컬럼은 미래 컨텍스트 분화용


@dataclass(frozen=True)
class PolicyDecision:
    """선택 1회의 전체 기록 — 배분 meta에 그대로 실려 감사·보상 귀속의 기준점이 된다."""

    arm_id: str                # 선택된 안전 수준 ("P75")
    quantile: float            # 그 arm의 분위수 (0.75)
    months: float              # 번역된 버퍼 목표 개월 수 (allocator에 override로 전달)
    gap_days_at_q: float | None  # 분위수 지점의 공백 일수 (관측 없으면 None)
    observed_gaps: int         # 공백 관측 수 (수축 가중의 근거)
    shrink_weight: float       # 분위수 반영 비율 (0=공식 그대로, 1=분위수 그대로)
    prior_source: str          # "persona:risk_tolerance=0.3" / "neutral"
    posterior: dict[str, dict]  # arm별 {prior_a, prior_b, obs_a, obs_b, pulls, mean} — 모든 가정 노출
    exploration: bool          # 이번 선택이 탐색 샘플링이었나 (기본 False)
    reason: str                # 사용자에게 보일 근거 한 줄

    def as_dict(self) -> dict:
        return {
            "arm_id": self.arm_id, "quantile": self.quantile, "months": self.months,
            "gap_days_at_q": self.gap_days_at_q, "observed_gaps": self.observed_gaps,
            "shrink_weight": self.shrink_weight, "prior_source": self.prior_source,
            "posterior": self.posterior, "exploration": self.exploration,
            "reason": self.reason,
        }


def _quantile(sorted_vals: list[float], q: float) -> float:
    if not sorted_vals:
        return 0.0
    idx = q * (len(sorted_vals) - 1)
    lo, hi = int(idx), min(int(idx) + 1, len(sorted_vals) - 1)
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (idx - lo)


def _gaps(income_dates: list[str]) -> list[float]:
    """수입 공백 분포 — 같은 날 복수 입금(플랫폼 2곳 동시 정산 등)은 날짜 1개로 접는다.

    0일 간격은 '공백' 관측이 아니다 — 분위수를 아래로 오염시키고 수축 가중(n)까지
    부풀려, 변동이 커지는데 버퍼 목표가 얇아지는 역방향 출력을 만들 수 있다.
    """
    days = sorted({date.fromisoformat(d) for d in income_dates})
    return sorted(float((b - a).days) for a, b in zip(days, days[1:]))


def _implied_quantile(axes: dict | None) -> tuple[float, str]:
    """페르소나 → 함의된 안전 분위수. 위험감내가 낮을수록 높은 분위수(두꺼운 버퍼)를 함의.

    축이 없거나 폴백(중립 0.5 지어내기 방지)이면 중립 — 가운데 arm 중심.
    """
    if not axes:
        return NEUTRAL_QUANTILE, "neutral"
    risk = axes.get("risk_tolerance")
    if not isinstance(risk, dict) or risk.get("fallback") or not isinstance(risk.get("value"), (int, float)):
        return NEUTRAL_QUANTILE, "neutral"
    value = float(risk["value"])
    safety = 1.0 - value                       # 안전 선호 = 위험감내의 반대
    lo, hi = min(ARMS), max(ARMS)
    implied = lo + (hi - lo) * (safety - 0.1) / 0.8   # 메뉴 극단(0.1~0.9) → arm 극단 매핑
    return min(hi, max(lo, implied)), f"persona:risk_tolerance={value}"


def _prior(arm_q: float, implied_q: float) -> tuple[float, float]:
    """arm의 informed prior — 함의 분위수에 가까울수록 성공 유사관측을 더 받는다."""
    w = max(0.0, 1.0 - abs(arm_q - implied_q) / PRIOR_WIDTH)
    return 1.0 + PRIOR_STRENGTH * w, 1.0 + PRIOR_STRENGTH * (1.0 - w)


def _persona_note(axes: dict | None) -> str:
    """페르소나 근거 한 줄 — 축값 + 판독이 실제 인용한 팩트(접지)를 결정론 템플릿으로.

    '성향 프로필이 출발점'이라는 추상어 대신, 어느 성향이 왜 그렇게 읽혔는지까지 말한다.
    근거 팩트는 프로필 판독(④)이 접지 게이트를 통과시킨 evidence 그대로 — 지어내지 않는다.
    """
    risk = (axes or {}).get("risk_tolerance") or {}
    value = risk.get("value")
    if not isinstance(value, (int, float)) or risk.get("fallback"):
        return ""
    if value <= 0.3:
        stance = "안전을 중시하는 성향"
    elif value >= 0.7:
        stance = "공격적 운용을 감수하는 성향"
    else:
        stance = "중간 성향"
    note = f"{stance}(위험감내 {value})이 출발점"
    evidence = risk.get("evidence") or []
    if "F12" in evidence:
        note += " — 배분에서 버퍼를 직접 조정해 오신 이력이 근거예요"
    elif "F09" in evidence:
        note += " — 저축 여력(쿠션) 이력이 근거예요"
    return note


def choose(income_dates: list[str], axes: dict | None, income_cv: float) -> PolicyDecision:
    """안전 수준 선택 + 버퍼 목표 개월 번역 — 순수 읽기 (상태 변경은 update()가, 승인 후에만).

    수축(콜드스타트)의 사전분포는 기존 공식(buffer_target_months, 1+4×CV)이다 — 공식의
    유일한 소유자는 allocator이고, 그 '언제 prior로 쓸지'는 여기(정책)가 정한다. 호출자는
    income_cv만 넘긴다 — 공식을 아는 곳을 하나로 좁혀 버퍼 두께의 단일 소유를 지킨다.
    """
    fallback_months = buffer_target_months(income_cv)
    gaps = _gaps(income_dates)
    n = len(gaps)
    implied, prior_source = _implied_quantile(axes)
    observed = db.policy_state(CONTEXT_KEY)

    posterior: dict[str, dict] = {}
    means: dict[float, float] = {}
    for q in ARMS:
        arm_id = ARM_IDS[q]
        pa, pb = _prior(q, implied)
        obs = observed.get(arm_id, {"alpha": 0.0, "beta": 0.0, "pulls": 0})
        a, b = pa + obs["alpha"], pb + obs["beta"]
        # 9자리 반올림 — 부동소수 dust가 수학적 동률을 깨면 '동률은 안전한 쪽' 규칙이
        # 무음으로 위반된다 (예: |0.6−0.75|/0.3 = 0.5000…01 → prior 비대칭)
        means[q] = round(a / (a + b), 9)
        posterior[arm_id] = {
            "prior_a": round(pa, 3), "prior_b": round(pb, 3),
            "obs_a": round(obs["alpha"], 3), "obs_b": round(obs["beta"], 3),
            "pulls": obs["pulls"], "mean": round(means[q], 4),
        }

    exploration = bool(settings.policy_exploration)
    if exploration:
        # 탐색 — 시드는 총 pulls로 고정(재현 가능한 샘플링). 백테스트 게이트 통과 전엔 켜지 않는다.
        total_pulls = sum(p["pulls"] for p in posterior.values())
        rng = random.Random(total_pulls)
        samples = {
            q: rng.betavariate(posterior[ARM_IDS[q]]["prior_a"] + posterior[ARM_IDS[q]]["obs_a"],
                               posterior[ARM_IDS[q]]["prior_b"] + posterior[ARM_IDS[q]]["obs_b"])
            for q in ARMS
        }
        chosen_q = max(ARMS, key=lambda q: (samples[q], q))
    else:
        chosen_q = max(ARMS, key=lambda q: (means[q], q))   # 동률은 안전한 쪽(높은 분위수)

    arm_id = ARM_IDS[chosen_q]

    # 번역 — 분위수 지점의 공백 일수 ÷ 30 = 그 가뭄을 버티는 개월 수. 수축 혼합 후 클램프.
    shrink = min(1.0, n / SHRINK_FULL_GAPS)
    gap_at_q: float | None = None
    if n > 0:
        gap_at_q = _quantile(gaps, chosen_q)
        months_q = gap_at_q / 30.0
        months = shrink * months_q + (1.0 - shrink) * fallback_months
    else:
        months = fallback_months
    months = round(min(BUFFER_MONTHS_MAX, max(BUFFER_MONTHS_MIN, months)), 2)

    if n > 0 and gap_at_q is not None:
        reason = (
            f"여윳돈 안전 수준 {arm_id}: 내 수입 공백 {n}건의 {arm_id} 지점(약 {gap_at_q:.0f}일)을 "
            f"버티는 두께로 잡았어요"
        )
        if shrink < 1.0:
            reason += f" (관측 {n}건 — 측정 {shrink:.0%} · 기존 공식 {1 - shrink:.0%} 혼합)"
        if prior_source != "neutral":
            persona = _persona_note(axes)
            reason += f". {persona}, 승인·조정 반응이 보정해요" if persona else \
                " — 성향 프로필이 출발점, 승인·조정 반응이 보정해요"
    else:
        reason = f"수입 공백 관측이 아직 없어 안전 수준 {arm_id}는 기록만 하고, 여윳돈 목표는 기존 공식을 따라요"

    return PolicyDecision(
        arm_id=arm_id, quantile=chosen_q, months=months, gap_days_at_q=gap_at_q,
        observed_gaps=n, shrink_weight=round(shrink, 3), prior_source=prior_source,
        posterior=posterior, exploration=exploration, reason=reason,
    )


ADJUST_MEANINGFUL = 0.05   # 버퍼 편집이 입금액의 이 비율 미만이면 '안전 수준은 수용'으로 본다


def _neighbor(arm_id: str, direction: int) -> str:
    """방향으로 한 칸 이웃 arm — +1=더 안전(높은 분위수)·-1=덜 안전. 극단이면 자기 자신."""
    order = [ARM_IDS[q] for q in ARMS]     # ["P60","P75","P90"] — 오름차순 = 안전 강화
    i = order.index(arm_id)
    return order[min(len(order) - 1, max(0, i + direction))]


def credits_for(
    action: str, proposed: dict, final: dict | None, deposit: float, chosen_arm: str,
) -> list[tuple[str, float]]:
    """결정 → (arm, 보상[0,1]) 목록. **방향 인식** — 버퍼를 어느 쪽으로 밀었는지가 곧
    사용자가 원하는 안전 수준이고, 그게 바로 arm이 정하는 결정변수다.

    - confirm = 고른 arm 성공(1) · reject = 고른 arm 실패(0)
    - adjust 버퍼 편집이 미미(입금액 5% 미만) = 안전 수준은 수용 → 고른 arm 성공(1)
    - adjust 버퍼↑(더 안전 원함) = 위쪽 이웃 arm 성공 + 고른 arm 실패 (한 칸 위로 수렴)
    - adjust 버퍼↓(덜 안전 원함) = 아래쪽 이웃 arm 성공 + 고른 arm 실패
    - 이미 극단 arm인데 그 방향으로 더 밀었다 = 그 arm이 맞다는 강화 → 성공(1)

    리뷰 발견 교정: 이전 `abs(Δ)÷입금액` 보상은 방향맹이라 "버퍼를 크게 늘림(더 안전
    원함) → 낮은 보상 → 고른(안전) arm 사후평균 하락 → 다음엔 더 공격적 arm"의 의도
    역전을 낳았다. 이제 방향이 신호이고 크기는 게이트(미미한 편집은 수용)로만 쓴다 —
    입금액 정규화가 보상값에 안 들어가므로 같은 습관이 입금 크기에 따라 다르게 학습되던
    문제(정규화 불일치)도 함께 사라진다. 무영향 무보상 가드는 라우트가 유지한다.
    """
    if action == "confirm":
        return [(chosen_arm, 1.0)]
    if action == "reject":
        return [(chosen_arm, 0.0)]
    if action != "adjust" or final is None or deposit <= 0:
        return []
    delta = float(final.get("buffer", 0)) - float(proposed.get("buffer", 0))
    if abs(delta) < ADJUST_MEANINGFUL * deposit:
        return [(chosen_arm, 1.0)]        # 버퍼는 사실상 그대로 — 안전 수준 수용
    neighbor = _neighbor(chosen_arm, 1 if delta > 0 else -1)
    if neighbor == chosen_arm:
        return [(chosen_arm, 1.0)]        # 극단 arm에서 그 방향으로 더 밀림 = 강화
    return [(neighbor, 1.0), (chosen_arm, 0.0)]


def update(arm_id: str, reward: float) -> None:
    """관측 반영 — 사람의 결정이 있어야만 불린다 (제안 생성은 상태를 바꾸지 않는다)."""
    db.policy_reward(CONTEXT_KEY, arm_id, max(0.0, min(1.0, reward)))
