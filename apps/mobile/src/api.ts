// 백엔드(FastAPI) 클라이언트 — 데모: 로컬 서버(make api, :8000)
// iOS 시뮬레이터·웹 모두 호스트의 localhost로 접근 가능. 서버가 꺼져 있으면
// 각 호출부가 오프라인 폴백을 쓴다(데모가 죽지 않는 원칙).
const API_BASE = 'http://localhost:8000';

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

// ── 데모 시나리오 데이터 (김도현 페르소나 — 백엔드 골든 데모와 동일 수치) ──
export const DEMO_PROFILE = {
  annual_gross: 30_000_000,
  expected_monthly_expense: 400_000,
  expected_monthly_living: 1_200_000,
  income_cv: 0.4,
  avg_deposit: 800_000,
};

// 코치에게 주입하는 컨텍스트 — 숫자는 전부 결정론 엔진 출력(코치는 인용만)
export const DEMO_COACH_CONTEXT = {
  user: '김도현 · 프리랜스 개발자 · 커리어 점수 320점(세 살)',
  profile: DEMO_PROFILE,
  envelopes: { tax: 320_000, expense: 400_000, spendable: 1_200_000, buffer: 99_555 },
  note: '5월 종소세 예상 1,090,000원 중 320,000원 준비됨',
};

export type CoachReply = { reply: string; source: 'llm' | 'fallback'; verified: boolean };
export function coachChat(message: string, context: object = DEMO_COACH_CONTEXT) {
  return post<CoachReply>('/v1/coach/chat', { message, context });
}

export type EnvelopeSplit = { tax: number; expense: number; spendable: number; buffer: number };
export type Allocation = {
  id: string;
  status: 'proposed' | 'confirmed' | 'adjusted' | 'rejected';
  deposit: number;
  proposed: EnvelopeSplit;
  windfall_ratio: number;
  needs_confirmation: boolean;
  reasons: string[];
};

export function proposeAllocation(deposit: number, profile = DEMO_PROFILE) {
  return post<Allocation>('/v1/allocations/propose', { deposit, profile }, 15_000);
}

export function decideAllocation(id: string, action: 'confirm' | 'adjust' | 'reject', adjusted?: EnvelopeSplit) {
  return post<Allocation>(`/v1/allocations/${id}/decision`, { action, adjusted }, 15_000);
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
};
