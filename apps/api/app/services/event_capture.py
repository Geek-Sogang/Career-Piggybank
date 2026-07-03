"""예정 수입 이벤트 수집 — 모델이 못 보는 미래는 사용자 머릿속에 있다 (§6-2⑥).

스트림 D(신규 발주)는 원장 어디에도 신호가 없다. 그 구멍을 메우는 유일하게 정직한 방법은
대화다: "다음 주에 잔금 200만원 들어와요" → 예정 수입 이벤트로 반영.

멀티에이전트 문법:
- **역할 분리**: 파싱 에이전트는 문장→구조화만 한다. 예측 반영은 income_streams(결정론),
  답변은 코치, 확정 표시는 UI — 파서는 아무것도 실행하지 않는다.
- **오케스트레이션**: 코치 챗에 들어온 메시지를 코드가 먼저 파서에 통과시키고,
  잡히면 저장 후 코치 컨텍스트에 주입한다 — 흐름은 코드가 정한다.
- **가드레일**:
  · 금액은 메시지에 있는 숫자에서만 (단위 환산 ×10^k 허용) — 지어낸 금액은 폐기
  · 날짜는 ISO 형식 검증 + 기준일 이후 1년 이내만
  · LLM 실패/검증 실패면 조용히 무시(이벤트 없음) — 예정 '표시'일 뿐 돈은 움직이지 않는다
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta

from app.services import llm

MAX_FUTURE_DAYS = 370   # 예정 수입은 1년 이내만 (그 너머는 예측이 아니라 소망)
MAX_LABEL_CHARS = 30

_SYSTEM_TEMPLATE = """너는 긱워커 가계부의 예정 수입 파싱 에이전트다. 문장에서 '앞으로 들어올 돈' 하나만 구조화한다 — 답변·조언·실행은 네 일이 아니다.
JSON만 출력한다: {"has_event": true|false, "date": "YYYY-MM-DD"|null, "amount": 숫자|null, "label": "짧은 이름(한국어)"}
규칙:
- 미래에 들어올 수입(잔금·계약금·정산 예정)만. 과거 이야기·단순 질문·지출 계획이면 has_event=false.
- 금액은 문장에 있는 숫자만 쓴다. '200만원'→2000000처럼 단위만 환산한다. 문장에 없으면 null.
- 날짜는 기준일에서 환산해 ISO로. '다음 주'≈기준일+7일, '이달 말'≈기준일 달의 말일. 모호하면 null.
기준일: {today}"""

_NUM = re.compile(r"\d[\d,]*")
_DATE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")


def _parse_date_lenient(raw: str) -> date | None:
    """LLM의 달 경계 산수 실수를 달력이 교정 — '2025-05-33' → 2025-06-02 (결정론).

    LLM은 '기준일+7일'을 계산하다 달을 넘기는 실수를 한다. 일(day) 초과분은
    다음 달로 이월해 준다. 월이 1~12를 벗어나면 교정하지 않는다(무효).
    """
    m = _DATE.match(raw.strip())
    if not m:
        return None
    year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if not (1 <= month <= 12 and 1 <= day <= 62):
        return None
    try:
        return date(year, month, 1) + timedelta(days=day - 1)
    except ValueError:
        return None


@dataclass(frozen=True)
class ExpectedEvent:
    date: str
    amount: float | None
    label: str


def _amount_grounded(amount: float, message: str) -> bool:
    """금액이 메시지의 숫자에서 왔는지 결정론 검증 — 단위 환산(×10^k)만 허용."""
    if amount <= 0 or amount != int(amount):
        return False
    tokens = [int(t.replace(",", "")) for t in _NUM.findall(message)]
    for t in tokens:
        if t <= 0:
            continue
        v = float(t)
        for _ in range(9):  # 원 → 십·백·천·만 … 억 단위 환산
            if v == amount:
                return True
            v *= 10
    return False


def capture(message: str, today: str) -> ExpectedEvent | None:
    """메시지 1건 → 예정 수입 이벤트 (없거나 검증 실패면 None — 조용한 무시가 안전)."""
    out = llm.chat_json(_SYSTEM_TEMPLATE.replace("{today}", today), message)
    if not out or out.get("has_event") is not True:
        return None

    raw_date = out.get("date")
    if not isinstance(raw_date, str):
        return None
    d = _parse_date_lenient(raw_date)
    try:
        base = date.fromisoformat(today)
    except ValueError:
        return None
    if d is None:
        return None
    if not (base < d <= base + timedelta(days=MAX_FUTURE_DAYS)):
        return None  # 과거·1년 초과는 예정 수입이 아니다

    amount: float | None = None
    raw_amount = out.get("amount")
    if raw_amount is not None:
        try:
            amount = float(raw_amount)
        except (TypeError, ValueError):
            return None
        if not _amount_grounded(amount, message):
            return None  # 가드레일: 메시지에 없는 금액은 폐기

    label = str(out.get("label", "")).strip()[:MAX_LABEL_CHARS] or "예정 수입"
    return ExpectedEvent(date=d.isoformat(), amount=amount, label=label)
