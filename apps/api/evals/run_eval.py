"""분류기 골든셋 평가 스크립트.

사용법 (apps/api에서):
    .venv/bin/python -m evals.run_eval          # 룰만 (즉시)
    .venv/bin/python -m evals.run_eval --llm    # 룰 + LLM 폴백 (Ollama 필요, 수 분)

지표 정의:
- 자동결정: needs_review=False로 사람 개입 없이 라벨이 붙은 건
- 자동결정 정확도: 자동결정 중 expected_kind와 일치한 비율 — **이게 100%여야 한다**
  (자동 반영이 틀리는 건 조용한 오류 = 신뢰 파괴. 애매하면 review로 넘기는 게 정답)
- 커버리지: 전체 중 자동결정 비율 (높을수록 사용자 수기 태그 부담 ↓)
- review 처리: allow_review=True 케이스가 review로 가면 '정답'으로 집계
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from app.services.classifier import TxnInput, classify
from app.services.classifier_llm import classify_with_fallback

GOLDEN_PATH = Path(__file__).parent / "golden_set.json"


def load_cases() -> list[dict]:
    return json.loads(GOLDEN_PATH.read_text())["cases"]


def evaluate(use_llm: bool) -> dict:
    cases = load_cases()
    fn = classify_with_fallback if use_llm else classify
    auto_total = auto_correct = review_ok = review_bad = 0
    wrong: list[str] = []

    started = time.time()
    for case in cases:
        txn = TxnInput(
            date=case["date"], amount=case["amount"], direction=case["direction"],
            counterparty=case["counterparty"], memo=case.get("memo", ""),
        )
        result = fn(txn)
        label = f"{case['counterparty']} {case['amount']:,}원({case['direction']})"
        if result.needs_review:
            if case["allow_review"]:
                review_ok += 1
            else:
                review_bad += 1
                wrong.append(f"[불필요 review] {label} — 기대 {case['expected_kind']}")
        else:
            auto_total += 1
            if result.kind == case["expected_kind"]:
                auto_correct += 1
            else:
                wrong.append(
                    f"[자동결정 오답] {label} — 판정 {result.kind}, 기대 {case['expected_kind']}"
                )
    elapsed = time.time() - started

    return {
        "mode": "룰+LLM" if use_llm else "룰만",
        "total": len(cases),
        "auto_total": auto_total,
        "auto_accuracy": auto_correct / auto_total if auto_total else 0.0,
        "coverage": auto_total / len(cases),
        "review_ok": review_ok,
        "review_bad": review_bad,
        "wrong": wrong,
        "elapsed_s": round(elapsed, 1),
    }


def report(r: dict) -> None:
    print(f"\n=== 골든셋 평가 [{r['mode']}] — {r['total']}건, {r['elapsed_s']}s ===")
    print(f"자동결정 정확도 : {r['auto_accuracy']:.1%} ({r['auto_total']}건 중)")
    print(f"커버리지        : {r['coverage']:.1%} (자동결정 비율)")
    print(f"review 처리     : 적절 {r['review_ok']}건 / 불필요 {r['review_bad']}건")
    for w in r["wrong"]:
        print("  ✗", w)
    if not r["wrong"]:
        print("  ✓ 오답 없음")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="분류기 골든셋 평가")
    parser.add_argument("--llm", action="store_true", help="LLM 폴백 포함 (Ollama 필요)")
    args = parser.parse_args()

    report(evaluate(use_llm=False))
    if args.llm:
        report(evaluate(use_llm=True))
