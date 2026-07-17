import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getCareerVerification, logBehavior, updateCareerVerification, type CareerVerification, type EnvelopeSplit } from '@/api';
import type { JobKey } from '@/jobs';
import type { ProductKey } from '@/products';

// 최근 입금 배분 이벤트 — 시트·피기 코치 챗·잠금화면 알림이 같은 사건을 이어 말한다
export type AllocNotice = { id?: string; deposit: number; windfall: number; split: EnvelopeSplit; reasons?: string[]; confirmed: boolean };

export type Tab = 'home' | 'piggy' | 'ledger' | 'my';
export type Push = null | 'connect' | 'verifiedDetail' | 'tax' | 'retirement' | 'dataSovereignty' | 'products' | 'settings' | 'nestEgg' | 'chat' | 'lockscreen' | 'txDetail' | 'productDetail' | 'emptyState';
export type Sheet = null | 'consent' | 'invest' | 'allocation' | 'pacing';
export type Scenario = 'cons' | 'base' | 'opt';
export type ConnSrc = 'github' | 'mydata' | 'hometax' | 'kosa' | 'behance' | 'portfolio';
type Conn = Record<ConnSrc, boolean>;

// 검증된 이력(원장 실적) — 저금통 '검증된 이력' 카드와 점수 산정이 같은 수치를 쓴다(SSOT)
export const VERIFIED = { count: 12, streakMonths: 8, spanMonths: 30 };
export const CAREER_SCORE_VALUES: Record<ConnSrc, number> = { github: 30, mydata: 50, hometax: 40, kosa: 35, behance: 30, portfolio: 20 };
// 커리어 점수 = 검증 실적 + 연결 소스. 장식 숫자가 아니라 검증 한도 산정의 입력.
// 실적 점수: 검증건수×10 + 연속활동(개월)×10 + 거래기간(개월)×4 = 320
const HISTORY_SCORE = VERIFIED.count * 10 + VERIFIED.streakMonths * 10 + VERIFIED.spanMonths * 4;
const AGE_KR = ['영', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'] as const;
const STAGE_MAP = { 잠정: ['#6B7280', '#F1F2F4'], 준검증: ['#0091C7', '#E7F4FB'], 확정: ['#008485', '#E8F4F4'] } as const;
const SC = {
  cons: ['2039 ~ 2041', 0.56, 0.08, '소득 하방 가정'],
  base: ['2041 ~ 2044', 0.63, 0.11, '기준 소득 가정'],
  opt: ['2044 ~ 2047', 0.74, 0.12, '소득 상방 가정'],
} as const;

export type AppCtx = ReturnType<typeof useAppState>;
const Ctx = createContext<AppCtx | null>(null);
export const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp must be used within AppProvider');
  return c;
};

