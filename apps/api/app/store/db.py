"""SQLite 저장소 — 표준 라이브러리만 사용 (의존성 0), 단일 사용자 데모 스코프.

테이블:
- transactions: 거래 원장 (분류 결과 포함) — 가계부 화면의 데이터 소스
- envelopes: 봉투 잔액 (tax/expense/spendable/buffer) — 승인된 배분만 잔액을 바꾼다
- allocations: 배분 제안·결정 이력 — 무수정 승인율 KPI의 원천
- tag_dictionary: 수기 태그 학습 사전 — 분류 캐스케이드 0층 ("쓸수록 똑똑해짐")
"""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings

_SCHEMA = """
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL, amount REAL NOT NULL, direction TEXT NOT NULL,
  counterparty TEXT NOT NULL, memo TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL, subtype TEXT,
  confidence REAL NOT NULL, needs_review INTEGER NOT NULL,
  signals TEXT NOT NULL DEFAULT '[]',
  seq INTEGER
);
CREATE TABLE IF NOT EXISTS envelopes (
  name TEXT PRIMARY KEY, balance REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS allocations (
  id TEXT PRIMARY KEY,
  txn_id TEXT,
  deposit REAL NOT NULL,
  proposed TEXT NOT NULL,           -- EnvelopeSplit JSON
  status TEXT NOT NULL DEFAULT 'proposed',
  final TEXT,                        -- EnvelopeSplit JSON (승인/조정 후)
  meta TEXT NOT NULL DEFAULT '{}',   -- buffer_target·windfall·reasons 등
  seq INTEGER
);
CREATE TABLE IF NOT EXISTS tag_dictionary (
  counterparty TEXT PRIMARY KEY,
  kind TEXT NOT NULL, subtype TEXT
);
CREATE TABLE IF NOT EXISTS expected_events (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,          -- 예정일 (ISO)
  amount REAL,                 -- 없을 수 있음 (금액 미상 예정 수입)
  label TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'coach_chat'
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,            -- 기록 시각 (UTC ISO) — 행동 리듬(태깅 빈도·결정 속도)의 원천
  type TEXT NOT NULL,          -- deposit_received / txn_tagged / allocation_decided ...
  ref_id TEXT,                 -- 관련 txn_id / alloc_id
  payload TEXT NOT NULL DEFAULT '{}',
  spoken INTEGER NOT NULL DEFAULT 0,  -- 어젠다 큐: 0 = 피기가 아직 발화하지 않은 행
  seq INTEGER
);
CREATE TABLE IF NOT EXISTS profile_snapshots (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  trigger TEXT NOT NULL,       -- manual / monthly / new_txns / income_shift ...
  factsheet TEXT NOT NULL,     -- 팩트시트 JSON (판단 당시의 사실 — 감사·재생의 기준점)
  axes TEXT,                   -- 프로필 판독 결과 JSON (PR B에서 채움 — 판단+근거 로그)
  model_id TEXT,
  fallback_used INTEGER NOT NULL DEFAULT 0,
  seq INTEGER
);
"""

ENVELOPE_NAMES = ("tax", "expense", "spendable", "buffer")


def get_conn() -> sqlite3.Connection:
    path = Path(settings.db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as c:
        c.executescript(_SCHEMA)
        for name in ENVELOPE_NAMES:
            c.execute("INSERT OR IGNORE INTO envelopes(name, balance) VALUES (?, 0)", (name,))


def _next_seq(c: sqlite3.Connection, table: str) -> int:
    row = c.execute(f"SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM {table}").fetchone()  # noqa: S608
    return int(row["n"])


# ── transactions ──

def insert_txn(
    *, date: str, amount: float, direction: str, counterparty: str, memo: str,
    kind: str, subtype: str | None, confidence: float, needs_review: bool,
    signals: list[str],
) -> str:
    txn_id = uuid.uuid4().hex[:12]
    with get_conn() as c:
        c.execute(
            "INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (txn_id, date, amount, direction, counterparty, memo, kind, subtype,
             confidence, int(needs_review), json.dumps(signals, ensure_ascii=False),
             _next_seq(c, "transactions")),
        )
    return txn_id


