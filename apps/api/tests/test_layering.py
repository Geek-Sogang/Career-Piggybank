"""계층 경계 강제 (import-lint) — "코드 트리가 곧 아키텍처"를 테스트로 못박는다.

계층: core(인프라) · store · schemas · engines(계산 결정론) · agents(판단 LLM) ·
profile(팩트 aggregate) · orchestration(흐름) · api(합성 루트).

규칙: 아래 계층은 위 계층을 import하지 않는다. engines는 판단(agents)·흐름(orchestration)을
모르고, agents·profile은 흐름을 모른다. 흐름(orchestration)만 전부를 조립한다. 이 방향성이
깨지면(예: engines가 agents를 import) 이 테스트가 잡는다 — A2A·역방향 결합 금지.
"""
from __future__ import annotations

import ast
import pathlib

APP = pathlib.Path(__file__).resolve().parent.parent / "app"

# 각 계층이 import해도 되는 app 하위 패키지 (자기 자신 포함). api/main은 합성 루트라 무제한.
ALLOWED: dict[str, set[str]] = {
    "core": {"core"},
    "store": {"core", "store"},
    "schemas": {"core", "schemas"},
    "engines": {"core", "store", "engines"},
    "agents": {"core", "store", "engines", "agents"},
    "profile": {"core", "store", "engines", "profile"},
    "orchestration": {"core", "store", "engines", "agents", "profile", "orchestration"},
}
UNRESTRICTED = {"api", "main"}


def _imported_app_pkgs(src: str) -> set[str]:
    pkgs: set[str] = set()
    for node in ast.walk(ast.parse(src)):
        mods: list[str] = []
        if isinstance(node, ast.ImportFrom) and node.module:
            mods.append(node.module)
        elif isinstance(node, ast.Import):
            mods.extend(a.name for a in node.names)
        for m in mods:
            parts = m.split(".")
            if len(parts) >= 2 and parts[0] == "app":
                pkgs.add(parts[1])
    return pkgs


def test_no_upward_or_sideways_layer_imports() -> None:
    violations: list[str] = []
    for path in APP.rglob("*.py"):
        if "__pycache__" in path.parts:
            continue
        layer = path.relative_to(APP).parts[0]
        if layer.endswith(".py"):          # app/main.py 등 최상위 파일
            layer = layer[:-3]
        if layer in UNRESTRICTED:
            continue
        allowed = ALLOWED.get(layer)
        if allowed is None:
            continue                       # 미분류 최상위 파일은 검사 제외
        for pkg in _imported_app_pkgs(path.read_text()):
            if pkg not in UNRESTRICTED and pkg not in allowed:
                violations.append(f"{path.relative_to(APP.parent)}: {layer} → app.{pkg} (금지)")
    assert not violations, "계층 경계 위반:\n" + "\n".join(sorted(violations))
