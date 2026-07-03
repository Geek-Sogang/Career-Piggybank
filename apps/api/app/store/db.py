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