def list_txns() -> list[dict]:
    with get_conn() as c:
        rows = c.execute("SELECT * FROM transactions ORDER BY seq DESC").fetchall()
    return [_txn_dict(r) for r in rows]


def get_txn(txn_id: str) -> dict | None:
    with get_conn() as c:
        row = c.execute("SELECT * FROM transactions WHERE id=?", (txn_id,)).fetchone()
    return _txn_dict(row) if row else None


def tag_txn(txn_id: str, kind: str, subtype: str | None) -> None:
    with get_conn() as c:
        c.execute(
            "UPDATE transactions SET kind=?, subtype=?, confidence=1.0, needs_review=0, "
            "signals=json_insert(signals, '$[#]', '수기 태그 · 직접 분류 ✓') WHERE id=?",
            (kind, subtype, txn_id),
        )


def _txn_dict(r: sqlite3.Row) -> dict:
    d = dict(r)
    d["needs_review"] = bool(d["needs_review"])
    d["signals"] = json.loads(d["signals"])
    return d


# ── tag dictionary (캐스케이드 0층) ──

def dict_lookup(counterparty: str) -> dict | None:
    with get_conn() as c:
        row = c.execute(
            "SELECT kind, subtype FROM tag_dictionary WHERE counterparty=?", (counterparty.strip(),)
        ).fetchone()
    return dict(row) if row else None


def dict_learn(counterparty: str, kind: str, subtype: str | None) -> None:
    with get_conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO tag_dictionary VALUES (?,?,?)",
            (counterparty.strip(), kind, subtype),
        )


# ── envelopes ──

def envelope_balances() -> dict[str, float]:
    with get_conn() as c:
        rows = c.execute("SELECT name, balance FROM envelopes").fetchall()
    return {r["name"]: r["balance"] for r in rows}


def envelope_add(split: dict[str, float]) -> None:
    with get_conn() as c:
        for name in ENVELOPE_NAMES:
            c.execute(
                "UPDATE envelopes SET balance = balance + ? WHERE name=?",
                (float(split.get(name, 0)), name),
            )


def envelope_set(name: str, balance: float) -> None:
    with get_conn() as c:
        c.execute("INSERT OR REPLACE INTO envelopes VALUES (?,?)", (name, balance))


# ── expected events (코치가 수집한 예정 수입 — §6-2⑥) ──

def insert_expected_event(date: str, amount: float | None, label: str, source: str = "coach_chat") -> str:
    ev_id = uuid.uuid4().hex[:12]
    with get_conn() as c:
        c.execute("INSERT INTO expected_events VALUES (?,?,?,?,?)",
                  (ev_id, date, amount, label, source))
    return ev_id


def list_expected_events() -> list[dict]:
    with get_conn() as c:
        rows = c.execute("SELECT * FROM expected_events ORDER BY date").fetchall()
    return [dict(r) for r in rows]


# ── allocations ──

def insert_allocation(deposit: float, proposed: dict, meta: dict, txn_id: str | None = None) -> str:
    alloc_id = uuid.uuid4().hex[:12]
    with get_conn() as c:
        c.execute(
            "INSERT INTO allocations VALUES (?,?,?,?,?,?,?,?)",
            (alloc_id, txn_id, deposit, json.dumps(proposed), "proposed", None,
             json.dumps(meta, ensure_ascii=False), _next_seq(c, "allocations")),
        )
    return alloc_id


def get_allocation(alloc_id: str) -> dict | None:
    with get_conn() as c:
        row = c.execute("SELECT * FROM allocations WHERE id=?", (alloc_id,)).fetchone()
    return _alloc_dict(row) if row else None


def decide_allocation(alloc_id: str, status: str, final: dict | None) -> None:
    with get_conn() as c:
        c.execute(
            "UPDATE allocations SET status=?, final=? WHERE id=?",
            (status, json.dumps(final) if final is not None else None, alloc_id),
        )


def list_allocations() -> list[dict]:
    with get_conn() as c:
        rows = c.execute("SELECT * FROM allocations ORDER BY seq").fetchall()
    return [_alloc_dict(r) for r in rows]


