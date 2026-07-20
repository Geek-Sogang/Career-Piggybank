// 자동 생성 — 손으로 수정하지 말 것 (scripts로 재생성).
// 라이브 백엔드(seed=조대흠)에서 녹화한 데모 픽스처. Vercel 데모(백엔드 없음)에서
// 화면을 실데이터로 채운다. EXPO_PUBLIC_DEMO=1 빌드에서만 사용.
/* eslint-disable */

const GET: Record<string, unknown> = {
  "/v1/profile/verification": {
    "job": "developer",
    "sources": [
      "github",
      "hometax",
      "kosa",
      "mydata",
      "portfolio"
    ],
    "score": 257,
    "stage": "확정",
    "score_breakdown": {
      "verified_history": 82,
      "connected_sources": 175
    },
    "review_connection": {
      "available": true,
      "label": "검증자료로 심사 연결",
      "basis": "신고소득 또는 협회 경력을 확인해 검증자료를 심사 화면에 연결할 수 있어요"
    },
    "verified": {
      "count": 4,
      "streak_months": 3,
      "span_months": 3,
      "recent": [
        {
          "id": "f0c5af0955f4",
          "date": "2025-05-10",
          "amount": 1200000.0,
          "counterparty": "△△스튜디오",
          "memo": "랜딩 개발"
        },
        {
          "id": "289f72dc9681",
          "date": "2025-05-02",
          "amount": 500000.0,
          "counterparty": "○○커머스",
          "memo": "웹 프론트엔드"
        },
        {
          "id": "793163186ed2",
          "date": "2025-04-12",
          "amount": 950000.0,
          "counterparty": "크몽 정산",
          "memo": "검증된 일감"
        },
        {
          "id": "a04995fbaccf",
          "date": "2025-03-15",
          "amount": 1450000.0,
          "counterparty": "㈜브릿지웍스",
          "memo": "잔금"
        }
      ]
    },
    "piggybank": {
      "xp": 251,
      "work_xp": 120,
      "mission_xp": 130,
      "loop_xp": 0,
      "daily_xp": 1,
      "level": 3,
      "level_title": "정산 새싹",
      "max_level": 10,
      "current_threshold": 180,
      "next_threshold": 280,
      "xp_to_next": 29,
      "progress": 0.71,
      "completed_missions": 6,
      "missions": [
        {
          "id": "connect_github",
          "title": "GitHub 작업 활동 연결",
          "xp": 20,
          "completed": true
        },
        {
          "id": "connect_hometax",
          "title": "홈택스 신고소득 연결",
          "xp": 30,
          "completed": true
        },
        {
          "id": "connect_kosa",
          "title": "KOSA 경력자료 연결",
          "xp": 25,
          "completed": true
        },
        {
          "id": "connect_mydata",
          "title": "마이데이터 소득 흐름 연결",
          "xp": 20,
          "completed": true
        },
        {
          "id": "connect_behance",
          "title": "Behance 포트폴리오 연결",
          "xp": 15,
          "completed": false
        },
        {
          "id": "connect_portfolio",
          "title": "포트폴리오 작업물 등록",
          "xp": 15,
          "completed": true
        },
        {
          "id": "create_goal",
          "title": "첫 목표 봉투 만들기",
          "xp": 20,
          "completed": true
        },
        {
          "id": "tag_income",
          "title": "애매한 입금 직접 확인",
          "xp": 15,
          "completed": false
        },
        {
          "id": "process_allocation",
          "title": "첫 입금 배분 처리",
          "xp": 25,
          "completed": false
        }
      ],
      "daily_missions": [
        {
          "id": "today_transactions",
          "title": "오늘 거래 정리",
          "xp": 30,
          "completed": false,
          "available": true,
          "description": "정산 입금이 내 일감인지 직접 확인해요"
        },
        {
          "id": "career_scrap",
          "title": "오늘의 커리어 조각 저금",
          "xp": 1,
          "completed": true,
          "available": true,
          "description": "아티클·레포·레퍼런스 중 하나를 저장해요"
        },
        {
          "id": "care_piggy",
          "title": "돼지 저금통 돌보기",
          "xp": 0,
          "completed": false,
          "available": true,
          "description": "성장에는 영향 없이 반응만 즐겨요"
        }
      ],
      "phase": {
        "key": "tax_season",
        "label": "세금 시즌",
        "message": "세금 준비율과 놓친 경비를 먼저 확인해요"
      },
      "levels": [
        {
          "level": 1,
          "title": "첫 동전",
          "threshold": 0,
          "reward": "기본 저금통",
          "node_type": "character"
        },
        {
          "level": 2,
          "title": "일감 모으기",
          "threshold": 80,
          "reward": "하나머니 혜택 확인",
          "node_type": "reward"
        },
        {
          "level": 3,
          "title": "정산 새싹",
          "threshold": 180,
          "reward": "새싹 스킨",
          "node_type": "character"
        },
        {
          "level": 4,
          "title": "리듬 수집가",
          "threshold": 280,
          "reward": "리듬 수집가 스킨",
          "node_type": "character"
        },
        {
          "level": 5,
          "title": "든든 저금통",
          "threshold": 500,
          "reward": "저금통 1차 성장",
          "node_type": "character"
        },
        {
          "level": 6,
          "title": "커리어 성장",
          "threshold": 720,
          "reward": "파킹통장 우대 확인",
          "node_type": "reward"
        },
        {
          "level": 7,
          "title": "신뢰 수집가",
          "threshold": 980,
          "reward": "직군 소품",
          "node_type": "character"
        },
        {
          "level": 8,
          "title": "자산 설계자",
          "threshold": 1280,
          "reward": "환율·수수료 혜택 확인",
          "node_type": "reward"
        },
        {
          "level": 9,
          "title": "커리어 자산가",
          "threshold": 1620,
          "reward": "반짝 스킨",
          "node_type": "character"
        },
        {
          "level": 10,
          "title": "프로 긱워커",
          "threshold": 2000,
          "reward": "커리어 마스터 배지",
          "node_type": "character"
        }
      ],
      "reward_is_example": true
    }
  },
  "/v1/profile/v2": {
    "gig_structure": [
      {
        "key": "income_stability",
        "label": "소득 안정성",
        "level": "고변동",
        "detail": "금액 출렁임 직장인의 7배 수준 · 가장 긴 수입 공백 29일",
        "fact_ids": [
          "F01",
          "F03",
          "F04"
        ]
      },
      {
        "key": "income_source_structure",
        "label": "소득원 구조",
        "level": "다각화",
        "detail": "플랫폼 정산이 일정한 주기로 들어와요",
        "fact_ids": [
          "F02"
        ]
      }
    ],
    "financial_response": [
      {
        "key": "safety_fund_strategy",
        "label": "안전자금 운용 방향",
        "level": "균형",
        "decision_status": "confirmed",
        "source_axes": [
          "risk_tolerance"
        ],
        "evidence": {
          "fact_ids": [
            "F04",
            "F09"
          ],
          "sample_size": 5,
          "gate": "passed",
          "fallback_used": false,
          "stale": false
        },
        "basis": "위험감내 0.5 → neutral 버킷 (골든셋 채점과 동일 경계 0.3/0.7)"
      },
      {
        "key": "management_support",
        "label": "권장 관리 강도",
        "level": "자율",
        "decision_status": "confirmed",
        "source_axes": [
          "self_control",
          "planning"
        ],
        "evidence": {
          "fact_ids": [
            "F03",
            "F04",
            "F06",
            "F07",
            "F09",
            "F13",
            "F08"
          ],
          "sample_size": 3,
          "gate": "passed",
          "fallback_used": false,
          "stale": false,
          "data_quality": {
            "career_sources": 5.0,
            "engagement_weeks": 6.0
          }
        },
        "basis": "자기통제 high × 계획성 high → 규칙표 (개입은 관측된 자기관리의 역방향)"
      },
      {
        "key": "goal_pacing",
        "label": "목표별 자금 페이스",
        "level": "미래 우선",
        "decision_status": "confirmed",
        "source_axes": [
          "time_preference"
        ],
        "evidence": {
          "fact_ids": [
            "F01",
            "F02",
            "F04",
            "F06",
            "F08",
            "F09",
            "F13"
          ],
          "sample_size": 3,
          "gate": "passed",
          "fallback_used": false,
          "stale": false
        },
        "basis": "시간선호 0.7 → high 버킷 · 목표 기한과 사용 가능 금액은 제안 시 함께 반영"
      }
    ],
    "management_override": "가이드",
    "effective_management": "가이드"
  },
  "/v1/bank/envelopes": {
    "balances": {
      "tax": 392057.0,
      "expense": 325000.0,
      "spendable": 1150000.0,
      "buffer": 1552498.0
    },
    "month_allocated": {
      "tax": 72057.0,
      "expense": 325000.0,
      "spendable": 1150000.0,
      "buffer": 1452943.0
    },
    "annual_tax_expected": 569250.0,
    "tax_prepared": 392057.0,
    "tax_shortfall": 177193.0
  },
  "/v1/bank/transactions": [
    {
      "id": "7dc17237337e",
      "date": "2025-05-27",
      "amount": 3000000.0,
      "direction": "in",
      "counterparty": "△△플랫폼 정산",
      "memo": "",
      "kind": "income",
      "subtype": "settlement",
      "confidence": 0.9,
      "needs_review": false,
      "signals": [
        "정산 플랫폼 입금: '△△플랫폼 정산'"
      ],
      "verified_career_job": false
    },
    {
      "id": "cb51fa1cfa7c",
      "date": "2025-05-20",
      "amount": 250000.0,
      "direction": "in",
      "counterparty": "토스페이 정산",
      "memo": "",
      "kind": "unknown",
      "subtype": null,
      "confidence": 0.3,
      "needs_review": true,
      "signals": [
        "결정론 신호 없음: 토스페이 정산"
      ],
      "verified_career_job": false
    },
    {
      "id": "0cb02304c5d0",
      "date": "2025-05-18",
      "amount": 18000.0,
      "direction": "out",
      "counterparty": "Figma 구독",
      "memo": "",
      "kind": "expense",
      "subtype": "subscription",
      "confidence": 0.9,
      "needs_review": false,
      "signals": [
        "데모 시드"
      ],
      "verified_career_job": false
    },
    {
      "id": "f0c5af0955f4",
      "date": "2025-05-10",
      "amount": 1200000.0,
      "direction": "in",
      "counterparty": "△△스튜디오",
      "memo": "랜딩 개발",
      "kind": "income",
      "subtype": "settlement",
      "confidence": 0.9,
      "needs_review": false,
      "signals": [
        "데모 시드"
      ],
      "verified_career_job": true
    },
    {
      "id": "289f72dc9681",
      "date": "2025-05-02",
      "amount": 500000.0,
      "direction": "in",
      "counterparty": "○○커머스",
      "memo": "웹 프론트엔드",
      "kind": "income",
      "subtype": "settlement",
      "confidence": 0.9,
      "needs_review": false,
      "signals": [
        "데모 시드"
      ],
      "verified_career_job": true
    },
    {
      "id": "1c3a07dcc8e8",
      "date": "2025-04-19",
      "amount": 1100000.0,
      "direction": "out",
      "counterparty": "생활비 지출 합계",
      "memo": "",
      "kind": "living",
      "subtype": null,
      "confidence": 0.9,
      "needs_review": false,
      "signals": [
        "데모 시드"
      ],
      "verified_career_job": false
    },
    {
      "id": "7dc6072a3a40",
      "date": "2025-04-04",
      "amount": 300000.0,
      "direction": "out",
      "counterparty": "작업실 임대료",
      "memo": "",
      "kind": "expense",
      "subtype": "operating",
      "confidence": 0.9,
      "needs_review": false,
      "signals": [
        "데모 시드"
      ],
      "verified_career_job": false
    },
    {
      "id": "793163186ed2",
      "date": "2025-04-12",
      "amount": 950000.0,
      "direction": "in",
      "counterparty": "크몽 정산",
      "memo": "",
      "kind": "income",
      "subtype": "settlement",
      "confidence": 0.9,
      "needs_review": false,
      "signals": [
        "데모 시드"
      ],
      "verified_career_job": true
    },
    {
      "id": "275410eeb08b",
      "date": "2025-03-21",
      "amount": 1200000.0,
      "direction": "out",
      "counterparty": "생활비 지출 합계",
      "memo": "",
      "kind": "living",
      "subtype": null,
      "confidence": 0.9,
      "needs_review": false,
      "signals": [
        "데모 시드"
      ],
      "verified_career_job": false
    },
    {
      "id": "ffd8c7ddb3f1",
      "date": "2025-03-06",
      "amount": 380000.0,
      "direction": "out",
      "counterparty": "Adobe",
      "memo": "",
      "kind": "expense",
      "subtype": "subscription",
      "confidence": 0.9,
      "needs_review": false,
      "signals": [
        "데모 시드"
      ],
      "verified_career_job": false
    },
    {
      "id": "a04995fbaccf",
      "date": "2025-03-15",
      "amount": 1450000.0,
      "direction": "in",
      "counterparty": "㈜브릿지웍스",
      "memo": "잔금",
      "kind": "income",
      "subtype": "settlement",
      "confidence": 0.9,
      "needs_review": false,
      "signals": [
        "데모 시드"
      ],
      "verified_career_job": true
    },
    {
      "id": "c11b186d4a81",
      "date": "2025-02-20",
      "amount": 1150000.0,
      "direction": "out",
      "counterparty": "생활비 지출 합계",
      "memo": "",
      "kind": "living",
      "subtype": null,
      "confidence": 0.9,
      "needs_review": false,
      "signals": [
        "데모 시드"
      ],
      "verified_career_job": false
    },
    {
      "id": "dee0f5ed0670",
      "date": "2025-02-05",
      "amount": 350000.0,
      "direction": "out",
      "counterparty": "가비아 호스팅",
      "memo": "",
      "kind": "expense",
      "subtype": "operating",
      "confidence": 0.9,
      "needs_review": false,
      "signals": [
        "데모 시드"
      ],
      "verified_career_job": false
    },
    {
      "id": "0b40b7f79ae4",
      "date": "2025-02-14",
      "amount": 800000.0,
      "direction": "in",
      "counterparty": "위시켓",
      "memo": "",
      "kind": "income",
      "subtype": "settlement",
      "confidence": 0.9,
      "needs_review": false,
      "signals": [
        "데모 시드"
      ],
      "verified_career_job": false
    }
  ],
  "/v1/envelopes/goals": [
    {
      "id": "baa9c3e22de7",
      "name": "새 맥북",
      "target_amount": 2400000.0,
      "target_date": "2026-12-31",
      "balance": 0.0,
      "status": "active",
      "source": "user",
      "seq": 1
    }
  ],
  "/v1/forecast": {
    "income_gap": {
      "median_gap_days": 20.0,
      "window_days": [
        8.1,
        31.9
      ],
      "last_income_date": "2025-05-27",
      "expected_next_date": "2025-06-16",
      "window": [
        "2025-06-04",
        "2025-06-27"
      ],
      "observed_deposits": 6,
      "calibration_runs": 3,
      "reasons": [
        "최근 입금 6건의 간격 중앙값 20일 (80% 구간 12~29일)",
        "창 자기보정: 과거로 돌아가 3회 예측해 본 실측 오차 P80 ±12일 — 틀릴수록 넓어지고 맞을수록 좁아져요"
      ]
    },
    "retirement": [
      {
        "scenario": "cons",
        "band_start_year": 2041,
        "band_end_year": 2046,
        "label": "2041 ~ 2046"
      },
      {
        "scenario": "base",
        "band_start_year": 2047,
        "band_end_year": 2052,
        "label": "2047 ~ 2052"
      },
      {
        "scenario": "opt",
        "band_start_year": 2051,
        "band_end_year": 2056,
        "label": "2051 ~ 2056"
      }
    ],
    "career_signals": {
      "gap_ratio": 0.596,
      "client_ratio": 1.0,
      "ticket_ratio": 1.263,
      "career_trend": 0.03,
      "reasons": [
        "수주 간격 28일 → 17일 (좁아지는 중 — 일감 흐름 건강)",
        "독립 발주처 3곳 → 3곳 · 건당 단가 추세 ×1.26",
        "커리어 신호 종합 +3.0%/년 — 연령 곡선보다 우선 반영"
      ]
    },
    "path": {
      "years": [
        2025,
        2026,
        2027,
        2028,
        2029,
        2030,
        2031,
        2032,
        2033,
        2034,
        2035,
        2036,
        2037,
        2038,
        2039,
        2040,
        2041,
        2042,
        2043,
        2044,
        2045,
        2046,
        2047,
        2048,
        2049,
        2050,
        2051,
        2052,
        2053,
        2054,
        2055
      ],
      "base": [
        1200000.0,
        1272000.0,
        1348320.0,
        1429219.2,
        1514972.35,
        1605870.69,
        1702222.93,
        1804356.31,
        1912617.69,
        2027374.75,
        2149017.24,
        2277958.27,
        2414635.77,
        2559513.91,
        2713084.75,
        2496037.97,
        2296354.93,
        2112646.54,
        1943634.81,
        1788144.03,
        1645092.51,
        1513485.1,
        1392406.3,
        1281013.79,
        1178532.69,
        1084250.07,
        997510.07,
        917709.26,
        844292.52,
        776749.12,
        714609.19
      ],
      "lo": [
        958230.0,
        1015723.8,
        1076667.23,
        1141267.26,
        1209743.3,
        1282327.9,
        1359267.57,
        1440823.62,
        1527273.04,
        1618909.42,
        1716043.99,
        1819006.63,
        1928147.03,
        2043835.85,
        2166466.0,
        1993148.72,
        1833696.82,
        1687001.07,
        1552040.99,
        1427877.71,
        1313647.49,
        1208555.69,
        1111871.24,
        1022921.54,
        941087.82,
        865800.79,
        796536.73,
        732813.79,
        674188.69,
        620253.59,
        570633.3
      ],
      "hi": [
        1441770.0,
        1528276.2,
        1619972.77,
        1717171.14,
        1820201.41,
        1929413.49,
        2045178.3,
        2167889.0,
        2297962.34,
        2435840.08,
        2581990.48,
        2736909.91,
        2901124.51,
        3075191.98,
        3259703.5,
        2998927.22,
        2759013.04,
        2538292.0,
        2335228.64,
        2148410.35,
        1976537.52,
        1818414.52,
        1672941.36,
        1539106.05,
        1415977.56,
        1302699.36,
        1198483.41,
        1102604.74,
        1014396.36,
        933244.65,
        858585.08
      ],
      "peak_year": 2039,
      "living_target": 1150000.0
    },
    "streams": {
      "platform_channels": 3,
      "repeat_clients": 0,
      "one_off_per_month": 0.75,
      "candidates": [],
      "pending_settlements": [],
      "stale_settlements": [],
      "composite_next": null,
      "reasons": [
        "소득 물줄기 분해: 플랫폼 3곳 · 반복 발주처 0곳 · 진행 중 계약 0건 · 신규/일회성 월 0.8건",
        "리듬 있는 물줄기가 아직 없음 — 전체 간격 통계로 폴백(콜드스타트)",
        "신규 발주는 원장에 신호가 없어요 — 진행 중인 영업은 코치에게 알려주시면 반영해요"
      ]
    },
    "mc": {
      "runs": 1000,
      "band_start_year": 2049,
      "median_year": 2054,
      "band_end_year": 2058,
      "prob_in_base_band": 0.352
    },
    "funded": {
      "target": 345000000.0,
      "funded_year": 2077,
      "reached": true,
      "annual_surplus0": 0.0,
      "mc_p10": 2044,
      "mc_median": 2053,
      "mc_p90": 2071,
      "years": [
        2025,
        2026,
        2027,
        2028,
        2029,
        2030,
        2031,
        2032,
        2033,
        2034,
        2035,
        2036,
        2037,
        2038,
        2039,
        2040,
        2041,
        2042,
        2043,
        2044,
        2045,
        2046,
        2047,
        2048,
        2049,
        2050,
        2051,
        2052,
        2053,
        2054,
        2055,
        2056,
        2057,
        2058,
        2059,
        2060,
        2061,
        2062,
        2063,
        2064,
        2065,
        2066,
        2067,
        2068,
        2069,
        2070,
        2071,
        2072,
        2073,
        2074,
        2075,
        2076,
        2077,
        2078,
        2079,
        2080
      ],
      "savings_path": [
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        43010.77,
        1151892.52,
        3422496.2,
        6957380.8,
        11866244.53,
        18266382.7,
        26283174.07,
        36050597.18,
        47711778.65,
        61419575.38,
        77337192.61,
        91190335.97,
        103120431.42,
        113256878.9,
        121717993.04,
        128611867.99,
        134037172.37,
        138083880.01,
        142226396.41,
        146493188.3,
        150887983.95,
        155414623.47,
        160077062.18,
        164879374.04,
        169825755.26,
        174920527.92,
        180168143.76,
        185573188.07,
        191140383.71,
        196874595.22,
        202780833.08,
        208864258.07,
        215130185.82,
        221584091.39,
        228231614.13,
        235078562.56,
        242130919.43,
        249394847.02,
        256876692.43,
        264582993.2,
        272520483.0,
        280696097.48,
        289116980.41,
        297790489.82,
        306724204.52,
        315925930.65,
        325403708.57,
        335165819.83,
        345220794.42,
        355577418.26,
        366244740.8
      ],
      "reasons": [
        "은퇴 넘버 345,000,000원 = 연 생활비 13,800,000원 ÷ 안전인출률 4%(4% 룰) — 이만큼 모으면 저축만으로 생활 가능",
        "지금은 세후 소득이 생활비를 넘지 못해 저축 여력이 없어요 — 소득↑ 또는 생활비↓가 먼저"
      ]
    },
    "monthly_income_level": 1200000.0,
    "monthly_living_target": 1150000.0,
    "income_cv": 0.8059,
    "assumptions": {
      "current_age": 28,
      "peak_age": 42,
      "growth_before_peak": 0.02,
      "decline_after_peak": 0.08,
      "personal_trend_annual": 0.01,
      "trend_blend_weight": 0.333,
      "career_trend_annual": 0.03,
      "early_decline": "False",
      "decline_severity": 0.0,
      "gap_ratio": 0.596,
      "client_ratio": 1.0,
      "ticket_ratio": 1.263,
      "band_width": 0.2015,
      "income_cv": 0.8059,
      "monthly_income_level": 1200000.0,
      "method": "긱워커 일감흐름 모델: 커리어 신호(수주간격·발주처·단가) 우선 + Mincer(1974) 연령 prior + 감쇠 외삽(Gardner-McKenzie 1985), 구간 제시(FPP)"
    }
  },
  "/v1/profile/persona": {
    "id": "3ebf07c487ed",
    "ts": "2026-07-17T09:55:04+00:00",
    "trigger": "manual",
    "factsheet": {
      "version": "v1",
      "count": 14,
      "facts": [
        {
          "id": "F01",
          "label": "월 소득 변동계수 (CV)",
          "value": 0.81,
          "display": "0.81",
          "band": "직장인 ~0.1 · 긱워커 중간 ~0.4 · 0.7 이상 매우 높음",
          "definition": "관측 구간 달력 월 전체(빈 달 0원 포함)의 월 소득 표준편차 ÷ 평균",
          "n": 4
        },
        {
          "id": "F02",
          "label": "소득원 집중도",
          "value": 0.38,
          "display": "6곳 · 최대 38%",
          "band": "50% 이상이면 한 곳이 끊길 때 소득 절벽 위험",
          "definition": "소득원별 합계 중 최대 소득원의 비중",
          "n": 6
        },
        {
          "id": "F03",
          "label": "입금 간격 중앙값",
          "value": 20.0,
          "display": "20일",
          "band": "다음 수입까지 버틸 유동성 기간의 단위",
          "definition": "확정 income 입금일 사이 간격(일)의 중앙값",
          "n": 5
        },
        {
          "id": "F04",
          "label": "최장 무수입 공백",
          "value": 29.0,
          "display": "29일",
          "band": "45일 이상이면 위험 신호 — 그 기간을 버틸 버퍼가 필요",
          "definition": "확정 income 입금일 사이 간격(일)의 최댓값",
          "n": 5
        },
        {
          "id": "F05",
          "label": "가뭄달 지출 반응",
          "value": null,
          "display": "가뭄달 관측 없음",
          "band": "-30% 이상 줄이면 탄력적(잘 줄이는 사람) · -10% 미만이면 경직(못 줄이는 사람)",
          "definition": "소득이 중앙값의 50% 미만인 달의 생활비 중앙값 ÷ 평상달 중앙값 - 1",
          "n": 3
        },
        {
          "id": "F06",
          "label": "입금 후 몰아쓰기",
          "value": 0.0,
          "display": "0%",
          "band": "20% 미만이면 분산 소비(계획적) · 50% 이상이면 강한 몰아쓰기(충동적)",
          "definition": "입금 후 3일 내 전체 생활비 지출 합 ÷ 전체 생활비 지출 합 — 고정비는 성향이 아니라 구조라 뺀다",
          "n": 3
        },
        {
          "id": "F07",
          "label": "월 생활비 변동계수",
          "value": 0.04,
          "display": "0.04",
          "band": "0.3 미만이면 안정적 지출",
          "definition": "생활비가 있는 달들의 월 생활비 표준편차 ÷ 평균",
          "n": 3
        },
        {
          "id": "F08",
          "label": "경비 비율",
          "value": 0.13,
          "display": "13%",
          "band": "일 유지비의 무게 — 경비 인정만큼 과세표준이 줄어 절세와 직결",
          "definition": "확정 경비(expense) 합 ÷ 확정 소득(income) 합",
          "n": 4
        },
        {
          "id": "F09",
          "label": "저축 여력률",
          "value": 0.43,
          "display": "43%",
          "band": "0.2 이상이면 목표 봉투를 굴릴 여유가 있는 편",
          "definition": "(소득 − 생활비 − 경비) ÷ 소득 — 관측 구간 전체 합 기준",
          "n": 13
        },
        {
          "id": "F10",
          "label": "수기 태깅 활동",
          "value": null,
          "display": "관측 없음",
          "band": "꾸준할수록 데이터가 또렷해지고 개인화가 정확해진다 (참여·성실 신호)",
          "definition": "txn_tagged 이벤트 수와 활동 주 수 (이벤트 로그 계측)",
          "n": 0
        },
        {
          "id": "F11",
          "label": "무수정 승인율",
          "value": 1.0,
          "display": "100% (1건 중)",
          "band": "높을수록 제안이 취향에 맞는다 — 시스템 성능 지표이자 행동 신호",
          "definition": "결정된 배분 중 무수정 승인(confirmed)의 비율",
          "n": 1
        },
        {
          "id": "F12",
          "label": "조정 방향 (버퍼)",
          "value": null,
          "display": "조정 이력 없음",
          "band": "양수 = 버퍼를 늘려온 습관(미래지향) · 음수 = 지금 쓸 돈을 늘려온 습관(현재선호)",
          "definition": "조정된 배분의 (최종 버퍼 − 제안 버퍼) 중앙값",
          "n": 0
        },
        {
          "id": "F13",
          "label": "커리어 소스 연결",
          "value": 5.0,
          "display": "5곳 연결",
          "band": "실제 행동(비금융): GitHub·홈택스·포트폴리오 등을 스스로 연결 — 3곳↑이면 적극적 커리어 관리",
          "definition": "연결한 커리어 소스(계정)의 distinct 수 — source_connected 이벤트",
          "n": 5
        },
        {
          "id": "F14",
          "label": "앱 참여 리듬",
          "value": 6.0,
          "display": "6주 활동 · 36회 방문",
          "band": "데이터 품질: 여러 주에 걸친 앱 관측이 있으면 행동 판독의 시간 범위가 넓음 (성향 방향에는 미사용)",
          "definition": "app_opened 이벤트가 걸친 서로 다른 주 수 (이벤트 로그 계측)",
          "n": 6
        }
      ]
    },
    "axes": {
      "risk_tolerance": {
        "axis": "risk_tolerance",
        "label": "위험감내",
        "value": 0.5,
        "evidence": [
          "F04",
          "F09"
        ],
        "reason": "F04의 최장 무수입 공백이 높은 수치를 보이고 있어 위험 감내 성향을 증가시키는 요인으로 판단되지만, F09의 저축 여력률 또한 높게 나타나 안전 선호 성향을 반영합니다. F01의 소득 변동계수와 F07의 생활비 변동계수는 높은 수치를 보이지만, 이들 팩트는 위험 감내 성향의 직접적인 증거보다는 노출 수준을 나타내므로 중립으로 판단했습니다. F02, F0",
        "polarity": {
          "F01": "down",
          "F02": "neutral",
          "F03": "neutral",
          "F04": "up",
          "F06": "neutral",
          "F07": "down",
          "F08": "neutral",
          "F09": "down",
          "F11": "neutral",
          "F13": "neutral",
          "F14": "neutral"
        },
        "fallback": false,
        "gate_failures": [],
        "retried": false
      },
      "time_preference": {
        "axis": "time_preference",
        "label": "시간선호",
        "value": 0.7,
        "evidence": [
          "F01",
          "F02",
          "F04",
          "F06",
          "F08",
          "F09",
          "F13"
        ],
        "reason": "월 소득 변동계수와 소득원 집중도가 높아 현재 소비에 대한 불안정성을 나타내며, 최장 무수입 공백 기간과 입금 후 몰아쓰기 비율 또한 현재 소비를 선호하는 경향을 보여줍니다. 그러나 저축 여력률과 생활비 변동계수가 안정적인 측면을 보여주고 커리어 관리와 앱 참여 리듬은 중립적 신호로 판단되어 중간 수준의 시간선호 값인 0.7을 선택했습니다.",
        "polarity": {
          "F01": "down",
          "F02": "down",
          "F03": "up",
          "F04": "down",
          "F06": "down",
          "F07": "up",
          "F08": "up",
          "F09": "up",
          "F11": "neutral",
          "F13": "up",
          "F14": "neutral"
        },
        "fallback": false,
        "gate_failures": [
          "menu_violation:0.6"
        ],
        "retried": true
      },
      "self_control": {
        "axis": "self_control",
        "label": "자기통제",
        "value": 0.7,
        "evidence": [
          "F03",
          "F04",
          "F06",
          "F07",
          "F09",
          "F13"
        ],
        "reason": "월 소득 변동계수와 최장 무수입 공백이 높게 나타나 소비의 불안정성과 충동성이 일부 보이지만, 입금 후 몰아쓰기가 없고 생활비 변동계수가 낮으며 저축 여력률이 높아 계획적인 소비 경향이 강하게 나타나므로 중간에서 높은 자기통제 수준을 반영하였습니다. 주요 팩트들이 자기통제를 높이는 방향으로 작용하고 있으며, 특히 F03, F04, F06, F07, F09,",
        "polarity": {
          "F01": "down",
          "F02": "neutral",
          "F03": "up",
          "F04": "down",
          "F06": "up",
          "F07": "up",
          "F08": "neutral",
          "F09": "up",
          "F11": "neutral",
          "F13": "up",
          "F14": "neutral"
        },
        "fallback": false,
        "gate_failures": [
          "menu_violation:0.6"
        ],
        "retried": true
      },
      "planning": {
        "axis": "planning",
        "label": "계획성",
        "value": 0.7,
        "evidence": [
          "F03",
          "F07",
          "F08",
          "F09",
          "F13"
        ],
        "reason": "월 소득 변동성이 높고(F01), 소득원이 집중되어 있어 위험(F02)이 있지만, 안정적인 생활비 지출(F07), 효율적인 경비 관리(F08), 그리고 높은 저축 여력률(F09)과 적극적인 커리어 소스 관리(F13)가 장기 관리 습관을 강하게 지지하고 있습니다. 이러한 요소들이 계획성과 관리 행동 측면에서 긍정적인 신호를 제공하여 가장 높은 값인 0.7을 ",
        "polarity": {
          "F01": "down",
          "F02": "down",
          "F03": "up",
          "F04": "down",
          "F06": "down",
          "F07": "up",
          "F08": "up",
          "F09": "up",
          "F11": "neutral",
          "F13": "up"
        },
        "fallback": false,
        "gate_failures": [
          "menu_violation:0.65"
        ],
        "retried": true
      }
    },
    "model_id": "hf.co/LGAI-EXAONE/EXAONE-3.5-7.8B-Instruct-GGUF:Q4_K_M",
    "fallback_used": false,
    "seq": 5,
    "source_txn_count": 14,
    "staleness": {
      "new_txns": 0,
      "stale": false,
      "threshold": 5
    }
  },
  "/v1/profile/gig": {
    "volatility": "고변동",
    "volatility_cv": 0.81,
    "concentration": "다각화",
    "top_source_share": 0.38,
    "rhythm": "플랫폼 정기형",
    "is_multi_gig": false,
    "phase": "성장기",
    "archetype": "고변동 긱워커 — 큰 대금이 가끔, 세금·가뭄 대비가 핵심",
    "notes": [
      "소득 변동계수 0.81 — 롤러코스터형(직장인의 7배 수준)",
      "소득원 3곳으로 분산 — 한 곳이 흔들려도 버틸 여지",
      "플랫폼 정산 3곳 위주 — 준고정 주기",
      "커리어 신호 +3.0%/년 — 수주·단가가 붙는 추세"
    ]
  },
  "/v1/behavior/career-scraps": [
    {
      "id": "9e85c89b2935",
      "created_at": "2026-07-17T14:12:32+00:00",
      "content": "React 커머스 화면의 빈 상태를 개선하고 배운 점을 기록했어요",
      "source": "user",
      "seq": 2
    }
  ],
  "/v1/profile/verification/pending": {
    "jobs": [
      {
        "id": "7dc17237337e",
        "date": "2025-05-27",
        "amount": 3000000.0,
        "counterparty": "△△플랫폼 정산",
        "memo": ""
      },
      {
        "id": "0b40b7f79ae4",
        "date": "2025-02-14",
        "amount": 800000.0,
        "counterparty": "위시켓",
        "memo": ""
      }
    ]
  },
  "/v1/coach/agenda": {
    "items": [],
    "silent_count": 230,
    "note": "발화문은 결정론 템플릿 — 소비(spoken 처리)는 POST /agenda/consume"
  }
};

