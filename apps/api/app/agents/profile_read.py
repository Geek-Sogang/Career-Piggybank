"""④ 프로필 판독 에이전트 — 팩트시트를 성향 축값으로 판독한다 (페르소나가 태어나는 곳).

역할 하나: 팩트를 읽고 축을 판단한다. 측정(facts 엔진)도, 배분(스탠스)도, 실행도 아니다.

실측으로 확정된 프로토콜 (probe3/4 · 킬테스트 KT-1/KT-3):
- **축당 1회 호출** — 4축을 한 번에 물으면 분해가 무너진다 (2.4B 탈락, 7.8B 전용).
- **극성표 먼저** — 판단 전에 팩트별 올림/내림/중립부터. 부호 오류("0%를 충동으로")를
  깨는 유일하게 실증된 장치 (KT-3).
- **값은 메뉴에서만** — temp 0 재현성은 '번호 선택'만 보장한다 (자유 서술은 seed를
  고정해도 흔들림). 메뉴 밖 값은 게이트가 폐기.
- **게이트는 결정론** — 접지(인용 팩트 실존·측정됨)·극성(방향이 정의와 모순 없음)·
  최종값과 근거 방향의 일치는 코드가 검증한다. AI 오류를 잡는 심판이 AI면 순환이다.
- **실패는 중립 폴백** — 게이트를 못 넘은 축은 0.5 + fallback 표기. 지어내지 않는다.

가드레일(문법): 판정만 한다 — 축값은 스냅샷에 기록될 뿐, 어떤 돈도 움직이지 않는다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.config import settings
from app.core import llm
from app.engines.facts import Fact

VALUE_MENU = (0.1, 0.3, 0.5, 0.7, 0.9)   # 번호만 선택 — 재현성의 경계
NEUTRAL = 0.5

_FACT_ID = re.compile(r"^(F\d{2})\b")

# 성향 4축 — 정의의 방향 앵커는 리서치 정박 구성개념(§10)에서 온다
AXES: dict[str, dict[str, str]] = {
    "risk_tolerance": {
        "label": "위험감내",
        "definition": "높을수록 소득 불확실성·집중을 감수하고 공격적 운용을 선호한다. "
                      "0=매우 안전지향, 1=매우 공격적.",
        "hint": "이 축의 핵심 증거는 둘이다. (1) F12=버퍼 조정 방향(행동): 버퍼를 스스로 "
                "늘려온 습관=안전 선호(내림), 줄여온 습관=위험 감내(올림). (2) F09=저축여력(구조): "
                "쿠션을 쌓아둔 사람=안전 여력(내림), 구조적 적자로 쿠션이 없으면=사실상 위험 감내(올림). "
                "소득 변동(F01)·집중도(F02)는 '노출'이지 '성향'이 아니니 이 축 판단의 근거로 쓰지 마라.",
    },
    "time_preference": {
        "label": "시간선호",
        "definition": "높을수록 미래지향(버퍼·저축을 선호), 낮을수록 현재 소비를 선호한다. "
                      "배분 조정 방향(버퍼를 늘리나 지금 쓸 돈을 늘리나)이 강한 신호다.",
    },
    "self_control": {
        "label": "자기통제",
        "definition": "높을수록 소비가 계획적·절제됨. 0=매우 충동적(입금 직후 몰아쓰기, "
                      "가뭄에도 못 줄임), 1=매우 계획적(고른 지출, 가뭄에 줄임).",
    },
    "planning": {
        "label": "계획성",
        "definition": "높을수록 장기 관리 습관이 강하다 — 규칙적 태깅·안정적 지출뿐 아니라 "
                      "긱 커리어 소스를 스스로 연결하는 실제 관리 행동까지 포함. 앱을 자주 "
                      "연 사실(F14)은 제품 참여도라 성향 방향에는 사용하지 않는다. "
                      "0=관리 안 함, 1=철저.",
    },
}

# ── 극성 정의 — 방향은 구성개념의 '정의'라 결정론으로 검증 가능하다 ──
# 값(가중)은 LLM의 몫이지만, 방향(이 팩트가 이 축을 올리나 내리나)은 정의에서 나온다.
# 여기 등재된 (축, 팩트, 조건)에서 LLM이 반대 극성을 쓰면 게이트가 탈락시킨다.
# 등재 안 된 조합은 검증하지 않는다(LLM 자유 판단) — 방어 가능한 정의만 싣는다(v1).

F09_CUSHION = 0.2       # 저축여력 이 이상 = 쿠션 형성(안전) / 0 이하 = 무쿠션(위험 감내)
F09_MIN_N = 3           # F09를 risk 앵커로 쓰려면 관측 최소치 — 콜드스타트 과신 차단
F05_SELF_CONTROL_MIN_F09 = 0.15   # 가뭄에 '못 줄임'을 자기통제↓ 증거로 인정할 최소 저축여력


def _expected_polarity(
    axis: str, fact_id: str, value: float, n: int = 99,
    facts_by_id: dict | None = None,
) -> str | None:
    """정의된 기대 극성 — 'up'/'down'/None(무정의). n=표본 수(소표본 앵커 차단용).

    facts_by_id: 다른 팩트를 참조하는 조건부 극성용(F05의 저축여력 게이트 등).
    """
    if axis == "self_control":
        if fact_id == "F06":   # 입금 후 몰아쓰기
            return "down" if value >= 0.5 else ("up" if value <= 0.2 else None)
        if fact_id == "F05":   # 가뭄달 지출 반응
            if value <= -0.3:
                return "up"    # 가뭄에 크게 줄임 = 높은 자기통제 (여력 무관 — 항상 유효)
            if value >= -0.1:
                # '못 줄임'은 자기통제↓ 증거로 쓰되, 저축 여력(F09)이 있을 때만 —
                # 생계 최저선인 사람은 줄이고 싶어도 줄일 게 없다(유철 피드백, 코드 게이트).
                f09 = (facts_by_id or {}).get("F09")
                f09_val = f09.value if f09 is not None else None
                if isinstance(f09_val, (int, float)) and f09_val >= F05_SELF_CONTROL_MIN_F09:
                    return "down"
                return None    # 저축 여력 부족 → 성향 증거로 인정 안 함
            return None
        if fact_id == "F07":   # 생활비 변동
            return "up" if value <= 0.3 else ("down" if value >= 0.5 else None)
    if axis == "time_preference":
        if fact_id == "F06":
            return "down" if value >= 0.5 else None
        if fact_id == "F12":   # 조정 방향(버퍼)
            return "up" if value > 0 else ("down" if value < 0 else None)
    if axis == "risk_tolerance":
        if fact_id == "F12":   # 행동 신호(1차): 버퍼를 스스로 조정해 온 방향
            if value > 0:
                return "down"   # 버퍼를 늘려온 습관 = 안전 선호
            if value < 0:
                return "up"     # 버퍼를 줄여온 습관 = 위험 감내
            return None
        if fact_id == "F09" and n >= F09_MIN_N:  # 구조 신호(2차): 쿠션 유무 — 소표본이면 앵커 안 함
            if value >= F09_CUSHION:
                return "down"   # 쿠션을 쌓아둔 사람 = 안전 여력·선호
            if value <= 0.0:
                return "up"     # 구조적 적자(무쿠션) = 사실상 위험 감내
            return None
    if axis == "planning":
        if fact_id == "F10":   # 태깅 활동 (앱 안 금융 행동)
            return "up" if value >= 4 else None
        if fact_id == "F07":
            return "up" if value <= 0.3 else ("down" if value >= 0.5 else None)
        if fact_id == "F13":   # 실제 행동(비금융): 커리어 소스 연결 — 3곳↑ 적극 관리
            return "up" if value >= 3 else None
    return None


_POLARITY_ALIASES = {
    "올림": "up", "내림": "down", "중립": "neutral",
    "up": "up", "down": "down", "neutral": "neutral",
}


@dataclass(frozen=True)
class AxisReading:
    """축 하나의 판독 결과 — 판단 + 근거 + 게이트 통과 여부 (감사 로그의 단위)."""

    axis: str
    label: str
    value: float
    evidence: tuple[str, ...]
    reason: str
    polarity: dict[str, str]
    fallback: bool
    gate_failures: tuple[str, ...]
    retried: bool = False   # 교정 재시도 1회로 통과했나 (감사: 첫 응답의 위반은 gate_failures에)

    def as_dict(self) -> dict:
        return {
            "axis": self.axis, "label": self.label, "value": self.value,
            "evidence": list(self.evidence), "reason": self.reason,
            "polarity": self.polarity, "fallback": self.fallback,
            "gate_failures": list(self.gate_failures),
            "retried": self.retried,
        }


def _normalize_evidence(raw: list, measured: dict[str, Fact]) -> tuple[list[str], list[str]]:
    """근거 정규화 — 'F04 (설명…)' 형식 노이즈에서 ID만 추출한다.

    관용은 형식에만: ID가 아예 없는 항목은 조용히 버리고, 추출된 ID가 실측
    팩트가 아니면(지어냄) 그대로 접지 실패다 — 발명 검사는 그대로 세다.
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