def month_allocated(month: str) -> dict[str, float]:
    """해당 달(YYYY-MM)에 확정된 배분 합계 — allocator 갭 채우기의 기준."""
    sums = {name: 0.0 for name in ENVELOPE_NAMES}
    with get_conn() as c:
        rows = c.execute(
            "SELECT a.final FROM allocations a LEFT JOIN transactions t ON a.txn_id = t.id "
            "WHERE a.status IN ('confirmed','adjusted') AND a.final IS NOT NULL "
            "AND (t.date LIKE ? OR t.date IS NULL)",
            (f"{month}%",),
        ).fetchall()
    for r in rows:
        final = json.loads(r["final"])
        for name in ENVELOPE_NAMES:
            sums[name] += float(final.get(name, 0))
    return sums


def _alloc_dict(r: sqlite3.Row) -> dict:
    d = dict(r)
    d["proposed"] = json.loads(d["proposed"])
    d["final"] = json.loads(d["final"]) if d["final"] else None
    d["meta"] = json.loads(d["meta"])
    return d


# ── events (행동 계측 append-only 로그 — 어젠다 큐 겸용) ──
#
# 같은 테이블이 두 역할을 겸한다:
# ① 행동축의 원천 — 태깅 리듬·결정 속도·조정 습관은 이 타임스탬프에서만 잴 수 있다
#    (지금 안 쌓으면 행동축은 영원히 데모 상수).
# ② 코치 어젠다 큐 — spoken=0 인 행이 "피기가 아직 말하지 않은 사건"이다 (PR D).

def log_event(type_: str, ref_id: str | None = None, payload: dict | None = None) -> str:
    ev_id = uuid.uuid4().hex[:12]
    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with get_conn() as c:
        c.execute(
            "INSERT INTO events VALUES (?,?,?,?,?,?,?)",
            (ev_id, ts, type_, ref_id,
             json.dumps(payload or {}, ensure_ascii=False), 0, _next_seq(c, "events")),
        )
    return ev_id


def list_events(type_: str | None = None) -> list[dict]:
    q = "SELECT * FROM events" + (" WHERE type=?" if type_ else "") + " ORDER BY seq"
    with get_conn() as c:
        rows = c.execute(q, (type_,) if type_ else ()).fetchall()
    return [_event_dict(r) for r in rows]


def unspoken_events() -> list[dict]:
    """어젠다 큐 — 피기가 아직 발화하지 않은 사건들 (오래된 것부터)."""
    with get_conn() as c:
        rows = c.execute("SELECT * FROM events WHERE spoken=0 ORDER BY seq").fetchall()
    return [_event_dict(r) for r in rows]


def mark_spoken(event_id: str) -> None:
    with get_conn() as c:
        c.execute("UPDATE events SET spoken=1 WHERE id=?", (event_id,))


def _event_dict(r: sqlite3.Row) -> dict:
    d = dict(r)
    d["payload"] = json.loads(d["payload"])
    d["spoken"] = bool(d["spoken"])
    return d


# ── profile snapshots (판단 당시의 사실·판단을 고정 — 감사 가능한 로그) ──

def insert_snapshot(
    trigger: str, factsheet: dict, axes: dict | None = None,
    model_id: str | None = None, fallback_used: bool = False,
) -> str:
    snap_id = uuid.uuid4().hex[:12]
    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with get_conn() as c:
        c.execute(
            "INSERT INTO profile_snapshots VALUES (?,?,?,?,?,?,?,?)",
            (snap_id, ts, trigger, json.dumps(factsheet, ensure_ascii=False),
             json.dumps(axes, ensure_ascii=False) if axes is not None else None,
             model_id, int(fallback_used), _next_seq(c, "profile_snapshots")),
        )
    return snap_id


def latest_snapshot() -> dict | None:
    with get_conn() as c:
        row = c.execute(
            "SELECT * FROM profile_snapshots ORDER BY seq DESC LIMIT 1"
        ).fetchone()
    return _snapshot_dict(row) if row else None


def list_snapshots() -> list[dict]:
    with get_conn() as c:
        rows = c.execute("SELECT * FROM profile_snapshots ORDER BY seq").fetchall()
    return [_snapshot_dict(r) for r in rows]


def _snapshot_dict(r: sqlite3.Row) -> dict:
    d = dict(r)
    d["factsheet"] = json.loads(d["factsheet"])
    d["axes"] = json.loads(d["axes"]) if d["axes"] else None
    d["fallback_used"] = bool(d["fallback_used"])
    return d