const POST: Record<string, unknown> = {
  "/v1/products/match": {
    "matches": [
      {
        "product_id": "parking",
        "name": "하나 긱워커 파킹통장",
        "envelope": "tax",
        "line": "월 소득 변동계수가 중간 수준이며, 저축 여력률이 높아 (43%) 목표 봉투를 위한 유동성 관리와 저축에 도움이 될 것으로 예상됩니다. 또한, 현재 5월 종소세까지의 자금을 효율적으로 관리할 수 있는 파킹통장 기능이",
        "evidence": [
          "F02",
          "F09"
        ],
        "source": "llm"
      }
    ],
    "candidates": [
      {
        "product_id": "parking",
        "name": "하나 긱워커 파킹통장",
        "envelope": "tax",
        "basis": "세금봉투 392,057원이 5월 종소세까지 대기 중 — 파킹하면 이자가 붙어요"
      }
    ],
    "vetoed": {
      "isa": "버퍼 목표 미달 — 투자상품은 여윳돈 목표를 채운 뒤에만 후보가 돼요",
      "emergency": "확정된 예정 수입이 없어요 — 갚을 근거 없이 대출을 권하지 않아요",
      "irp": "장기 잠김 상품 — 버퍼 미달이고 감속 신호도 없어 아직 후보가 아니에요"
    },
    "persona_used": true,
    "persona_staleness": {
      "new_txns": 0,
      "stale": false,
      "threshold": 5
    },
    "verification": {
      "job": "developer",
      "sources": [
        "github",
        "hometax",
        "kosa",
        "mydata",
        "portfolio"
      ],
      "score": 257,
      "stage": "확정",
      "score_breakdown": {
        "verified_history": 82,
        "connected_sources": 175
      },
      "review_connection": {
        "available": true,
        "label": "검증자료로 심사 연결",
        "basis": "신고소득 또는 협회 경력을 확인해 검증자료를 심사 화면에 연결할 수 있어요"
      },
      "verified": {
        "count": 4,
        "streak_months": 3,
        "span_months": 3,
        "recent": [
          {
            "id": "f0c5af0955f4",
            "date": "2025-05-10",
            "amount": 1200000.0,
            "counterparty": "△△스튜디오",
            "memo": "랜딩 개발"
          },
          {
            "id": "289f72dc9681",
            "date": "2025-05-02",
            "amount": 500000.0,
            "counterparty": "○○커머스",
            "memo": "웹 프론트엔드"
          },
          {
            "id": "793163186ed2",
            "date": "2025-04-12",
            "amount": 950000.0,
            "counterparty": "크몽 정산",
            "memo": "검증된 일감"
          },
          {
            "id": "a04995fbaccf",
            "date": "2025-03-15",
            "amount": 1450000.0,
            "counterparty": "㈜브릿지웍스",
            "memo": "잔금"
          }
        ]
      },
      "piggybank": {
        "xp": 251,
        "work_xp": 120,
        "mission_xp": 130,
        "loop_xp": 0,
        "daily_xp": 1,
        "level": 3,
        "level_title": "정산 새싹",
        "max_level": 10,
        "current_threshold": 180,
        "next_threshold": 280,
        "xp_to_next": 29,
        "progress": 0.71,
        "completed_missions": 6,
        "missions": [
          {
            "id": "connect_github",
            "title": "GitHub 작업 활동 연결",
            "xp": 20,
            "completed": true
          },
          {
            "id": "connect_hometax",
            "title": "홈택스 신고소득 연결",
            "xp": 30,
            "completed": true
          },
          {
            "id": "connect_kosa",
            "title": "KOSA 경력자료 연결",
            "xp": 25,
            "completed": true
          },
          {
            "id": "connect_mydata",
            "title": "마이데이터 소득 흐름 연결",
            "xp": 20,
            "completed": true
          },
          {
            "id": "connect_behance",
            "title": "Behance 포트폴리오 연결",
            "xp": 15,
            "completed": false
          },
          {
            "id": "connect_portfolio",
            "title": "포트폴리오 작업물 등록",
            "xp": 15,
            "completed": true
          },
          {
            "id": "create_goal",
            "title": "첫 목표 봉투 만들기",
            "xp": 20,
            "completed": true
          },
          {
            "id": "tag_income",
            "title": "애매한 입금 직접 확인",
            "xp": 15,
            "completed": false
          },
          {
            "id": "process_allocation",
            "title": "첫 입금 배분 처리",
            "xp": 25,
            "completed": false
          }
        ],
        "daily_missions": [
          {
            "id": "today_transactions",
            "title": "오늘 거래 정리",
            "xp": 30,
            "completed": false,
            "available": true,
            "description": "정산 입금이 내 일감인지 직접 확인해요"
          },
          {
            "id": "career_scrap",
            "title": "오늘의 커리어 조각 저금",
            "xp": 1,
            "completed": true,
            "available": true,
            "description": "아티클·레포·레퍼런스 중 하나를 저장해요"
          },
          {
            "id": "care_piggy",
            "title": "돼지 저금통 돌보기",
            "xp": 0,
            "completed": false,
            "available": true,
            "description": "성장에는 영향 없이 반응만 즐겨요"
          }
        ],
        "phase": {
          "key": "tax_season",
          "label": "세금 시즌",
          "message": "세금 준비율과 놓친 경비를 먼저 확인해요"
        },
        "levels": [
          {
            "level": 1,
            "title": "첫 동전",
            "threshold": 0,
            "reward": "기본 저금통",
            "node_type": "character"
          },
          {
            "level": 2,
            "title": "일감 모으기",
            "threshold": 80,
            "reward": "하나머니 혜택 확인",
            "node_type": "reward"
          },
          {
            "level": 3,
            "title": "정산 새싹",
            "threshold": 180,
            "reward": "새싹 스킨",
            "node_type": "character"
          },
          {
            "level": 4,
            "title": "리듬 수집가",
            "threshold": 280,
            "reward": "리듬 수집가 스킨",
            "node_type": "character"
          },
          {
            "level": 5,
            "title": "든든 저금통",
            "threshold": 500,
            "reward": "저금통 1차 성장",
            "node_type": "character"
          },
          {
            "level": 6,
            "title": "커리어 성장",
            "threshold": 720,
            "reward": "파킹통장 우대 확인",
            "node_type": "reward"
          },
          {
            "level": 7,
            "title": "신뢰 수집가",
            "threshold": 980,
            "reward": "직군 소품",
            "node_type": "character"
          },
          {
            "level": 8,
            "title": "자산 설계자",
            "threshold": 1280,
            "reward": "환율·수수료 혜택 확인",
            "node_type": "reward"
          },
          {
            "level": 9,
            "title": "커리어 자산가",
            "threshold": 1620,
            "reward": "반짝 스킨",
            "node_type": "character"
          },
          {
            "level": 10,
            "title": "프로 긱워커",
            "threshold": 2000,
            "reward": "커리어 마스터 배지",
            "node_type": "character"
          }
        ],
        "reward_is_example": true
      }
    },
    "note": "커리어 점수는 한도를 계산하지 않아요. 상품 선택은 판정일 뿐, 심사·가입은 사람의 결정이에요"
  },
  "/v1/envelopes/recommend": {
    "recommendations": [
      {
        "name": "일 없는 달 대비 비상금",
        "why": "고변동 소득과 29일의 최장 무수입 공백으로 인해 안정적인 버퍼가 필요합니다.",
        "evidence": [
          "F04"
        ]
      },
      {
        "name": "성장기 다각화 투자",
        "why": "성장기 긱워커로서 다각화된 소득원을 유지하고 새로운 기회에 투자하기 위한 목표 봉투가 필요합니다.",
        "evidence": [
          "F02",
          "F13"
        ]
      },
      {
        "name": "긴급 의료비 대비",
        "why": "높은 자기통제와 계획성에도 불구하고 예상치 못한 의료비에 대비하기 위한 목표 봉투는 필수적입니다.",
        "evidence": [
          "F07"
        ]
      }
    ],
    "peers": [
      {
        "name": "장비 교체",
        "suggested_amount": 2700000.0,
        "share": 0.221,
        "count": 2,
        "pool": 10,
        "scope": "job",
        "basis": "나와 성향이 비슷한 개발자 10명 중 2명이 만든 봉투 — 유사 성향 가중 22% · 월 여윳돈 기준 6개월 소요",
        "months_to_reach": 6,
        "affordable_amount": null
      },
      {
        "name": "일 없는 달",
        "suggested_amount": 1750000.0,
        "share": 0.215,
        "count": 2,
        "pool": 10,
        "scope": "job",
        "basis": "나와 성향이 비슷한 개발자 10명 중 2명이 만든 봉투 — 유사 성향 가중 22% · 월 여윳돈 기준 4개월 소요",
        "months_to_reach": 4,
        "affordable_amount": null
      },
      {
        "name": "여행",
        "suggested_amount": 1500000.0,
        "share": 0.147,
        "count": 2,
        "pool": 10,
        "scope": "job",
        "basis": "나와 성향이 비슷한 개발자 10명 중 2명이 만든 봉투 — 유사 성향 가중 15% · 월 여윳돈 기준 3개월 소요",
        "months_to_reach": 3,
        "affordable_amount": null
      }
    ],
    "persona_used": true,
    "persona_staleness": {
      "new_txns": 0,
      "stale": false,
      "threshold": 5
    },
    "note": "추천은 판정일 뿐 — 개설(POST /v1/envelopes/goals)은 사용자의 결정"
  },
  "/v1/strength": {
    "line": "랜딩 개발 분야 검증 일감 4건 — 정산 입금과 연결자료로 확인",
    "candidates": [
      "랜딩 개발 분야 검증 일감 4건 — 정산 입금과 연결자료로 확인"
    ],
    "chosen_by": "fallback",
    "reason": "선택 에이전트 응답 없음/범위 밖 — 우선순위 룰로 선택",
    "signals": [
      "가드레일: LLM 폴백"
    ]
  },
  "/v1/coach/chat": {
    "reply": "지금은 코치 연결이 원활하지 않아요. 제안 내용은 화면의 근거를 확인해 주세요.",
    "source": "fallback",
    "verified": false,
    "signals": [
      "숫자 검증 실패 — 컨텍스트에 없는 숫자를 지어냄 → 결정론 폴백으로 교체",
      "룰 미매치 + LLM 무응답/메뉴 밖 → Q&A 폴백"
    ],
    "captured_event": null,
    "intent": {
      "intent": "qa",
      "source": "fallback",
      "signal": "룰 미매치 + LLM 무응답/메뉴 밖 → Q&A 폴백"
    }
  }
};