function useAppState(startTab: Tab = 'home') {
  const [entered, setEntered] = useState(true); // 기본은 앱부터(빠른 이터레이션). 인트로는 설정에서 재진입
  const [tab, setTab] = useState<Tab>(startTab);
  const [push, setPush] = useState<Push>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [conn, setConn] = useState<Conn>({ github: false, mydata: false, hometax: false, kosa: false, behance: false, portfolio: false });
  const [scenario, setScenario] = useState<Scenario>('base');
  const [detail, setDetail] = useState<JobKey>('commerce');
  const [product, setProduct] = useState<ProductKey>('emergency');
  const [lastAlloc, setLastAlloc] = useState<AllocNotice | null>(null);
  const [pacingApplied, setPacingApplied] = useState<Record<string, number>>({}); // 목표봉투에 방금 담은 금액 오버레이(백엔드 나중에)
  const [verification, setVerification] = useState<Pick<CareerVerification, 'score' | 'stage' | 'limit'>>({
    score: HISTORY_SCORE, stage: '잠정', limit: 600_000,
  });
  const [verificationHydrated, setVerificationHydrated] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fl = (t: string) => {
    setFlash(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(null), 1900);
  };
  // 앱 방문은 F14 데이터 품질·관측 리듬으로만 계측한다(계획성 방향에는 쓰지 않음).
  useEffect(() => { logBehavior('app_opened'); }, []);
  // 새로고침에서도 마지막 검증 상태를 복원한다. 복원 전 빈 로컬 상태를 POST해 서버 값을
  // 덮지 않도록 hydration을 먼저 끝낸 뒤 아래 동기화 효과를 연다.
  useEffect(() => {
    getCareerVerification()
      .then((v) => {
        const restored = (Object.keys(conn) as ConnSrc[]).reduce<Conn>((acc, src) => {
          acc[src] = v.sources.includes(src);
          return acc;
        }, { github: false, mydata: false, hometax: false, kosa: false, behance: false, portfolio: false });
        setConn(restored);
        setVerification({ score: v.score, stage: v.stage, limit: v.limit });
      })
      .catch(() => {})
      .finally(() => setVerificationHydrated(true));
    // 마운트 시점의 빈 conn은 서버 복원용 키 목록으로만 사용한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 연결 상태는 입력일 뿐, 점수·검증 단계·금융상품 한도는 백엔드 결정론 응답을 표시한다.
  useEffect(() => {
    if (!verificationHydrated) return;
    const active = (Object.keys(conn) as ConnSrc[]).filter((src) => conn[src]);
    updateCareerVerification(active, 'developer')
      .then((v) => setVerification({ score: v.score, stage: v.stage, limit: v.limit }))
      .catch(() => {});
  }, [conn, verificationHydrated]);
  const apply = (src: ConnSrc, on: boolean) => {
    setConn((c) => ({ ...c, [src]: on }));
    if (on) {
      fl(`+${CAREER_SCORE_VALUES[src]}점`);
      logBehavior('source_connected', src);   // 스스로 소스를 연결 = 적극적 커리어 관리(F13)
    }
  };
  const toggle = (src: ConnSrc) => {
    const on = !conn[src];
    if (on && src === 'mydata') { setSheet('consent'); return; }
    apply(src, on);
  };

  const actions = {
    enter: () => setEntered(true),
    leave: () => { setEntered(false); setPush(null); setTab('home'); },
    nav: (t: Tab) => { setTab(t); setPush(null); setSheet(null); },
    pushScr: (id: Exclude<Push, null>) => { setPush(id); setSheet(null); },
    openJob: (key: JobKey) => { setDetail(key); setPush('verifiedDetail'); setSheet(null); },
    openProduct: (key: ProductKey) => { setProduct(key); setPush('productDetail'); setSheet(null); },
    back: () => setPush(null),
    openSheet: (s: Exclude<Sheet, null>) => setSheet(s),
    noteAllocation: (n: AllocNotice) => setLastAlloc(n),
    markAllocConfirmed: () => setLastAlloc((p) => (p ? { ...p, confirmed: true } : p)),
    // ⑤b는 백엔드 confirm이 잔액을 이동한다. 로컬에서는 이동 동선만 담당한다.
    applyPacing: (_deposits: Record<string, number>) => {
      setPacingApplied({});
      setTab('ledger'); setPush('tax'); setSheet(null);
    },
    closeSheet: () => setSheet(null),
    confirm: () => { apply('mydata', true); setSheet(null); },
    scen: (s: Scenario) => setScenario(s),
    toggle,
  };

  const vals = useMemo(() => {
    const c = conn;
    const score = verification.score;
    const ageIdx = Math.min(Math.floor(score / 100), AGE_KR.length - 1);
    const nextIdx = Math.min(ageIdx + 1, AGE_KR.length - 1);
    const toNext = 100 - (score % 100);
    const scr = push || tab;
    const stage: keyof typeof STAGE_MAP = verification.stage;
    const limit = verification.limit;
    const sc = SC[scenario];
    return {
      scr, conn: c, limit, stage, score, toNext, ageLabel: `${AGE_KR[ageIdx]} 살`, nextAgeLabel: `${AGE_KR[nextIdx]} 살`,
      stageColor: STAGE_MAP[stage][0], stageBg: STAGE_MAP[stage][1],
      limitWon: limit.toLocaleString('en-US'),
      limitManwon: Math.round(limit / 10_000),
      scLabel: sc[0] as string, scLeft: sc[1] as number, scWidth: sc[2] as number, scSub: sc[3] as string,
      tabTitle: ({ piggy: '커리어', ledger: '정산', my: '마이' } as Record<string, string>)[tab] || '',
      headerTitle: ({ connect: '커리어 연결하기', verifiedDetail: '검증 상세', tax: '자동 봉투', retirement: '미래 소득 · 은퇴', dataSovereignty: '데이터 주권', products: '상품 연결', settings: '알림 · 설정', nestEgg: '노후 준비', txDetail: '거래 상세', productDetail: '상품 상세', emptyState: '커리어 (빈 상태)' } as Record<string, string>)[push || ''] || '',
      showGreeting: !push && tab === 'home',
      showTabTitle: !push && tab !== 'home',
      showBackHdr: !!push,
    };
  }, [conn, push, tab, scenario, verification]);

  return { entered, tab, push, sheet, scenario, detail, product, lastAlloc, pacingApplied, flash, vals, actions };
}

export function AppProvider({ children, startTab = 'home' }: { children: ReactNode; startTab?: Tab }) {
  const value = useAppState(startTab);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
