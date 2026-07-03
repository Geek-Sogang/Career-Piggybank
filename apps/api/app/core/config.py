"""앱 설정 — 환경변수 기반."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "career-piggybank-api"
    env: str = "local"
    # 모바일 앱 등 CORS 허용 오리진 (콤마 구분)
    cors_origins: str = "*"

    # 로컬 LLM (Ollama) — 은행 망분리 전제, 외부 AI API 금지
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "hf.co/LGAI-EXAONE/EXAONE-3.5-7.8B-Instruct-GGUF:Q4_K_M"
    ollama_timeout_s: float = 60.0

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
