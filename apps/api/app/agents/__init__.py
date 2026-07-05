"""agents/ — 판단(LLM)의 자리. 판정만 하고 실행하지 않는다.

여기 선언된 것만 에이전트다(registry.roster). 계산(원화·세율·시뮬)은 서비스 엔진,
흐름 제어는 오케스트레이션 코드의 몫 — base.GRAMMAR 참조.
"""
from app.agents.base import GRAMMAR, AgentContractError, AgentSpec
from app.agents.registry import get, roster

__all__ = ["GRAMMAR", "AgentContractError", "AgentSpec", "get", "roster"]