def _fallback(axis: str, failures: list[str]) -> AxisReading:
    return AxisReading(
        axis=axis, label=AXES[axis]["label"], value=NEUTRAL,
        evidence=(), reason="게이트 미통과 — 중립 유지 (지어내지 않음)",
        polarity={}, fallback=True, gate_failures=tuple(failures),
    )


SMALL_SAMPLE_N = 2  # 표본 n이 이 이하면 프롬프트가 확신 근거로 쓰지 말라고 명시 경고

# 축별 band 오버라이드 — 같은 팩트라도 축에 따라 '기준점' 언어가 달라야 한다.
# F12의 원 band는 시간선호 프레임("미래지향/현재선호")이라 위험 축에서 부호를 뒤집게 한다
# (골든셋 실측: risk_tolerance 20%의 주원인). 위험 축에는 위험 언어의 band를 준다.
_BAND_OVERRIDE: dict[tuple[str, str], str] = {
    ("risk_tolerance", "F12"): "양수 = 스스로 버퍼를 키운 조정(안전 선호) · 음수 = 버퍼를 줄인 조정(위험 감내)",
}

# 축의 구성개념과 무관한 팩트는 프롬프트와 접지 허용 목록 양쪽에서 제외한다.
# F14는 앱 사용량이라 어느 축에서든 방향 입력으로 쓰면 제품 참여도를 금융 성향으로
# 순환 해석하게 된다. 원장 팩트에는 남겨 V2의 데이터 충실도·신선도 표시에만 사용한다.
_DIRECTION_EXCLUDED_FACTS = frozenset({"F14"})
_AXIS_EXCLUDED_FACTS: dict[str, frozenset[str]] = {}


