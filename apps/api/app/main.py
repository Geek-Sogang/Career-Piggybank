"""Career-Piggybank API — FastAPI 엔트리포인트."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import allocations, health, profile, tax_envelope
from app.core.config import settings


def create_app() -> FastAPI:
    app = FastAPI(
        title="Career-Piggybank API",
        version="0.1.0",
        description="긱워커 생활금융 플랫폼 백엔드 (세금봉투 결정론 엔진 등)",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(tax_envelope.router)
    app.include_router(allocations.router)
    app.include_router(profile.router)
    return app


app = create_app()
