"""페르소나 골든셋 구조 게이트 — LLM 불필요, CI에서 항상 실행.

라벨 형식·나이브 대조군의 결정론적 동작만 검증한다. LLM 정확도(승부수 수치)는
Ollama가 필요해 로컬 `--llm` 실행으로 별도 확인한다 (evals/run_persona_eval.py).
"""
from __future__ import annotations

from evals.run_persona_eval import evaluate, load_cases

MIN_CASES = 10
VALID_LABELS = {"low", "neutral", "high"}
VALID_AXES = {"risk_tolerance", "time_preference", "self_control", "planning"}


def test_persona_golden_set_is_labeled() -> None:
    cases = load_cases()
    assert len(cases) >= MIN_CASES
    for c in cases:
        assert c["labels"], c["id"]
        for axis, label in c["labels"].items():
            assert axis in VALID_AXES, (c["id"], axis)
            assert label in VALID_LABELS, (c["id"], axis, label)


def test_naive_baseline_runs_deterministically() -> None:
    r1 = evaluate(use_llm=False)
    r2 = evaluate(use_llm=False)
    assert r1["total"] >= MIN_CASES
    assert r1 == r2  # 나이브 규칙은 LLM 없이도 매 실행 동일해야 한다