def _facts_for_axis(facts: list[Fact], axis: str) -> list[Fact]:
    excluded = _DIRECTION_EXCLUDED_FACTS | _AXIS_EXCLUDED_FACTS.get(axis, frozenset())
    return [f for f in facts if f.id not in excluded]


def _sheet_lines(facts: list[Fact], axis: str | None = None) -> str:
    lines = []
    for f in facts:
        if f.value is None:
            continue  # 측정 안 된 사실은 근거가 될 수 없다 — 프롬프트에서도 뺀다
        band = _BAND_OVERRIDE.get((axis, f.id), f.band) if axis else f.band
        warn = " ⚠표본 극소" if f.n <= SMALL_SAMPLE_N else ""
        lines.append(f"{f.id} · {f.label} = {f.display}  (참고: {band}, 표본 n={f.n}{warn})")
    return "\n".join(lines)


def _system_prompt(axis: str) -> str:
    spec = AXES[axis]
    menu = ", ".join(str(v) for v in VALUE_MENU)
    hint_line = f"\n주의: {spec['hint']}\n" if spec.get("hint") else "\n"
    return (
        "너는 긱워커 금융 성향 판독 에이전트다. 아래 팩트시트(원장에서 결정론으로 측정된 "
        f"사실)만 근거로 딱 하나의 축을 판단한다.\n축 정의 — {spec['label']}: {spec['definition']}"
        f"{hint_line}"
        "각 팩트에 붙은 '참고'는 그 숫자가 높은지 낮은지의 기준점이다 — 값을 정해주는 "
        "공식이 아니라 판단 맥락이다. '표본 n'은 그 숫자가 몇 건 관측에서 나왔는지다 — "
        "n이 1~2인('⚠표본 극소') 팩트는 우연일 수 있다. 그런 팩트뿐이면 확신하지 말고 "
        "중립(0.5)을 지켜라 — 근거 없는 확신이 가장 큰 오류다.\n"
        "판단 절차:\n"
        f"① 극성표 — 팩트별로: 이 팩트가 {spec['label']} 값을 높이는 증거면 '올림', "
        "낮추는 증거면 '내림', 무관하면 '중립'. (예: 축 정의에서 1쪽 행동의 증거 = 올림, "
        "0쪽 행동의 증거 = 내림)\n"
        "② 값 선택 — 지배적 신호에 무게를 두어 아래 보기 중에서만 고른다.\n"
        f"value 보기 (반드시 이 다섯 값 중 하나, 다른 값 금지): [{menu}]\n"
        '출력은 JSON만: {"polarity": {"팩트ID": "올림|내림|중립", ...}, '
        '"value": 0.3, "evidence": ["판단에 실제로 쓴 팩트 ID"], "reason": "한 문장"}\n'
        "철칙: evidence에는 팩트시트에 있는 ID만. 근거가 될 팩트가 없으면 "
        'value=0.5, evidence=[].'
    )


