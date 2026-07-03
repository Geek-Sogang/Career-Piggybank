.PHONY: api api-test api-install mobile mobile-install lint

# ── 백엔드 (apps/api) ──
api-install:
	cd apps/api && python3 -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]"

api:
	cd apps/api && . .venv/bin/activate && uvicorn app.main:app --reload

api-test:
	cd apps/api && . .venv/bin/activate && pytest -q

# ── 모바일 (apps/mobile) ──
mobile-install:
	cd apps/mobile && npm install

mobile:
	cd apps/mobile && npm start

lint:
	cd apps/mobile && npm run lint
