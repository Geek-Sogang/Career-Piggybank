"""거래 분류기(결정론 캐스케이드) 테스트."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.engines.classifier import TxnInput, classify


def txn(amount: float, counterparty: str, direction: str = "in", memo: str = "") -> TxnInput:
    return TxnInput(date="2026-05-15", amount=amount, direction=direction,  # type: ignore[arg-type]
                    counterparty=counterparty, memo=memo)


# ---------- 입금: 3.3% 역산 (긱워커 킬러 시그널) ----------

def test_withholding_reversal_detects_settlement() -> None:
    """483,500 = 500,000 × 0.967 — 처음 보는 발주처여도 잔금으로 판정."""
    c = classify(txn(483_500, "듣도보도못한이름"))
    assert c.kind == "income"
    assert c.subtype == "settlement"
    assert c.confidence >= 0.9
    assert c.needs_review is False
    assert "500,000" in c.signals[0]


def test_reversal_works_for_larger_amounts() -> None:
    c = classify(txn(1_934_000, "새거래처"))  # 2,000,000 × 0.967
    assert (c.kind, c.subtype) == ("income", "settlement")


def test_non_reversal_amount_falls_through() -> None:
    """800,000은 역산해도 만원 단위가 안 나옴 → 3.3% 신호 미발동."""
    c = classify(txn(800_000, "김민수"))
    assert c.subtype != "settlement"


# ---------- 입금: 플랫폼 정산 · 사업자 형태 · 개인 이름 ----------

def test_platform_deposit_is_settlement() -> None:
    c = classify(txn(800_000, "크몽 정산"))
    assert (c.kind, c.subtype) == ("income", "settlement")
    assert c.needs_review is False


def test_business_name_without_withholding_is_advance() -> None:
    """사업자 형태 + 3.3% 흔적 없음 → 계약금(선금) 의심 라벨."""
    c = classify(txn(3_000_000, "△△스튜디오"))
    assert (c.kind, c.subtype) == ("income", "advance")
    assert any("계약금" in s for s in c.signals)


def test_personal_name_is_not_guessed() -> None:
    """개인 이름 입금은 찍지 않고 사람에게 넘긴다 (용돈·더치페이일 수 있음)."""
    c = classify(txn(300_000, "김민수"))
    assert c.kind == "unknown"
    assert c.needs_review is True


def test_ambiguous_deposit_goes_to_review() -> None:
    """결정론 신호가 전혀 없는 입금(페이 단순 송금)은 미분류 → 사람에게."""
    c = classify(txn(250_000, "카카오페이"))
    assert c.kind == "unknown"
    assert c.needs_review is True


# ---------- 출금: 경비 키워드 vs 생활 지출 ----------

def test_subscription_is_expense() -> None:
    c = classify(txn(18_000, "Figma", direction="out"))
    assert (c.kind, c.subtype) == ("expense", "subscription")


def test_operating_keyword_is_expense() -> None:
    c = classify(txn(55_000, "가비아 호스팅", direction="out"))
    assert (c.kind, c.subtype) == ("expense", "operating")


def test_default_outgoing_is_living() -> None:
    c = classify(txn(6_500, "스타벅스", direction="out"))
    assert c.kind == "living"
    assert c.needs_review is False


# ---------- 계약 위반 ----------

def test_zero_amount_raises() -> None:
    with pytest.raises(ValueError):
        classify(txn(0, "누군가"))


# ---------- 라우트 ----------

client = TestClient(app)


def test_classify_batch_route() -> None:
    res = client.post("/v1/classify", json={"transactions": [
        {"date": "2026-05-15", "amount": 483_500, "direction": "in", "counterparty": "○○커머스"},
        {"date": "2026-05-16", "amount": 250_000, "direction": "in", "counterparty": "카카오페이"},
        {"date": "2026-05-18", "amount": 18_000, "direction": "out", "counterparty": "Figma"},
    ]})
    assert res.status_code == 200
    body = res.json()
    kinds = [r["kind"] for r in body["results"]]
    assert kinds == ["income", "unknown", "expense"]
    assert body["review_count"] == 1
    assert all(r["signals"] for r in body["results"])  # 근거 없는 판정 금지


# ---------- 커버리지 확장 룰: 정산 채널명 형태 · 비매출 입금 패턴 ----------

def test_settlement_channel_name_is_income() -> None:
    """입금자명에 '정산' — 정산 대행/커머스/페이 채널 형태 → income 자동."""
    for name in ("토스페이 정산", "페이코 정산", "스마트스토어 정산금", "클래스톡 강의정산"):
        c = classify(TxnInput(date="2026-06-01", amount=250_000, direction="in", counterparty=name))
        assert (c.kind, c.subtype) == ("income", "settlement")
        assert c.needs_review is False
        assert c.confidence < 0.9  # 플랫폼 직접 등록(0.9)보다는 낮게


def test_non_revenue_institution_is_living() -> None:
    """기관 환급·수당·보험금 — 매출 아님이 구조적으로 확실 → living 자동."""
    cases = [
        ("국세청", "종합소득세 환급"),
        ("서울시청", "청년수당"),
        ("한화손해보험", "보험금 지급"),
        ("당근마켓", "자전거 판매"),
    ]
    for name, memo in cases:
        c = classify(TxnInput(date="2026-06-01", amount=150_000, direction="in",
                              counterparty=name, memo=memo))
        assert c.kind == "living"
        assert c.needs_review is False


def test_memo_refund_hint_is_living() -> None:
    c = classify(TxnInput(date="2026-06-01", amount=45_000, direction="in",
                          counterparty="지그재그", memo="환불"))
    assert c.kind == "living" and c.needs_review is False


def test_personal_dutch_pay_memo_still_goes_to_review() -> None:
    """개인 이름 + '회식비 정산' 메모 — 정산 토큰은 입금자명에만 적용, 여전히 사람에게."""
    c = classify(TxnInput(date="2026-06-01", amount=45_000, direction="in",
                          counterparty="김민수", memo="회식비 정산"))
    assert c.kind == "unknown" and c.needs_review is True


def test_reversal_still_beats_settlement_token() -> None:
    """3.3% 역산이 정산 채널명보다 우선 — 캐스케이드 순서 보존."""
    c = classify(TxnInput(date="2026-06-01", amount=483_500, direction="in",
                          counterparty="어딘가 정산"))
    assert c.confidence == 0.95  # 역산 층에서 잡힘


def test_expense_suspect_outgoing_goes_to_review() -> None:
    """도서·교육·출장 계열 출금은 생활비로 조용히 찍지 않는다 — 경비 인정은 종소세 직결."""
    for name, memo in (("교보문고", "개발 서적"), ("패스트캠퍼스", "강의 결제"), ("코레일", "출장 KTX")):
        c = classify(TxnInput(date="2026-06-15", amount=50_000, direction="out",
                              counterparty=name, memo=memo))
        assert c.kind == "unknown" and c.needs_review is True


def test_plain_living_outgoing_still_auto() -> None:
    c = classify(TxnInput(date="2026-06-15", amount=6_500, direction="out", counterparty="스타벅스"))
    assert c.kind == "living" and c.needs_review is False


def test_operating_hint_beats_suspect() -> None:
    """확정 신호(장비)가 의심 신호보다 우선 — 캐스케이드 순서 보존."""
    c = classify(TxnInput(date="2026-06-15", amount=250_000, direction="out",
                          counterparty="쿠팡", memo="모니터 장비"))
    assert (c.kind, c.subtype) == ("expense", "operating")