// 서버 다운 시 오프라인 배분(api.ts OFFLINE_ALLOCATION과 동일 수치) — 순환 import 피하려 복제.
const OFFLINE_ALLOCATION = {
  "id": "offline",
  "status": "proposed",
  "deposit": 3000000,
  "proposed": {
    "tax": 108900,
    "expense": 400000,
    "spendable": 1200000,
    "buffer": 1291100
  },
  "windfall_ratio": 3.75,
  "needs_confirmation": true,
  "reasons": [
    "세금봉투 108,900원: 실효 추가세율 3.6%를 먼저 떼어 5월 종소세에 대비해요",
    "경비봉투 400,000원: 이번 달 예상 경비를 채워요",
    "즉시가용 1,200,000원: 이번 달 생활비까지 채워요",
    "여윳돈 1,291,100원: 소득 변동에 대비해 버퍼 목표까지 더 모아요",
    "이번 입금은 평소(800,000원)의 3.8배 — 코치가 확인을 요청해요"
  ],
  "product_hooks": [
    {
      "product_id": "parking",
      "envelope": "tax",
      "name": "하나 긱워커 파킹통장",
      "line": "세금봉투 108,900원은 하나 긱워커 파킹통장(연 3.0%)에 두면 5월 종소세 때까지 이자가 붙어요"
    }
  ],
  "gig_archetype": "고변동 · 단일 플랫폼 의존 — 가장 취약한 긱 구조라 버퍼가 생명줄",
  "buffer_target": 3600000,
  "invest_available": 0,
  "policy": null,
  "persona_used": false,
  "persona_staleness": null
};