def _validate(
    axis: str, out: dict, measured: dict[str, Fact],
) -> tuple[list[str], list[str], float | None, list[str], dict[str, str]]:
    """게이트 3종 검증 — (실패 코드, 교정 메시지, 값, 근거, 극성표).

    교정 메시지는 재시도 프롬프트에 그대로 실린다 — 컴파일러 에러처럼 '무엇이 왜
    틀렸나'를 말하되 답(값)을 정해주지 않는다. 극성 교정만 예외로 정의 방향을 알려주는데,
    극성은 애초에 결정론 '정의'라(값이 아니라) 정답 유출이 아니다.
    """
    failures: list[str] = []
    corrections: list[str] = []
    menu = ", ".join(str(v) for v in VALUE_MENU)

    # 게이트 1 — 값은 메뉴에서만 (번호만 선택)
    raw_value = out.get("value")
    value: float | None = None
    if isinstance(raw_value, (int, float)) and float(raw_value) in VALUE_MENU:
        value = float(raw_value)
    else:
        failures.append(f"menu_violation:{raw_value!r}")
        corrections.append(
            f"value {raw_value!r}는 보기에 없는 값이다 — 반드시 [{menu}] 다섯 값 중 하나만 골라라."
        )

    # 게이트 2 — 접지: 인용 팩트가 실존하고 측정돼 있어야 한다 (형식 노이즈는 정규화)
    raw_evidence = out.get("evidence")
    evidence, invented = _normalize_evidence(
        raw_evidence if isinstance(raw_evidence, list) else [], measured
    )
    if invented:
        failures.append(f"grounding:{','.join(invented)}")
        corrections.append(
            f"evidence의 {', '.join(invented)}는 팩트시트에 없는 ID다 — "
            "위 팩트시트에 실제로 있는 ID만 인용하라."
        )

    # 게이트 3 — 극성: 방향이 정의와 모순되면 탈락 (중립은 가중 판단이라 허용)
    polarity: dict[str, str] = {}
    raw_polarity = out.get("polarity")
    if isinstance(raw_polarity, dict):
        for fid, p in raw_polarity.items():
            norm = _POLARITY_ALIASES.get(str(p).strip())
            if norm is None or fid not in measured:
                continue
            polarity[fid] = norm
            expected = _expected_polarity(
                axis, fid, float(measured[fid].value), measured[fid].n,  # type: ignore[arg-type]
                facts_by_id=measured)
            if expected and norm != "neutral" and norm != expected:
                failures.append(f"polarity:{fid}:{norm}≠{expected}")
                direction = "높이는(올림)" if expected == "up" else "낮추는(내림)"
                corrections.append(
                    f"{fid}({measured[fid].label} = {measured[fid].display})는 이 축 정의상 "
                    f"값을 {direction} 증거다 — 극성표를 정의에 맞춰 다시 판단하라."
                )

    # 게이트 4 — 최종 방향: 실제 인용한 근거의 정의상 방향과 최종값이 정반대면 탈락.
    # 극성표를 각각 맞게 적고도 최종값을 반대로 고르는 오류를 막는다. 상충 신호가 있거나
    # 정의된 방향이 없는 경우는 홀리스틱 가중 판단의 영역이라 건드리지 않는다.
    evidence_directions = {
        expected
        for fid in evidence
        if fid in measured
        for expected in [
            _expected_polarity(
                axis, fid, float(measured[fid].value), measured[fid].n,  # type: ignore[arg-type]
                facts_by_id=measured,
            )
        ]
        if expected is not None
    }
    direction_mismatch = (
        value is not None
        and ((value >= 0.7 and evidence_directions == {"down"})
             or (value <= 0.3 and evidence_directions == {"up"}))
    )
    if direction_mismatch:
        expected_value_direction = "낮은 쪽" if evidence_directions == {"down"} else "높은 쪽"
        failures.append(f"value_direction:{value}")
        corrections.append(
            f"인용한 근거는 정의상 축 값을 {expected_value_direction}으로 가리키는데 "
            f"value={value}를 골라 최종 방향이 반대다 — 극성과 최종값을 일치시켜라."
        )

    return failures, corrections, value, evidence, polarity


