"""데모 시드 — 조대흠 페르소나 (프론트 화면 수치와 정합).

거래 원장이 비어 있을 때 1회만 실행: 4개월 라벨 이력(프로필 산출 재료) +
가계부 화면의 거래들 + 미분류 토스페이(수기 태그 데모) + 봉투 초기 잔액
(세금 320,000 = '미리 준비 ₩320,000' · 여윳돈 99,555 = '여윳돈 ₩99,555').
"""
from __future__ import annotations

from app.store import db

# (date, amount, direction, counterparty, memo, kind, subtype, needs_review)
_TXNS = [
    # 2월 — 프로필 이력용
    ("2025-02-14", 800_000, "in", "위시켓", "", "income", "settlement", False),
    ("2025-02-05", 350_000, "out", "가비아 호스팅", "", "expense", "operating", False),
    ("2025-02-20", 1_150_000, "out", "생활비 지출 합계", "", "living", None, False),
    # 3월
    ("2025-03-15", 1_450_000, "in", "㈜브릿지웍스", "잔금", "income", "settlement", False),
    ("2025-03-06", 380_000, "out", "Adobe", "", "expense", "subscription", False),
    ("2025-03-21", 1_200_000, "out", "생활비 지출 합계", "", "living", None, False),
    # 4월
    ("2025-04-12", 950_000, "in", "크몽 정산", "", "income", "settlement", False),
    ("2025-04-04", 300_000, "out", "작업실 임대료", "", "expense", "operating", False),
    ("2025-04-19", 1_100_000, "out", "생활비 지출 합계", "", "living", None, False),
    # 5월 — 가계부 화면의 거래들
    ("2025-05-02", 500_000, "in", "○○커머스", "웹 프론트엔드", "income", "settlement", False),
    ("2025-05-10", 1_200_000, "in", "△△스튜디오", "랜딩 개발", "income", "settlement", False),
    ("2025-05-18", 18_000, "out", "Figma 구독", "", "expense", "subscription", False),
    ("2025-05-20", 250_000, "in", "토스페이 정산", "", "unknown", None, True),  # 수기 태그 데모
]

_ENVELOPES = {"tax": 320_000, "expense": 0, "spendable": 0, "buffer": 99_555}


def _ax(risk: float, time: float, ctrl: float, plan: float) -> dict:
    """또래 페르소나 축 — 프로필 판독 스냅샷과 같은 형태 (값은 메뉴 {0.1..0.9})."""
    labels = {"risk_tolerance": "위험감내", "time_preference": "시간선호",
              "self_control": "자기통제", "planning": "계획성"}
    values = {"risk_tolerance": risk, "time_preference": time,
              "self_control": ctrl, "planning": plan}
    return {k: {"axis": k, "label": labels[k], "value": v, "fallback": False, "evidence": []}
            for k, v in values.items()}


# 합성 또래 풀 — (직군, 봉투 이름, 목표액, 페르소나 축). 실서비스에선 실사용자 개설이
# 이 풀에 기여한다(origin='user'); 데모는 합성 또래로 콜드스타트를 채운다(origin='seed').
# 성향이 봉투를 가른다: 안전지향은 '일 없는 달', 계획형은 '세금 넉넉히', 공격형은 장비 투자.
_PEERS = [
    # 개발자 — 안전·계획형 (조대흠 유사 성향대)
    ("developer", "일 없는 달", 2_000_000, _ax(0.3, 0.7, 0.7, 0.7)),
    ("developer", "일 없는 달", 1_500_000, _ax(0.1, 0.7, 0.5, 0.9)),
    ("developer", "장비 교체", 2_400_000, _ax(0.3, 0.7, 0.7, 0.9)),
    ("developer", "장비 교체", 3_000_000, _ax(0.3, 0.5, 0.7, 0.7)),
    ("developer", "세금 넉넉히", 1_000_000, _ax(0.1, 0.9, 0.7, 0.9)),
    ("developer", "컨퍼런스·강의", 600_000, _ax(0.3, 0.7, 0.5, 0.7)),
    # 개발자 — 공격·현재선호형 (다른 성향대 — 유사도 가중에서 밀려야 정상)
    ("developer", "여행", 1_800_000, _ax(0.9, 0.3, 0.3, 0.3)),
    ("developer", "주식 시드", 3_000_000, _ax(0.9, 0.3, 0.5, 0.5)),
    ("developer", "여행", 1_200_000, _ax(0.7, 0.1, 0.3, 0.3)),
    # 디자이너
    ("designer", "태블릿 교체", 1_600_000, _ax(0.3, 0.7, 0.7, 0.7)),
    ("designer", "작업실 보증금", 5_000_000, _ax(0.1, 0.9, 0.7, 0.9)),
    ("designer", "일 없는 달", 1_800_000, _ax(0.3, 0.7, 0.5, 0.7)),
    ("designer", "포트폴리오 촬영", 400_000, _ax(0.5, 0.5, 0.5, 0.5)),
    # 크리에이터
    ("creator", "카메라 업그레이드", 2_800_000, _ax(0.7, 0.5, 0.5, 0.5)),
    ("creator", "일 없는 달", 2_500_000, _ax(0.3, 0.7, 0.5, 0.7)),
    ("creator", "편집 외주비", 900_000, _ax(0.5, 0.5, 0.7, 0.7)),
]


def ensure_seed() -> bool:
    """원장이 비어 있으면 시드. 시드했으면 True."""
    if db.peer_pool_count() == 0:      # 또래 풀은 원장과 독립적으로 1회 시드
        for job, name, amount, axes in _PEERS:
            db.insert_peer_envelope(job, name, amount, axes, origin="seed")
    if db.list_txns():
        return False
    for date, amount, direction, cp, memo, kind, subtype, review in _TXNS:
        signals = ["데모 시드"] if not review else ["결정론 신호 없음: '토스페이 정산'"]
        db.insert_txn(
            date=date, amount=amount, direction=direction, counterparty=cp, memo=memo,
            kind=kind, subtype=subtype, confidence=0.9 if not review else 0.3,
            needs_review=review, signals=signals,
        )
    for name, balance in _ENVELOPES.items():
        db.envelope_set(name, balance)

    # 실제 행동(비금융) 계측 시드 — 조대흠은 커리어 소스 3곳을 연결하고 앱을 꾸준히 여는
    # 적극적 긱 커리어 관리형. F13=3곳은 계획성 근거, F14=여러 주 활동은 데이터 품질.
    for src in ("github", "hometax", "portfolio"):
        db.log_event("source_connected", payload={"source": src})
    for d in ("2025-02-16", "2025-03-02", "2025-03-23", "2025-04-13", "2025-05-04"):
        db.log_event("app_opened", payload={}, ts=f"{d}T09:00:00+00:00")   # 5주에 걸친 방문
    return True