const DEMO_TXN = {
  "id": "demo_dep",
  "date": "2025-05-27",
  "amount": 3000000,
  "direction": "in",
  "counterparty": "△△플랫폼 정산",
  "memo": "",
  "kind": "income",
  "subtype": "settlement",
  "confidence": 0.95,
  "needs_review": false,
  "signals": [
    "플랫폼 정산"
  ],
  "verified_career_job": true
};

const DEMO_PACING = {
  "id": "pace_demo",
  "status": "proposed",
  "available": 700000,
  "split": {
    "비상금": 210000,
    "내집마련": 280000,
    "노후": 210000
  },
  "reasons": [
    "여윳돈 70만원을 목표 3개에 나눠 담았어요",
    "가장 급한 비상금부터 채워요"
  ],
  "judgment": {
    "reason": "버퍼가 아직 목표 미만이라 안전자금에 가중",
    "fallback": false,
    "evidence": [
      "버퍼일수 32일",
      "목표 비상금 3개월"
    ],
    "stances": {
      "비상금": "balanced",
      "내집마련": "balanced",
      "노후": "future"
    }
  },
  "goals": [
    {
      "id": "g1",
      "name": "비상금",
      "base": 233333,
      "stance": "balanced",
      "amount": 210000
    },
    {
      "id": "g2",
      "name": "내집마련",
      "base": 233333,
      "stance": "balanced",
      "amount": 280000
    },
    {
      "id": "g3",
      "name": "노후",
      "base": 233334,
      "stance": "future",
      "amount": 210000
    }
  ],
  "source": "llm"
};

