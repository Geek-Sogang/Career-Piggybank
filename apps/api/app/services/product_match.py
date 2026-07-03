"""배분 → 하나 상품 훅 (개인화 ② 상품 CTA — §6-1 · §6-2 "이어지는 실제 하나 상품").

"이 봉투에 들어갈 돈은 ~상품으로 ~할 수 있어요"를 배분 제안에 붙인다.
- **선택은 룰, 문구는 결정론 템플릿** — LLM은 상품명·수치를 생성하지 않는다(§9-3).
- 카탈로그는 모바일 `products.ts`와 같은 하나은행/하나금융 상품만 (하나 브랜드 불가침).
- 훅은 최대 2개 — 배분 확인이 주인공이고 상품은 조연이다(추천 폭주 금지).
"""
from __future__ import annotations

from app.services.allocator import AllocationContext, AllocationProposal

# product_id는 모바일 products.ts의 ProductKey와 1:1 — 앱이 상품 상세로 바로 연결
CATALOG: dict[str, str] = {
    "parking": "하나 긱워커 파킹통장",
    "isa": "하나은행 ISA",
    "emergency": "하나 긱워커 비상금대출",
    "irp": "하나은행 IRP 개인형 퇴직연금",
}

MAX_HOOKS = 2          # 확인 시트에 붙는 상품 훅 상한
GAP_BRIDGE_DAYS = 40.0  # 수주 공백이 이 이상이면 공백 브릿지(비상금대출) 안내


def hooks_for(p: AllocationProposal, ctx: AllocationContext | None = None) -> list[dict]:
    """배분 제안 1건 → 봉투별 하나 상품 훅 (우선순위순, 최대 MAX_HOOKS개).

    숫자는 전부 제안(p)의 결정론 출력을 인용한다 — 지어내는 금액이 없다.
    """
    c = ctx or AllocationContext()
    hooks: list[dict] = []

    # 1) 여윳돈이 버퍼 목표를 넘겼다 → ISA (버퍼 초과분만, §6-2⑤)
    if p.invest_available > 0:
        hooks.append({
            "product_id": "isa", "envelope": "buffer", "name": CATALOG["isa"],
            "line": (
                f"버퍼 목표를 넘는 {p.invest_available:,.0f}원은 {CATALOG['isa']}로 보수적으로 "
                "굴릴 수 있어요 — 손익통산·비과세가 소득 변동이 큰 긱워커에게 유리해요"
            ),
        })

    # 2) 수주 공백이 길고 버퍼가 아직 목표 미달 → 공백 브릿지 (비상금대출)
    if (
        c.expected_gap_days is not None
        and c.expected_gap_days >= GAP_BRIDGE_DAYS
        and p.invest_available <= 0
    ):
        hooks.append({
            "product_id": "emergency", "envelope": "spendable", "name": CATALOG["emergency"],
            "line": (
                f"다음 수입까지 약 {c.expected_gap_days:.0f}일 — 공백에 대비해 "
                f"{CATALOG['emergency']}(마이너스통장)을 미리 열어둘 수 있어요"
            ),
        })

    # 3) 커리어 신호 악화 → 노후 준비 시작 (IRP)
    if c.early_decline:
        hooks.append({
            "product_id": "irp", "envelope": "buffer", "name": CATALOG["irp"],
            "line": (
                f"수주 흐름이 감속 추세예요 — {CATALOG['irp']}로 노후봉투를 시작하기 좋은 "
                "타이밍이에요 (가뭄 달은 건너뛸 수 있어요)"
            ),
        })

    # 4) 세금봉투가 쌓인다 → 파킹통장 (5월까지 이자 붙는 금고)
    if p.tax > 0:
        hooks.append({
            "product_id": "parking", "envelope": "tax", "name": CATALOG["parking"],
            "line": (
                f"세금봉투 {p.tax:,.0f}원은 {CATALOG['parking']}(연 3.0%)에 두면 "
                "5월 종소세 때까지 이자가 붙어요"
            ),
        })

    return hooks[:MAX_HOOKS]