def read_axis(axis: str, facts: list[Fact]) -> AxisReading:
    """축 하나 판독 — LLM 판단 + 결정론 게이트 + 교정 재시도 1회. 그래도 실패면 중립 폴백.

    temp 0에서 같은 프롬프트 재호출은 같은 답이라 무의미하다 — 재시도는 게이트가 잡은
    위반을 명시한 '다른 입력'이어야 한다(컴파일러 에러 문법). 1회로 제한: 게이트를 통과할
    때까지 조르는 건 검증이 아니라 유도다. 감사를 위해 첫 응답의 위반은 gate_failures에,
    재시도로 통과했다는 사실은 retried에 남는다.
    """
    axis_facts = _facts_for_axis(facts, axis)
    measured = {f.id: f for f in axis_facts if f.value is not None}
    sheet = _sheet_lines(axis_facts, axis)
    out = llm.chat_json(
        _system_prompt(axis), sheet,
        model=settings.ollama_model_coach,  # 7.8B — 2.4B는 이 태스크에서 실측 탈락
    )
    if not isinstance(out, dict):
        return _fallback(axis, ["llm_unavailable"])

    failures, corrections, value, evidence, polarity = _validate(axis, out, measured)
    retried = False
    if failures:
        # 교정 재시도 — 위반을 명시하고 같은 형식으로 재판단 요청 (1회 한정)
        retry_user = (
            f"{sheet}\n\n[교정 재시도 — 직전 응답이 검증에서 탈락했다]\n"
            + "\n".join(f"· {c}" for c in corrections)
            + "\n위 문제를 고쳐 같은 JSON 형식으로 다시 판단하라."
        )
        out2 = llm.chat_json(_system_prompt(axis), retry_user, model=settings.ollama_model_coach)
        if isinstance(out2, dict):
            failures2, _c2, value2, evidence2, polarity2 = _validate(axis, out2, measured)
            if not failures2:
                # 통과 — 첫 응답의 위반 기록은 남긴다 (무엇이 교정됐는지 감사 가능)
                retried, out = True, out2
                value, evidence, polarity = value2, evidence2, polarity2
            else:
                return _fallback(axis, failures + [f"retry:{f}" for f in failures2])
        else:
            return _fallback(axis, [*failures, "retry:llm_unavailable"])

    return AxisReading(
        axis=axis, label=AXES[axis]["label"], value=float(value),  # type: ignore[arg-type]
        evidence=tuple(evidence),
        reason=str(out.get("reason", "")).strip()[:200],
        polarity=polarity, fallback=False,
        gate_failures=tuple(failures) if retried else (),
        retried=retried,
    )


def read_profile(facts: list[Fact]) -> dict:
    """성향 4축 전체 판독 — 축당 1회(+교정 재시도 최대 1회). 결과는 스냅샷(axes)에 기록."""
    readings = {axis: read_axis(axis, facts) for axis in AXES}
    return {
        "axes": {axis: r.as_dict() for axis, r in readings.items()},
        "fallback_count": sum(1 for r in readings.values() if r.fallback),
        "retry_count": sum(1 for r in readings.values() if r.retried),
        "model_id": settings.ollama_model_coach,
    }
