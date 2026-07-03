"""골든셋 CI 게이트 — 룰 경로 회귀 방지 (LLM 불필요, CI에서 항상 실행).

원칙: 자동 반영(needs_review=False)이 틀리는 건 조용한 오류 = 신뢰 파괴.
룰을 고치다가 자동결정 오답이 생기면 여기서 막힌다.
"""
from __future__ import annotations

from evals.run_eval import evaluate, load_cases

MIN_COVERAGE = 0.5  # 골든셋의 절반 이상은 룰만으로 자동결정돼야 한다


def test_golden_set_is_labeled() -> None:
    cases = load_cases()
    assert len(cases) >= 30
    assert all(c["expected_kind"] in {"income", "expense", "living"} for c in cases)


def test_rules_auto_decisions_are_never_wrong() -> None:
    """자동결정 정확도 100% — 애매하면 review로 넘기는 게 정답, 틀리게 찍는 건 금지."""
    r = evaluate(use_llm=False)
    assert r["auto_accuracy"] == 1.0, r["wrong"]
    assert r["review_bad"] == 0, r["wrong"]


def test_rules_coverage_floor() -> None:
    """룰만으로도 절반 이상 자동결정 — 커버리지가 떨어지면 수기 태그 부담이 급증한다."""
    r = evaluate(use_llm=False)
    assert r["coverage"] >= MIN_COVERAGE, f"coverage {r['coverage']:.1%}"
