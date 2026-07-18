# 골든셋 실측 기록

`--llm` 평가는 로컬 Ollama가 필요해 CI에서 돌지 않는다. 발표·문서에 쓰는 수치가
언제 어느 코드에서 나온 것인지 추적하기 위해 실행할 때마다 여기에 append 한다.

재현: `apps/api`에서 `.venv/bin/python -m evals.run_persona_eval --llm`

---

## 2026-07-19 · develop `a7a8d78` · EXAONE 3.5 7.8B Q4_K_M · 639.8s

13 페르소나 · 22 축 라벨.

| 대조군 | 정확도 | 방향오류 | 과신 | 안전기권 |
|---|---|---|---|---|
| 나이브 규칙(단일 팩트) | 90.9% | 1 | 0 | 1 |
| LLM + 게이트 | 63.6% | 0 | 0 | 8 |

**발표 수치 = 63.6% / 방향오류 0.**

오답 내역 (LLM 8건 — 전부 안전기권, 확신 오판 0):

| 페르소나 | 축 | 라벨 | 예측 | 게이트 |
|---|---|---|---|---|
| P01 | self_control | low | neutral(0.5) | `value_direction:0.3` → 재시도 실패 → 폴백 |
| P04 | planning | low | neutral(0.5) | `polarity:F07` + `value_direction:0.7` → 재시도 실패 → 폴백 |
| P05 | risk_tolerance | low | neutral(0.5) | `polarity:F09`·`polarity:F12` → 재시도 실패 → 폴백 |
| P05 | time_preference | high | neutral(0.5) | `menu_violation:0.55` |
| P06 | risk_tolerance | high | neutral(0.5) | 게이트 전부 통과, 값이 라벨과 갈림 |
| P09 | self_control | low | neutral(0.5) | `menu_violation:0.4` |
| P10 | risk_tolerance | low | neutral(0.5) | `polarity:F12` + `value_direction:0.7` → 재시도 실패 → 폴백 |
| P13 | self_control | high | neutral(0.5) | `menu_violation:0.55` |

나이브 오답 2건: P04 planning(안전기권), **P13 self_control(방향오류 — 절제형을 충동형으로 단정)**.

읽는 법: 기권 8건 중 5건은 게이트가 실제로 방향 오독을 잡아 중립으로 되돌린 경우이고
(그중 4건이 F12/F09/F07 극성 오독 — 7.8B의 알려진 잔존 한계), 3건은 메뉴 밖 값
(0.55·0.4)을 뱉어 형식 게이트에 걸린 경우다. **P13이 핵심 대조 사례** — 나이브는
고정비가 입금 직후 빠져나가는 것을 보고 '충동형'이라 확신하고, LLM은 가뭄달 절제
신호와 충돌하자 중립으로 물러선다.

## 이전 측정 (변천)

| 시점 | 수치 | 변경 사유 |
|---|---|---|
| 2026-07-08 초기 | 59.1% | 골든셋 최초 측정 |
| 2026-07-08 | 63.6% | risk_tolerance 강화 (F12 band 축별 오버라이드 + F09 2차 앵커) |
| 2026-07-08 | 68.2% | 게이트 교정 재시도 1회 도입 |
| 2026-07-17 (PR #83) | **63.6%** | F14 전축 방향 근거 제외 + `value_direction` 게이트 추가 — 원시 정확도를 내주고 확신 오판 경로를 닫은 의도된 트레이드오프 |

⚠️ **68.2%를 최신값으로 인용하지 말 것.** F14 제외 이전 값이라 현재 코드로 재측정하면
재현되지 않는다. 방향오류·과신은 전 구간 0으로 유지된다.
