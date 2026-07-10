"""로컬 LLM 클라이언트 (Ollama) — 외부 AI API 절대 금지, 로컬/온프렘만.

표준 라이브러리(urllib)만 사용해 런타임 의존성을 늘리지 않는다.
실패(서버 다운·타임아웃·JSON 깨짐)는 예외가 아니라 None — 호출부(캐스케이드)가
룰 결과로 안전하게 폴백하도록 한다 (LLM이 죽어도 데모가 죽지 않는다).
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request

from app.core.config import settings


def chat_text(system: str, user: str, temperature: float = 0.4, model: str | None = None) -> str | None:
    """system+user 프롬프트 → 자유 텍스트 응답 (코치용 — 한국어 품질 모델). 실패 시 None."""
    payload = json.dumps({
        "model": model or settings.ollama_model_coach,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "stream": False,
        "options": {"temperature": temperature},
    }).encode()
    req = urllib.request.Request(
        f"{settings.ollama_base_url}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=settings.ollama_timeout_s) as res:
            body = json.load(res)
        content = body["message"]["content"]
        return content.strip() if isinstance(content, str) and content.strip() else None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError, OSError):
        return None


def chat_json(system: str, user: str, model: str | None = None) -> dict | None:
    """system+user 프롬프트 → JSON 응답 (판단 태스크용 — 작고 빠른 모델, temp 0, format=json).

    Ollama가 없거나 응답이 JSON이 아니면 None.
    """
    payload = json.dumps({
        "model": model or settings.ollama_model_judgment,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "stream": False,
        "format": "json",           # JSON 외 출력 차단
        "options": {"temperature": 0},  # 같은 입력 → 같은 답 (재현성)
    }).encode()
    req = urllib.request.Request(
        f"{settings.ollama_base_url}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=settings.ollama_timeout_s) as res:
            body = json.load(res)
        parsed = json.loads(body["message"]["content"])
        return parsed if isinstance(parsed, dict) else None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError, OSError):
        return None
