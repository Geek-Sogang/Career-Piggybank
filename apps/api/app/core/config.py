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
    # 태스크별 모델: 판단(분류·판정·선택)=작고 빠른 모델, 코치(대화)=한국어 품질 최우선.
    # 선정 근거 = 골든셋 측정(evals/run_eval) — 감이 아니라 숫자로 교체한다.
    ollama_base_url: str = "http://localhost:11434"
    # 골든셋 측정(7/3): 판단은 2.4B가 정확도 100% 동일·오답 0·2.4배 빠름(16.6s vs 40.3s,
    # 커버리지 80% vs 82.9% — 1건 더 보수적으로 review). 코치는 언어 품질로 7.8B 유지.
    ollama_model_coach: str = "hf.co/LGAI-EXAONE/EXAONE-3.5-7.8B-Instruct-GGUF:Q4_K_M"
    ollama_model_judgment: str = "hf.co/LGAI-EXAONE/EXAONE-3.5-2.4B-Instruct-GGUF:Q4_K_M"
    ollama_timeout_s: float = 60.0

    # 영속 저장소 (SQLite) — 데모 스코프 단일 사용자
    db_path: str = "data/piggybank.db"
    demo_seed: bool = True  # 시작 시 조대흠 데모 데이터 시드 (테스트에선 끔)

    # 학습 배분 정책 — 탐색(Thompson 샘플링)은 기본 꺼짐(사후 평균 argmax).
    # 오프라인 백테스트에서 고정 정책을 이기면 켠다(백테스트 게이트) — 데모 중 켜지 않는다.
    policy_exploration: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
