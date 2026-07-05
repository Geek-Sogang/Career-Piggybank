"""배분 → 하나 상품 훅 (개인화 ② 상품 CTA — §6-1 · §6-2 "이어지는 실제 하나 상품").

"이 봉투에 들어갈 돈은 ~상품으로 ~할 수 있어요"를 배분 제안에 붙인다.
- 카탈로그는 모바일 `products.ts`와 같은 하나은행/하나금융 상품만 (하나 브랜드 불가침).
- 훅은 최대 2개 — 배분 확인이 주인공이고 상품은 조연이다(추천 폭주 금지).

두 층으로 나뉜다:
- `hooks_for` — 입금 핫패스의 즉시 훅. 선택은 룰, 문구는 결정론 템플릿(현행 유지).
- `eligible` — **적합성 veto 필터**: 부적합 상품은 후보에 못 들어간다(구조적 차단).
  ⑥ 상품 매칭 에이전트(agents/product_match)의 메뉴가 이 후보 목록이다 —
  AI가 고르되, 부적합 상품은 고를 수 없다 (금융상품 적합성 원칙, 결정론).
"""
from __future__ import annotations

from dataclasses import dataclass

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


# ── 적합성 veto 필터 — ⑥ 상품 매칭 에이전트의 메뉴를 만든다 (결정론) ──

@dataclass(frozen=True)
class Candidate:
    """적합성 veto를 통과한 상품 1개 — 에이전트가 고를 수 있는 메뉴 항목.

    line은 결정론 템플릿 문구(숫자는 인용값만) — LLM 문구가 게이트에서 탈락하거나
    LLM이 다운이면 이 문구가 그대로 나간다 (문구 폴백).
    """

    product_id: str
    name: str
    envelope: str   # 이 상품이 이어지는 봉투
    basis: str      # 적격 사유 (결정론 — 감사·폴백 문구의 근거)

    def as_dict(self) -> dict:
        return {"product_id": self.product_id, "name": self.name,
                "envelope": self.envelope, "basis": self.basis}


def eligible(
    invest_available: float,
    tax_balance: float,
    ctx: AllocationContext | None = None,
) -> tuple[list[Candidate], dict[str, str]]:
    """카탈로그 → (적격 후보, veto된 상품과 사유).

    부적합 상품은 후보에 못 들어간다 — AI 선택 이전의 구조적 차단(적합성 원칙).
    입력은 전부 결정론 출력 인용(최신 배분의 invest_available·봉투 잔액·커리어 신호).
    """
    c = ctx or AllocationContext()
    candidates: list[Candidate] = []
    vetoed: dict[str, str] = {}

    # parking — 원금보장 예금성: 항상 적격. 세금봉투 잔액이 있으면 근거가 더 구체적.
    basis = (
        f"세금봉투 {tax_balance:,.0f}원이 5월 종소세까지 대기 중 — 파킹하면 이자가 붙어요"
        if tax_balance > 0 else "대기 자금을 원금보장으로 굴리는 기본 선택지예요"
    )
    candidates.append(Candidate("parking", CATALOG["parking"], "tax", basis))

    # isa — 투자상품: 버퍼 목표 초과분이 있을 때만. 미달이면 구조적 차단(MC 최소선 문법).
    if invest_available > 0:
        candidates.append(Candidate(
            "isa", CATALOG["isa"], "buffer",
            f"여윳돈이 버퍼 목표를 {invest_available:,.0f}원 넘었어요 — 초과분만 투자 대상",
        ))
    else:
        vetoed["isa"] = "버퍼 목표 미달 — 투자상품은 여윳돈 목표를 채운 뒤에만 후보가 돼요"

    # emergency — 신용상품: 여유 자금이 있으면 대출 권유는 부적합(역방향 veto).
    if invest_available <= 0:
        gap = f"다음 수입까지 약 {c.expected_gap_days:.0f}일 — " if c.expected_gap_days else ""
        candidates.append(Candidate(
            "emergency", CATALOG["emergency"], "spendable",
            f"{gap}공백 브릿지를 미리 열어둘 수 있어요 (쓰지 않으면 이자 0)",
        ))
    else:
        vetoed["emergency"] = "버퍼 목표 초과 여유가 있어요 — 신용상품 권유는 부적합"

    # irp — 장기 잠김: 여유가 있거나, 커리어 감속으로 노후 준비가 필요한 국면일 때만.
    if invest_available > 0 or c.early_decline:
        why = ("수주 흐름이 감속 추세 — 노후 준비를 시작할 국면이에요 (가뭄 달은 건너뛸 수 있어요)"
               if c.early_decline else "버퍼 목표를 채웠어요 — 세액공제 받으며 노후봉투를 시작할 수 있어요")
        candidates.append(Candidate("irp", CATALOG["irp"], "buffer", why))
    else:
        vetoed["irp"] = "장기 잠김 상품 — 버퍼 미달이고 감속 신호도 없어 아직 후보가 아니에요"

    return candidates, vetoed
