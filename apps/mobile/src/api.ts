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

export type CoachReply = { reply: string; source: 'llm' | 'fallback'; verified: boolean };
export function coachChat(message: string, context: object = DEMO_COACH_CONTEXT) {
  return post<CoachReply>('/v1/coach/chat', { message, context });
}

export type EnvelopeSplit = { tax: number; expense: number; spendable: number; buffer: number };
// 배분 → 하나 상품 훅 — 선택은 백엔드 룰, product_id는 products.ts ProductKey와 1:1
export type ProductHook = { product_id: string; envelope: string; name: string; line: string };
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
    composite_next: { source: string; label: string; expected_date: string; basis: string } | null;
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
