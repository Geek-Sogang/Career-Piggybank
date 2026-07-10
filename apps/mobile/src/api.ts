// 백엔드(FastAPI) 클라이언트 — 데모: 로컬 서버(make api, :8000)
// iOS 시뮬레이터·웹 모두 호스트의 localhost로 접근 가능. 서버가 꺼져 있으면
// 각 호출부가 오프라인 폴백을 쓴다(데모가 죽지 않는 원칙).
const API_BASE = 'http://localhost:8000';

async function get<T>(path: string, timeoutMs = 10_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function post<T>(path: string, body: unknown, timeoutMs = 90_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// ── 데모 시나리오 데이터 (조대흠 페르소나 — 백엔드 골든 데모와 동일 수치) ──
export const DEMO_PROFILE = {
  annual_gross: 30_000_000,
  expected_monthly_expense: 400_000,
  expected_monthly_living: 1_200_000,
  income_cv: 0.4,
  avg_deposit: 800_000,
};

// 코치에게 주입하는 컨텍스트 — 숫자는 전부 결정론 엔진 출력(코치는 인용만)
export const DEMO_COACH_CONTEXT = {
  user: '조대흠 · 프리랜스 개발자 · 커리어 점수 320점(세 살)',
  profile: DEMO_PROFILE,
  envelopes: { tax: 320_000, expense: 400_000, spendable: 1_200_000, buffer: 99_555 },
  note: '5월 종소세 예상 1,090,000원 중 320,000원 준비됨',
};

export type CoachReply = {
  reply: string; source: 'llm' | 'fallback'; verified: boolean;
  // 대화에서 수집된 예정 수입(§6-2⑥) — 파싱만 LLM, 반영은 결정론(예측 스트림)
  captured_event?: { date: string; amount: number | null; label: string } | null;
};
export function coachChat(message: string, context: object = DEMO_COACH_CONTEXT) {
  return post<CoachReply>('/v1/coach/chat', { message, context });
}

export type EnvelopeSplit = { tax: number; expense: number; spendable: number; buffer: number };
// 배분 → 하나 상품 훅 — 선택은 백엔드 룰, product_id는 products.ts ProductKey와 1:1
export type ProductHook = { product_id: string; envelope: string; name: string; line: string };

// ⑥ 상품 매칭 (AI) — 핫패스 아님: 시트는 룰 훅을 즉시 보여주고, 이 호출이 돌아오면 승급.
// 후보는 적합성 veto(결정론)를 통과한 것만 — AI는 그 메뉴 안에서 고르고 근거 팩트를 인용.
export type ProductMatchPick = ProductHook & { evidence: string[]; source: 'llm' | 'rule' };
export function fetchProductMatch() {
  return post<{ matches: ProductMatchPick[]; persona_used: boolean; note: string }>(
    '/v1/products/match', {}, 60_000, // 로컬 7.8B 생성 대기
  );
}
export type Allocation = {
  id: string;
  status: 'proposed' | 'confirmed' | 'adjusted' | 'rejected';
  deposit: number;
  proposed: EnvelopeSplit;
  windfall_ratio: number;
  needs_confirmation: boolean;
  reasons: string[];
  product_hooks?: ProductHook[];
};

export function proposeAllocation(deposit: number, profile = DEMO_PROFILE) {
  return post<Allocation>('/v1/allocations/propose', { deposit, profile }, 15_000);
}

export function decideAllocation(id: string, action: 'confirm' | 'adjust' | 'reject', adjusted?: EnvelopeSplit) {
  return post<Allocation>(`/v1/allocations/${id}/decision`, { action, adjusted }, 15_000);
}

// 강점 한 줄 — 후보는 백엔드 결정론, LLM은 선택만 (§6-1 개인화 3종 ③)
export const DEMO_CAREER_FACTS = {
  verified_count: 12, months_active: 24, repeat_client_rate: 0.8,
  settlement_growth: 3.0, top_skill: 'React 커머스',
};
export type Strength = { line: string; chosen_by: 'llm' | 'fallback'; reason: string };
export function fetchStrength(facts = DEMO_CAREER_FACTS) {
  return post<Strength>('/v1/strength', facts, 120_000);
}

// ── 뱅크 (영속 원장·봉투) — 가계부 화면의 데이터 소스 ──
export type Txn = {
  id: string; date: string; amount: number; direction: 'in' | 'out';
  counterparty: string; memo: string; kind: string; subtype: string | null;
  confidence: number; needs_review: boolean; signals: string[];
};
export const DEMO_DEPOSIT = { date: '2025-05-27', amount: 3_000_000, counterparty: '△△플랫폼 정산', memo: '' };

export function getTransactions() {
  return get<Txn[]>('/v1/bank/transactions');
}
// 확인 질문 — AI가 확신 없을 때 코치가 던지는 해소 질문 (§6-2⑥). 탭 = 수기 태그와 1:1
export type Clarify = {
  question: string;
  options: { kind: 'income' | 'expense' | 'living'; label: string }[];
  source: 'llm' | 'fallback';
};
export function getClarify(txnId: string) {
  return get<Clarify>(`/v1/bank/transactions/${txnId}/clarify`, 90_000); // 로컬 LLM 생성 대기
}
export function bankDeposit(body = DEMO_DEPOSIT) {
  return post<{ transaction: Txn; allocation: Allocation | null; clarify: Clarify | null }>('/v1/bank/deposit', body, 15_000);
}
export function tagTransaction(id: string, kind: 'income' | 'expense' | 'living') {
  return post<{ transaction: Txn; learned: boolean; allocation: Allocation | null }>(
    `/v1/bank/transactions/${id}/tag`, { kind }, 15_000,
  );
}

// ── 페르소나 (④ 프로필 판독의 SSOT) — 판독은 명시 트리거만 (핫패스 아님) ──
export type PersonaAxis = {
  axis: string; label: string; value: number;
  evidence: string[]; reason: string; fallback: boolean; retried?: boolean;
};
export type Persona = {
  id: string;
  axes: Record<string, PersonaAxis>;
  staleness: { new_txns: number | null; stale: boolean | null; threshold: number } | null;
};
export function getPersona() {
  return get<Persona>('/v1/profile/persona'); // 404 = 아직 판독 전
}
// 긱워커 소득 프로필 — 결정론 구조 층(판독 전에도 항상 있음). 심리 4축과 구분되는 긱 특화.
export type GigProfile = {
  volatility: string; volatility_cv: number | null;
  concentration: string; top_source_share: number | null;
  rhythm: string; is_multi_gig: boolean; phase: string;
  archetype: string; notes: string[];
};
export function getGigProfile() {
  return get<GigProfile>('/v1/profile/gig');
}
export function readPersona() {
  return post<{ snapshot_id: string }>('/v1/profile/read?trigger=manual', {}, 300_000); // 축당 7.8B — 수십 초
}

// ── 목표 봉투 + 금액 페이싱 — 개설·확정은 사람, AI(⑤a 추천·⑤b 페이싱)는 판정까지만 ──
export type Goal = {
  id: string; name: string; target_amount: number; target_date: string | null;
  balance: number; status: string; source: string; seq: number;
};
export function getGoals() {
  return get<Goal[]>('/v1/envelopes/goals');
}
export function createGoal(name: string, target_amount: number, target_date: string | null) {
  return post<Goal>('/v1/envelopes/goals', { name, target_amount, target_date });
}
// ⑤a 봉투 추천(내 팩트, LLM) + 또래 추천(같은 직군·유사 페르소나의 개설 관찰, 결정론).
// 개설은 사용자가 탭해서 결정 — 개설하면 내 봉투가 또래 풀에 기여한다(카탈로그 성장)
export type EnvelopeIdea = { name: string; why: string; evidence: string[] };
export type PeerIdea = {
  name: string; suggested_amount: number; share: number; count: number;
  pool: number; scope: 'job' | 'all'; basis: string;
  months_to_reach: number | null; affordable_amount: number | null;
};
export function recommendEnvelopes() {
  return post<{ recommendations: EnvelopeIdea[]; peers: PeerIdea[]; persona_used: boolean }>(
    '/v1/envelopes/recommend', {}, 60_000, // 로컬 7.8B 생성 대기
  );
}
// ⑤b 금액 페이싱 — 판단(우선순위·스탠스)은 AI, 원화 번역은 산수, 실행은 confirm만
export type PacingProposal = {
  id: string; status: string; available: number;
  split: Record<string, number>;
  reasons: string[];
  judgment: { reason: string; fallback: boolean; evidence: string[]; stances: Record<string, string> };
  goals: { id: string; name: string; base: number; stance: string; amount: number }[];
  source: string;
};
export function proposePacing(available: number, today: string, source: 'deposit' | 'buffer') {
  return post<PacingProposal>('/v1/pacing/propose',
    { available, buffer_shortfall: 0, today, source }, 120_000); // 로컬 7.8B 판단 대기
}
export function decidePacing(id: string, action: 'confirm' | 'reject') {
  return post<{ id: string; status: string }>(`/v1/pacing/${id}/decision`, { action });
}
export function getEnvelopeBalances() {
  return get<{ balances: Record<string, number> }>('/v1/bank/envelopes');
}

// ── 벨 인박스 (어젠다 큐) — 피기가 아직 말하지 않은 사건의 트리아지. 발화문은 결정론 템플릿 ──
export type AgendaItem = { kind: string; priority: number; line: string };
export function getAgenda() {
  return get<{ items: AgendaItem[]; silent_count: number }>('/v1/coach/agenda');
}
export function consumeAgenda() {
  return post<{ consumed: number }>('/v1/coach/agenda/consume', {});
}

// ── 예측 (원장 시계열 → 다음 수입 창 + 은퇴 밴드) — 전부 결정론, 논문 근거는 백엔드 주석 ──
export type Forecast = {
  income_gap: { median_gap_days: number; expected_next_date: string; window: [string, string]; reasons: string[] };
  retirement: { scenario: 'cons' | 'base' | 'opt'; band_start_year: number; band_end_year: number; label: string }[];
  career_signals: { gap_ratio: number; client_ratio: number; ticket_ratio: number; career_trend: number; reasons: string[] };
  // 차트가 그대로 그리는 연도별 경로 — 곡선·신뢰구간 띠·정점 전부 이 좌표에서
  path: { years: number[]; base: number[]; lo: number[]; hi: number[]; peak_year: number; living_target: number };
  // 소득 물줄기 분해 — 분류 라벨(플랫폼·착수금)이 예측의 전처리가 된다
  streams: {
    platform_channels: number;
    repeat_clients: number;
    one_off_per_month: number;
    candidates: { source: string; label: string; expected_date: string; basis: string }[];
    pending_settlements: { counterparty: string; advance_date: string; advance_amount: number; expected_date: string; basis: string }[];
    // 지연된 계약 — 예측에서 제외되고 코치 질문으로 전환됨
    stale_settlements: { counterparty: string; advance_date: string; advance_amount: number; question: string }[];
    composite_next: { source: string; label: string; expected_date: string; basis: string } | null;
    reasons: string[];
  };
  // 부트스트랩 몬테카를로 — 미래 1,000개의 은퇴 해 분포 (seed 고정, 재현 가능)
  mc: { runs: number; band_start_year: number; median_year: number; band_end_year: number; prob_in_base_band: number };
  // 자금 달성형 은퇴(B) — "충분히 모아서 그만둘 수 있는 해". 저축이 예측을 움직인다.
  // A(위 retirement — 일감 흐름 소멸)와 병행: 서로 다른 질문에 답하므로 둘 다 보여준다.
  funded: {
    target: number;             // 은퇴 넘버 = 연 생활비 ÷ 4% (25배)
    funded_year: number;
    reached: boolean;
    annual_surplus0: number;    // 첫 해 저축 여력 — 0이면 저축 불가(정직 표기)
    mc_p10: number; mc_median: number; mc_p90: number;
    years: number[]; savings_path: number[];
    reasons: string[];
  };
  monthly_income_level: number;
  income_cv: number;
};
export function getForecast() {
  return get<Forecast>('/v1/forecast');
}

// 서버 다운 시 오프라인 폴백 제안 (백엔드 라이브 결과와 동일 수치)
export const OFFLINE_ALLOCATION: Allocation = {
  id: 'offline',
  status: 'proposed',
  deposit: 3_000_000,
  proposed: { tax: 108_900, expense: 400_000, spendable: 1_200_000, buffer: 1_291_100 },
  windfall_ratio: 3.75,
  needs_confirmation: true,
  reasons: [
    '세금봉투 108,900원: 실효 추가세율 3.6%를 먼저 떼어 5월 종소세에 대비해요',
    '경비봉투 400,000원: 이번 달 예상 경비를 채워요',
    '즉시가용 1,200,000원: 이번 달 생활비까지 채워요',
    '여윳돈 1,291,100원: 소득 변동에 대비해 버퍼 목표까지 더 모아요',
    '이번 입금은 평소(800,000원)의 3.8배 — 코치가 확인을 요청해요',
  ],
  product_hooks: [
    {
      product_id: 'parking', envelope: 'tax', name: '하나 긱워커 파킹통장',
      line: '세금봉투 108,900원은 하나 긱워커 파킹통장(연 3.0%)에 두면 5월 종소세 때까지 이자가 붙어요',
    },
  ],
};
