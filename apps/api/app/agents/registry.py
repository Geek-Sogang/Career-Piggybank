"""에이전트 로스터 — 팀 명단을 코드에 선언한다 (GET /v1/agents로 라이브 조회).

각 항목은 base.AgentSpec 계약을 통과해야 한다: 역할 하나 · 가드레일 ≥1 · 결정론 폴백.
implemented 플래그는 정직 표기 — 예정(PR B~D)을 구현으로 부풀리지 않는다.

번호는 아키텍처 문서와 1:1: ①분류 배심원단 ②해소 질문 ③이벤트 파서 ④프로필 판독
⑤a 봉투 추천 ⑤b 금액 페이싱 ⑥상품 매칭 ⑦강점 선택 ⑧인텐트 라우터 ⑨피기 발화(유일한 입).
"""
from __future__ import annotations

from app.agents.base import AgentSpec

_ROSTER: tuple[AgentSpec, ...] = (
    AgentSpec(
        id="classifier_jury",
        label="① 분류 배심원단",
        specialty="룰이 unknown으로 넘긴 거래가 무엇인지(매출·경비·생활) 판정한다",
        output="라벨 + 확신도 + 근거 신호",
        model="EXAONE 2.4B ×3 관점(세무·심사·동료) + 판정, temp 0",
        cadence="매 거래 — 룰 캐스케이드가 못 정한 건만",
        guardrails=(
            "income 판정은 자동 반영 금지 — 확인 후에만 배분 시작",
            "고액(100만원↑)은 판정과 무관하게 직접 확인 요청",
            "배심 합의 실패 = needs_review로 사람에게",
        ),
        fallback="룰 캐스케이드(classifier) 결과 유지",
        module="app.services.classifier_llm",
        implemented=True,
    ),
    AgentSpec(
        id="clarify",
        label="② 해소 질문",
        specialty="확신 없는 거래에 대해 해소에 필요한 단 하나의 질문을 만든다",
        output="질문 1개(60자·물음표) — 선택지는 코드가 결정",
        model="EXAONE 2.4B, temp 0",
        cadence="needs_review 거래 발생 시",
        guardrails=(
            "질문 속 숫자는 거래 컨텍스트 접지 검증 통과분만",
            "답변 선택지는 코드가 결정론으로 고정 — 에이전트는 질문만",
        ),
        fallback="결정론 질문 템플릿",
        module="app.services.clarify",
        implemented=True,
    ),
    AgentSpec(
        id="event_parser",
        label="③ 이벤트 파서",
        specialty="대화 문장에서 예정 수입 하나를 구조화한다",
        output="ExpectedEvent(date, amount, label) 또는 없음",
        model="EXAONE 2.4B, temp 0, format=json",
        cadence="코치 챗 메시지마다 — 답변 전에 먼저",
        guardrails=(
            "금액은 메시지의 숫자에서만(×10^k 환산 허용) — 지어낸 금액 폐기",
            "날짜는 미래 1년 이내만 · 달 경계 산수는 달력이 교정",
            "파싱은 '표시'일 뿐 — 돈은 움직이지 않는다",
        ),
        fallback="조용한 무시(이벤트 없음) — 예측은 원장 통계로",
        module="app.services.event_capture",
        implemented=True,
    ),
    AgentSpec(
        id="profile_read",
        label="④ 프로필 판독",
        specialty="팩트시트를 성향 축값(위험감내·시간선호·자기통제·계획성)으로 판독한다",
        output="축당 값(0~1) + 근거 팩트 ID + 이유 한 줄",
        model="EXAONE 7.8B — 축당 1회 호출, 극성표 먼저 (2.4B 실측 탈락)",
        cadence="스냅샷 재계산 시(온보딩·신규 거래 누적·소득 패턴 변화) — 입금 핫패스 아님",
        guardrails=(
            "접지 게이트 — 인용한 팩트가 실존해야 채택, 지어낸 근거는 폐기",
            "극성 게이트 — 방향(올림/내림)이 참고구간과 맞는지 결정론 검증",
            "골든셋 게이트 — 대비쌍 순서를 못 맞추는 축은 출시하지 않는다",
        ),
        fallback="해당 축 중립 0.5 + 직군 프리셋 블렌드",
        module="app.agents.profile_read",
        implemented=True,
        pr="PR B",
    ),
    AgentSpec(
        id="envelope_recommend",
        label="⑤a 봉투 추천",
        specialty="이 사람에게 필요한 목표 봉투가 무엇인지 추천한다",
        output="봉투 후보(이름·왜) + 근거(프로필 팩트·peer) — 개설은 사람이",
        model="EXAONE 7.8B",
        cadence="온보딩·소득 패턴 변화 시에만 — 매 입금 아님",
        guardrails=(
            "잠긴 prefix(세금·경비)는 추천 대상이 아님 — 법·사실은 불가침",
            "근거 인용 — 어느 팩트(또는 peer 통계) 때문인지 대야 채택",
            "직군→봉투 하드코딩 표 금지 — 직군은 팩트 무게만 바꾼다",
            "개설·삭제는 사람 승인",
        ),
        fallback="기본 봉투 세트(여윳돈 버퍼)만 유지",
        module="app.agents.envelope_recommend",
        implemented=True,
        pr="PR C",
    ),
    AgentSpec(
        id="amount_pacing",
        label="⑤b 금액 페이싱",
        specialty="이번 입금에서 봉투별 배분의 우선순위·속도를 판정한다",
        output="봉투 우선순위 + 페이싱 스탠스(보기 중 선택) — 원화는 순차 배분이 번역",
        model="EXAONE 7.8B — 번호만 선택",
        cadence="매 입금마다",
        guardrails=(
            "원화·합계는 만들지 않는다 — 순차 배분(합계=입금 보존)이 번역",
            "MC 안전범위 클램프 — 가뭄 버퍼가 목표 저축보다 먼저 보호",
            "제안까지만 — 잔액 이동은 사람 승인 후(확인 게이트)",
        ),
        fallback="산수 페이싱(목표금액 ÷ 남은 기간) + 컨텍스트 룰",
        module="app.agents.amount_pacing",
        implemented=True,
        pr="PR C",
    ),
    AgentSpec(
        id="product_match",
        label="⑥ 상품 매칭",
        specialty="적합성 veto를 통과한 하나 상품 후보 중 이 사람에게 맞는 것을 고른다",
        output="상품 매칭 최대 2개(상품·근거 팩트·한 줄) — 가입은 사람이",
        model="EXAONE 7.8B — 후보 메뉴에서만 선택, 근거 팩트 ID 인용",
        cadence="명시 요청·페르소나 갱신 시 (핫패스 아님 — 입금 즉시 훅은 룰이 담당)",
        guardrails=(
            "적합성 veto 선행 — 부적합 상품은 메뉴에 없어 AI가 고를 수 없다 (결정론)",
            "접지 게이트 — 근거 팩트 ID 없는 매칭은 폐기",
            "숫자 게이트 — 지어낸 숫자 문구는 결정론 템플릿으로 교체",
            "심사·한도 개인화 금지 — 배분·추천·경험까지만",
        ),
        fallback="후보 상위 2개 + 결정론 문구 (룰) — 핫패스 훅은 hooks_for 룰 유지",
        module="app.agents.product_match",
        implemented=True,
        notes=("후보=services/product_match.eligible(veto), 선택=이 에이전트, 트리거=POST /v1/products/match",),
    ),
    AgentSpec(
        id="strength_pick",
        label="⑦ 강점 선택",
        specialty="결정론 후보 문장 중 이 사람의 강점 한 줄을 고른다",
        output="선택된 문장 번호 + 이유 — 재작성 없음",
        model="EXAONE 7.8B — 번호만 선택",
        cadence="검증 이력 갱신 시",
        guardrails=(
            "재작성 금지 — 후보는 결정론이 만들고 에이전트는 번호만",
        ),
        fallback="우선순위 룰로 첫 후보",
        module="app.services.strength",
        implemented=True,
    ),
    AgentSpec(
        id="intent_router",
        label="⑧ 인텐트 라우터",
        specialty="사용자 발화를 어느 처리기(파서·조정·태그·Q&A)로 보낼지 분기한다",
        output="인텐트 라벨 하나 — 실행은 각 엔진과 사람",
        model="룰 우선 → EXAONE 2.4B 폴백 (분류기 캐스케이드 패턴)",
        cadence="코치 챗 메시지마다",
        guardrails=(
            "분기만 한다 — 라우팅된 처리(조정·태그)도 사람 승인 게이트를 거친다",
        ),
        fallback="Q&A(코치 답변)로",
        module="app.agents.intent_router",
        implemented=False,
        pr="PR D",
    ),
    AgentSpec(
        id="piggy_voice",
        label="⑨ 피기 발화",
        specialty="어젠다 이벤트와 라우팅 결과를 사용자에게 닿는 문장으로 만든다",
        output="선발화·질문·브리핑 문장 — 시스템의 유일한 입",
        model="EXAONE 7.8B, temp 0.4",
        cadence="어젠다 이벤트 발생·사용자 질문 시",
        guardrails=(
            "숫자검증기 — 컨텍스트에 없는 3자리↑ 금액은 발화 차단",
            "트리아지(무엇을 먼저·무엇을 묶어·무엇을 침묵)는 코드 룰",
        ),
        fallback="근거(reasons) 결정론 나열 — LLM이 죽어도 데모가 산다",
        module="app.services.coach",
        implemented=True,
        is_mouth=True,
    ),
)


def roster() -> tuple[AgentSpec, ...]:
    """전체 로스터 — 선언 순서 = 아키텍처 번호 순."""
    return _ROSTER


def get(agent_id: str) -> AgentSpec:
    for spec in _ROSTER:
        if spec.id == agent_id:
            return spec
    raise KeyError(agent_id)
