"""페르소나 판독(④ profile_read) 골든셋 평가 — "측정된 AI" 승부수.

일반 규칙(단일 팩트 하드코딩 임계값) 대비 LLM(전체 팩트시트 홀리스틱 판독)이
사람이 설계 의도로 라벨링한 축 방향을 얼마나 더 정확히 맞히는지 측정한다.
적대적 리뷰 발견 ②("LLM 심리축 = 플래시 위험")에 대한 직접 대답.

사용법 (apps/api에서):
    .venv/bin/python -m evals.run_persona_eval          # 나이브 규칙만 (즉시)
    .venv/bin/python -m evals.run_persona_eval --llm    # + 실제 LLM 판독 (Ollama 필요, 수 분)

지표 정의:
- 라벨: 페르소나 설계 의도로 사람이 붙인 축 방향(low/neutral/high) — VALUE_MENU 5값
  (0.1/0.3/0.5/0.7/0.9)을 low(≤0.3)/neutral(0.5)/high(≥0.7) 3버킷으로 묶어 채점한다.
- 나이브 규칙: 축당 팩트 하나만 보는 하드코딩 임계값 — 프로필판독 에이전트가 없다면
  이렇게 짰을 "일반 규칙" 대조군 (게이트 없이 순진하게 단일 신호만 본다).
- LLM: 실제 agents/profile_read.read_axis — 게이트 통과 결과도 실패(중립 폴백)도
  있는 그대로 채점한다. 폴백이 label과 다르면 오답으로 잡힌다 (관대하게 봐주지 않음).
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from app.agents import profile_read
from app.services import facts as facts_svc
from app.services.facts import Fact

GOLDEN_PATH = Path(__file__).parent / "persona_golden_set.json"

BUCKET_LOW = 0.3
BUCKET_HIGH = 0.7


def load_cases() -> list[dict]:
    return json.loads(GOLDEN_PATH.read_text())["cases"]


def _bucket(value: float) -> str:
    if value <= BUCKET_LOW:
        return "low"
    if value >= BUCKET_HIGH:
        return "high"
    return "neutral"


def _fact_map(facts: list[Fact]) -> dict[str, float | None]:
    return {f.id: f.value for f in facts}


def naive_rule(axis: str, fmap: dict[str, float | None]) -> str:
    """단일 팩트 하드코딩 임계값 — 리뷰가 지적한 "일반 규칙"과 동형의 정직한 대조군."""
    if axis == "self_control":
        v = fmap.get("F06")
        if v is None:
            return "neutral"
        return "low" if v >= 0.5 else ("high" if v <= 0.2 else "neutral")
    if axis == "planning":
        v = fmap.get("F10")
        if v is None:
            return "neutral"
        return "high" if v >= 4 else "neutral"
    if axis == "time_preference":
        v = fmap.get("F12")
        if v is None:
            return "neutral"
        return "high" if v > 0 else ("low" if v < 0 else "neutral")
    if axis == "risk_tolerance":
        v = fmap.get("F12")
        if v is None:
            return "neutral"
        return "low" if v > 0 else ("high" if v < 0 else "neutral")
    return "neutral"


def evaluate(use_llm: bool) -> dict:
    cases = load_cases()
    total = 0
    naive_correct = 0
    llm_correct = 0
    wrong: list[str] = []
    started = time.time()

    for case in cases:
        facts = facts_svc.build_factsheet(
            case["ledger"], case.get("allocations", []), case.get("events", [])
        )
        fmap = _fact_map(facts)
        for axis, label in case["labels"].items():
            total += 1
            naive_pred = naive_rule(axis, fmap)
            if naive_pred == label:
                naive_correct += 1
            else:
                wrong.append(f"[나이브 오답] {case['id']} {axis}: 예측 {naive_pred}, 라벨 {label}")

            if use_llm:
                reading = profile_read.read_axis(axis, facts)
                llm_pred = _bucket(reading.value)
                if llm_pred == label:
                    llm_correct += 1
                else:
                    wrong.append(
                        f"[LLM 오답] {case['id']} {axis}: 예측 {llm_pred}({reading.value}), "
                        f"라벨 {label}, fallback={reading.fallback}, "
                        f"gate={list(reading.gate_failures)}"
                    )

    elapsed = time.time() - started
    result: dict = {
        "cases": len(cases),
        "total": total,
        "naive_accuracy": naive_correct / total if total else 0.0,
        "elapsed_s": round(elapsed, 1),
        "wrong": wrong,
    }
    if use_llm:
        result["llm_accuracy"] = llm_correct / total if total else 0.0
    return result


def report(r: dict) -> None:
    print(f"\n=== 페르소나 골든셋 평가 — {r['cases']}건 페르소나 · {r['total']}개 라벨, {r['elapsed_s']}s ===")
    print(f"나이브 규칙(단일 팩트) 정확도 : {r['naive_accuracy']:.1%}")
    if "llm_accuracy" in r:
        print(f"LLM(홀리스틱 판독) 정확도    : {r['llm_accuracy']:.1%}")
    for w in r["wrong"]:
        print("  ✗", w)
    if not r["wrong"]:
        print("  ✓ 오답 없음")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="페르소나 판독 골든셋 평가")
    parser.add_argument("--llm", action="store_true", help="실제 LLM 판독 포함 (Ollama 필요)")
    args = parser.parse_args()
    report(evaluate(use_llm=args.llm))
