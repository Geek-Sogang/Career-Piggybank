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

from app.engines.classifier import Classification, TxnInput, classify
from app.agents.classifier_llm import classify_with_fallback

GOLDEN_PATH = Path(__file__).parent / "golden_set.json"


def load_cases() -> list[dict]:
    return json.loads(GOLDEN_PATH.read_text())["cases"]


def evaluate(use_llm: bool, learned: dict[str, str] | None = None) -> dict:
    """learned가 있으면 태그 학습 사전(캐스케이드 0층)을 시뮬레이션 — '재등장' 커버리지 측정.

    가정: 리뷰로 넘어간 거래를 사용자가 정답으로 태그했고, 같은 상대가 다시 입금한다.
    (긱워커의 발주처는 바뀌지만 정산 채널·단골 상대는 반복된다 — 사전이 그걸 먹는다.)
    """
    cases = load_cases()
    fn = classify_with_fallback if use_llm else classify
    auto_total = auto_correct = review_ok = review_bad = 0
    wrong: list[str] = []
    reviewed: dict[str, str] = {}  # 이번 패스에서 리뷰로 간 것 → 다음 패스의 학습 사전

    started = time.time()
    for case in cases:
        txn = TxnInput(
            date=case["date"], amount=case["amount"], direction=case["direction"],
            counterparty=case["counterparty"], memo=case.get("memo", ""),
        )
        cp = case["counterparty"].strip()
        if learned is not None and cp in learned:
            # 0층 사전 히트 — bank_flow.classify_cascade와 동일한 동작 (conf 0.98, auto)
            result = Classification(kind=learned[cp], subtype=None, confidence=0.98,  # type: ignore[arg-type]
                                    needs_review=False, signals=["수기 태그 학습"])
        else:
            result = fn(txn)
        if result.needs_review:
            reviewed[cp] = case["expected_kind"]
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

    mode = "룰+LLM" if use_llm else "룰만"
    if learned is not None:
        mode += " · 태그 학습 후 재등장"
    return {
        "mode": mode,
        "total": len(cases),
        "auto_total": auto_total,
        "auto_accuracy": auto_correct / auto_total if auto_total else 0.0,
        "coverage": auto_total / len(cases),
        "review_ok": review_ok,
        "review_bad": review_bad,
        "wrong": wrong,
        "reviewed": reviewed,
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
    parser.add_argument("--learned", action="store_true",
                        help="2회차: 리뷰 건을 사용자가 태그했다고 가정하고 재등장 커버리지 측정")
    args = parser.parse_args()

    first = evaluate(use_llm=False)
    report(first)
    if args.llm:
        first = evaluate(use_llm=True)
        report(first)
    if args.learned:
        # 1회차에서 리뷰로 간 상대를 전부 태그했다고 가정 → 같은 거래 재등장 시
        report(evaluate(use_llm=args.llm, learned=first["reviewed"]))