export function demoGet(path: string): unknown {
  if (path in GET) return GET[path];
  if (/\/v1\/bank\/transactions\/.+\/clarify$/.test(path)) {
    return { question: "이 입금은 어떤 성격인가요?", options: [
      { kind: "income", label: "일해서 번 소득" },
      { kind: "living", label: "생활비 이체" },
      { kind: "expense", label: "경비 환급" },
    ], source: "fallback" };
  }
  return undefined;
}

export function demoPost(path: string, body: unknown): unknown {
  if (path in POST) return POST[path];
  const b = (body ?? {}) as Record<string, any>;
  if (path === "/v1/allocations/propose") return OFFLINE_ALLOCATION;
  if (/\/v1\/allocations\/.+\/decision$/.test(path))
    return { ...OFFLINE_ALLOCATION, status: "confirmed", needs_confirmation: false };
  if (path === "/v1/bank/deposit")
    return { transaction: DEMO_TXN, allocation: OFFLINE_ALLOCATION, clarify: null };
  if (path === "/v1/pacing/propose") return DEMO_PACING;
  if (/\/v1\/pacing\/.+\/decision$/.test(path)) return { id: "pace_demo", status: "confirmed" };
  if (path === "/v1/profile/verification/jobs") return GET["/v1/profile/verification"];
  if (path === "/v1/profile/verification") return GET["/v1/profile/verification"];
  if (path === "/v1/envelopes/goals")
    return { id: "g_demo", name: b.name ?? "새 목표", target_amount: b.target_amount ?? 0,
      target_date: b.target_date ?? null, balance: 0, status: "active", source: "user", seq: 99 };
  if (path === "/v1/profile/v2/management-override") return GET["/v1/profile/v2"];
  if (path === "/v1/coach/agenda/consume") return { consumed: 0 };
  if (path.startsWith("/v1/profile/read")) return { snapshot_id: "demo" };
  if (path === "/v1/behavior") return {};
  if (path === "/v1/behavior/career-scraps")
    return { ok: true, scrap: { id: "s_demo", content: b.content ?? "", created_at: "2026-07-18" },
      event_id: "e_demo", xp_awarded: false };
  if (/\/v1\/bank\/transactions\/.+\/tag$/.test(path))
    return { transaction: DEMO_TXN, learned: false, allocation: null };
  return {};
}
