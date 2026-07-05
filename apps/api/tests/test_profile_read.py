"""프로필 판독 에이전트 테스트 (PR B) — LLM은 모킹, 게이트는 실검증.

게이트가 곧 신뢰다: 접지(지어낸 근거 폐기)·극성(부호 오류 탈락)·메뉴(번호만 선택)·
LLM 다운(중립 폴백). 각각이 실측(probe4·KT-3)에서 실제로 잡았던 오류 유형이다.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.agents import profile_read
from app.main import app
from app.services import facts as facts_svc
from app.store import db

client = TestClient(app)


def _ledger() -> list[dict]:
    """박몰아형 — 몰아쓰기 74%대·가뭄 경직이 나오는 원장."""
    mk = lambda date, amount, kind, direction="out", cp="x": {  # noqa: E731
        "date": date, "amount": amount, "kind": kind,
        "direction": direction, "counterparty": cp, "needs_review": False,
    }
    return [
        mk("2025-02-10", 1_000_000, "income", "in", "크몽"),
        mk("2025-02-11", 400_000, "living"),
        mk("2025-02-12", 300_000, "living"),
        mk("2025-02-25", 100_000, "living"),
        mk("2025-03-15", 700_000, "living"),          # 가뭄달 — 못 줄임
        mk("2025-04-20", 2_000_000, "income", "in", "위시켓"),
        mk("2025-04-21", 500_000, "living"),
    ]


def _facts():
    return facts_svc.build_factsheet(_ledger(), [], [])


def _llm_out(value=0.3, evidence=None, polarity=None, reason="근거 기반 판단"):
    return {
        "value": value,
        "evidence": evidence if evidence is not None else ["F06", "F05"],
        "polarity": polarity if polarity is not None else {"F06": "내림", "F05": "내림"},
        "reason": reason,
    }


# ── 행복 경로 ──

def test_valid_reading_accepted(monkeypatch):
    monkeypatch.setattr(profile_read.llm, "chat_json", lambda *a, **k: _llm_out())
    r = profile_read.read_axis("self_control", _facts())
    assert not r.fallback
    assert r.value == 0.3
    assert r.evidence == ("F06", "F05")
    assert r.polarity == {"F06": "down", "F05": "down"}  # 한국어 극성 정규화


# ── 게이트 — 실측에서 실제로 잡았던 오류 유형들 ──

def test_grounding_gate_rejects_invented_evidence(monkeypatch):
    monkeypatch.setattr(profile_read.llm, "chat_json",
                        lambda *a, **k: _llm_out(evidence=["F06", "F99"]))
    r = profile_read.read_axis("self_control", _facts())
    assert r.fallback and r.value == 0.5
    assert any(g.startswith("grounding:") for g in r.gate_failures)


def test_grounding_gate_rejects_unmeasured_fact(monkeypatch):
    # F10(태깅)은 events 없음 → value None → 근거가 될 수 없다
    monkeypatch.setattr(profile_read.llm, "chat_json",
                        lambda *a, **k: _llm_out(evidence=["F10"]))
    r = profile_read.read_axis("self_control", _facts())
    assert r.fallback


def test_polarity_gate_rejects_sign_error(monkeypatch):
    # 몰아쓰기 60%(높음)를 자기통제 '올림'으로 읽는 부호 오류 — probe3에서 실제로 났던 그 오류
    monkeypatch.setattr(profile_read.llm, "chat_json",
                        lambda *a, **k: _llm_out(polarity={"F06": "올림"}))
    r = profile_read.read_axis("self_control", _facts())
    assert r.fallback
    assert any(g.startswith("polarity:F06") for g in r.gate_failures)


def test_polarity_neutral_is_weight_judgment_not_error(monkeypatch):
    # 중립은 '이 팩트에 무게 안 둠'이라는 가중 판단 — 극성 모순이 아니다
    monkeypatch.setattr(profile_read.llm, "chat_json",
                        lambda *a, **k: _llm_out(polarity={"F06": "중립"}))
    r = profile_read.read_axis("self_control", _facts())
    assert not r.fallback


def test_menu_gate_rejects_free_value(monkeypatch):
    monkeypatch.setattr(profile_read.llm, "chat_json",
                        lambda *a, **k: _llm_out(value=0.42))
    r = profile_read.read_axis("self_control", _facts())
    assert r.fallback
    assert any(g.startswith("menu_violation") for g in r.gate_failures)


def test_llm_down_falls_back_neutral(monkeypatch):
    monkeypatch.setattr(profile_read.llm, "chat_json", lambda *a, **k: None)
    reading = profile_read.read_profile(_facts())
    assert reading["fallback_count"] == 4
    assert all(a["value"] == 0.5 for a in reading["axes"].values())


# ── 오케스트레이션 (라우트 + 스냅샷) ──

def _seed_db():
    for t in _ledger():
        db.insert_txn(
            date=t["date"], amount=t["amount"], direction=t["direction"],
            counterparty=t["counterparty"], memo="", kind=t["kind"], subtype=None,
            confidence=0.9, needs_review=False, signals=[],
        )


def test_read_route_saves_snapshot(monkeypatch):
    _seed_db()
    monkeypatch.setattr(profile_read.llm, "chat_json", lambda *a, **k: _llm_out())
    body = client.post("/v1/profile/read").json()
    assert body["fallback_count"] == 0
    assert set(body["axes"]) == {"risk_tolerance", "time_preference", "self_control", "planning"}

    snap = db.latest_snapshot()
    assert snap is not None and snap["id"] == body["snapshot_id"]
    assert snap["axes"]["self_control"]["value"] == 0.3
    assert snap["factsheet"]["count"] == 12          # 판단 당시의 사실이 함께 고정
    assert snap["model_id"] == body["model_id"]

    persona = client.get("/v1/profile/persona").json()
    assert persona["id"] == snap["id"]


def test_persona_404_before_first_read():
    assert client.get("/v1/profile/persona").status_code == 404
