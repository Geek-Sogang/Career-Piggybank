"""테스트 공통 — 테스트마다 임시 SQLite로 격리, 데모 시드는 끔."""
from __future__ import annotations

import pytest

from app.core.config import settings
from app.store import db


@pytest.fixture(autouse=True)
def tmp_db(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "db_path", str(tmp_path / "test.db"))
    monkeypatch.setattr(settings, "demo_seed", False)
    db.init_db()
    yield
