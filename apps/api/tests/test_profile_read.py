"""프로필 판독 에이전트 테스트 (PR B) — LLM은 모킹, 게이트는 실검증.

게이트가 곧 신뢰다: 접지(지어낸 근거 폐기)·극성(부호 오류 탈락)·최종값 방향·
메뉴(번호만 선택)·LLM 다운(중립 폴백). 각각이 실측에서 실제로 잡은 오류 유형이다.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.agents import profile_read
from app.main import app
from app.engines import facts as facts_svc
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


def _facts_with_career_and_app_behavior():
    events = [
        {"type": "source_connected", "payload": {"source": source},
         "ts": f"2025-0{i + 1}-03T00:00:00+00:00"}
        for i, source in enumerate(("github", "hometax", "portfolio"))
    ]
    events.extend([
        {"type": "app_opened", "payload": {}, "ts": f"2025-0{i + 1}-10T00:00:00+00:00"}
        for i in range(3)
    ])
    return facts_svc.build_factsheet(_ledger(), [], events)


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


def test_value_direction_gate_rejects_final_value_opposite_to_cited_evidence(monkeypatch):
    """극성표는 맞지만 최종값을 반대로 고른 P04 유형도 결정론 게이트가 막는다."""
    monkeypatch.setattr(profile_read.llm, "chat_json", lambda *a, **k: {
        "value": 0.9,
        "evidence": ["F06"],
        "polarity": {"F06": "내림"},
        "reason": "몰아쓰기가 크므로 자기통제가 높다",  # 최종 방향만 정반대
    })
    r = profile_read.read_axis("self_control", _facts())
    assert r.fallback and r.value == 0.5
    assert any(g.startswith("value_direction:") for g in r.gate_failures)


def test_planning_chaotic_spending_is_downward_evidence():
    """긱 수입의 생활비 변동이 크면 계획성을 높이는 근거로 뒤집을 수 없다."""
    assert profile_read._expected_polarity("planning", "F07", 0.85) == "down"


def test_f05_low_self_control_gated_on_savings_capacity():
    """유철 피드백: 가뭄에 '못 줄임'은 저축 여력(F09)이 있을 때만 자기통제↓ 증거.

    생계 최저선(F09 낮음)인 사람은 줄이고 싶어도 줄일 게 없어 F05가 높게 나오는데,
    이걸 자기통제 낮음으로 읽으면 억울하다 → 코드 게이트로 극성을 무효화.
    """
    from types import SimpleNamespace

    from app.agents.profile_read import _expected_polarity

    def fm(f09_value):
        return {"F09": SimpleNamespace(value=f09_value)}

    # F05 = 0(가뭄에 못 줄임): 여력 충분(F09 0.3)이면 자기통제↓('down'), 여력 부족(0.05)이면 무효(None)
    assert _expected_polarity("self_control", "F05", 0.0, facts_by_id=fm(0.30)) == "down"
    assert _expected_polarity("self_control", "F05", 0.0, facts_by_id=fm(0.05)) is None
    assert _expected_polarity("self_control", "F05", 0.0, facts_by_id=fm(None)) is None
    # 가뭄에 크게 줄임(-0.4)은 여력 무관하게 항상 자기통제↑('up') — 최저선에서 줄이면 더 강한 증거
    assert _expected_polarity("self_control", "F05", -0.4, facts_by_id=fm(0.05)) == "up"


def test_all_axes_exclude_f14_from_prompt(monkeypatch):
    """앱 실행은 모든 축에서 데이터 품질일 뿐 성향 방향 입력이 아니다."""
    seen: dict[str, str] = {}

    def fake(system, user, **kwargs):
        seen[system] = user
        return {"value": 0.5, "evidence": [], "polarity": {}, "reason": "중립"}

    monkeypatch.setattr(profile_read.llm, "chat_json", fake)
    for axis in profile_read.AXES:
        reading = profile_read.read_axis(axis, _facts_with_career_and_app_behavior())
        assert not reading.fallback

    assert len(seen) == len(profile_read.AXES)
    assert all("F14 · 앱 참여 리듬" not in user for user in seen.values())


def test_planning_keeps_f13_as_gig_career_behavior(monkeypatch):
    """커리어 소스 연결은 긱 계획성의 실제 비금융 행동 근거로 유지한다."""
    seen: dict[str, str] = {}

    def fake(system, user, **kwargs):
        seen["user"] = user
        return {
            "value": 0.7,
            "evidence": ["F13"],
            "polarity": {"F13": "올림"},
            "reason": "커리어 소스를 스스로 연결함",
        }

    monkeypatch.setattr(profile_read.llm, "chat_json", fake)
    reading = profile_read.read_axis("planning", _facts_with_career_and_app_behavior())

    assert not reading.fallback and reading.evidence == ("F13",)
    assert "F13 · 커리어 소스 연결" in seen["user"]


def test_all_axes_reject_f14_even_if_model_invents_it(monkeypatch):
    """F14는 모든 축의 접지 허용 목록에서도 빠져 간접 경로로 다시 들어올 수 없다."""
    monkeypatch.setattr(profile_read.llm, "chat_json", lambda *a, **k: {
        "value": 0.7,
        "evidence": ["F14"],
        "polarity": {"F14": "올림"},
        "reason": "앱을 자주 열었음",
    })

    for axis in profile_read.AXES:
        reading = profile_read.read_axis(axis, _facts_with_career_and_app_behavior())
        assert reading.fallback and reading.value == 0.5
        assert any(g == "grounding:F14" for g in reading.gate_failures)


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


# ── 교정 재시도 — 게이트가 잡은 위반을 명시해 1회 재판단 (답변 안정성) ──

def test_corrective_retry_rescues_menu_violation(monkeypatch):
    """1차: 메뉴 밖 0.55 → 재시도 프롬프트에 위반 명시 → 2차 정상이면 기권 대신 채택."""
    calls: list[str] = []

    def fake(system, user, **k):
        calls.append(user)
        if len(calls) == 1:
            return _llm_out(value=0.55)          # 메뉴 위반
        return _llm_out(value=0.3)               # 교정됨

    monkeypatch.setattr(profile_read.llm, "chat_json", fake)
    r = profile_read.read_axis("self_control", _facts())
    assert not r.fallback
    assert r.value == 0.3
    assert r.retried is True
    assert any(g.startswith("menu_violation") for g in r.gate_failures)  # 감사: 첫 위반 기록
    assert "교정 재시도" in calls[1] and "0.55" in calls[1]              # 위반이 명시된 다른 입력


def test_corrective_retry_still_bad_falls_back(monkeypatch):
    """재시도도 위반이면 유도하지 않고 중립 폴백 — 1회 한정 (게이트는 게이트)."""
    monkeypatch.setattr(profile_read.llm, "chat_json",
                        lambda *a, **k: _llm_out(value=0.42))
    r = profile_read.read_axis("self_control", _facts())
    assert r.fallback and r.value == 0.5
    assert any(g.startswith("retry:") for g in r.gate_failures)   # 2차 위반도 감사 기록


def test_clean_first_answer_does_not_retry(monkeypatch):
    """1차가 깨끗하면 재호출 없음 — 재시도는 예외 경로지 상시 2배 호출이 아니다."""
    calls: list[str] = []

    def fake(system, user, **k):
        calls.append(user)
        return _llm_out()

    monkeypatch.setattr(profile_read.llm, "chat_json", fake)
    r = profile_read.read_axis("self_control", _facts())
    assert not r.fallback and not r.retried
    assert len(calls) == 1


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
    assert snap["factsheet"]["count"] == 14          # 판단 당시의 사실이 함께 고정
    assert snap["model_id"] == body["model_id"]

    persona = client.get("/v1/profile/persona").json()
    assert persona["id"] == snap["id"]


def test_persona_404_before_first_read():
    assert client.get("/v1/profile/persona").status_code == 404
