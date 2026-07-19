import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getCareerVerification, logBehavior, updateCareerVerification, type CareerVerification, type EnvelopeSplit } from '@/api';
import { colors } from '@/theme/colors';
import type { JobKey } from '@/jobs';
import type { ProductKey } from '@/products';

// 최근 입금 배분 이벤트 — 시트·피기 코치 챗·잠금화면 알림이 같은 사건을 이어 말한다
export type AllocNotice = { id?: string; deposit: number; windfall: number; split: EnvelopeSplit; reasons?: string[]; confirmed: boolean };

export type Tab = 'home' | 'ledger' | 'missions' | 'piggy' | 'future';
export type Push = null | 'connect' | 'jobProof' | 'verifiedDetail' | 'tax' | 'retirement' | 'dataSovereignty' | 'products' | 'settings' | 'nestEgg' | 'chat' | 'lockscreen' | 'txDetail' | 'productDetail' | 'emptyState' | 'scrapWrite' | 'my' | 'careerSync' | 'personaLedger' | 'envelopeSuggest' | 'transactions' | 'goals' | 'retirementDetail';
export type Sheet = null | 'consent' | 'invest' | 'allocation' | 'pacing';
export type Scenario = 'cons' | 'base' | 'opt';
export type ConnSrc = 'github' | 'mydata' | 'hometax' | 'kosa' | 'behance' | 'portfolio';
type Conn = Record<ConnSrc, boolean>;

export const CAREER_SCORE_VALUES: Record<ConnSrc, number> = { github: 30, mydata: 50, hometax: 40, kosa: 35, behance: 30, portfolio: 20 };
// 커리어 검증 점수 = 검증 실적 + 외부 연결 소스. 금융상품 한도와는 분리된 평판 신호다.
const STAGE_MAP = { 잠정: [colors.sub, colors.line2], 준검증: [colors.buffer, colors.bufferTint], 확정: [colors.green, colors.greenTint] } as const;
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
  const [entered, setEntered] = useState(false); // 배포 기본 = 인트로(온보딩)부터. 건너뛰기가 개발 진입 지름길
  const [tab, setTab] = useState<Tab>(startTab);
  const [push, setPush] = useState<Push>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [conn, setConn] = useState<Conn>({ github: false, mydata: false, hometax: false, kosa: false, behance: false, portfolio: false });
  const [scenario, setScenario] = useState<Scenario>('base');
  const [detail, setDetail] = useState<JobKey>('commerce');
  const [plStart, setPlStart] = useState<'connect' | 'onboard' | 'deposit' | 'review'>('connect');   // 페르소나 플로우 진입(홈=풀, 온보딩, 가계부=배분만, review=확정 배분 근거·재조정)
  const [retireTab, setRetireTab] = useState<'curve' | 'pension'>('curve');   // 은퇴 상세 초기 탭(미래 탭 연금 카드=바로 pension)
  const [csMode, setCsMode] = useState<'onboard' | 'browse'>('browse');       // 이력 연동 모드(첫 실행=이력 공개·확인→페르소나, 평시=승인·상품)
  const [careerReviewPending, setCareerReviewPending] = useState(false);     // 온보딩 이력은 커리어 탭에서 사람이 확인한 뒤에만 페르소나로 넘긴다
  const [backgroundPersonaEnabled, setBackgroundPersonaEnabled] = useState(false); // 건너뛰기 진입만 백그라운드 판독. 온보딩은 명시적 CTA 뒤 판독
  const [product, setProduct] = useState<ProductKey>('emergency');
  const [transactionsTab, setTransactionsTab] = useState<'verified' | 'unverified'>('verified');
  const [lastAlloc, setLastAlloc] = useState<AllocNotice | null>(null);
  const [pacingApplied, setPacingApplied] = useState<Record<string, number>>({}); // 목표봉투에 방금 담은 금액 오버레이(백엔드 나중에)
  const [verification, setVerification] = useState<Pick<CareerVerification, 'score' | 'stage' | 'review_connection' | 'verified' | 'piggybank'>>({
    score: 0,
    stage: '잠정',
    review_connection: {
      available: false, label: '검증자료 준비 중', basis: '연결된 자료가 아직 적어 검증 이력만 보여드려요',
    },
    verified: { count: 0, streak_months: 0, span_months: 0, recent: [] },
    piggybank: {
      xp: 0, work_xp: 0, mission_xp: 0, loop_xp: 0, daily_xp: 0,
      level: 1, level_title: '첫 동전', max_level: 10,
      current_threshold: 0, next_threshold: 80, xp_to_next: 80, progress: 0,
      completed_missions: 0, missions: [], daily_missions: [],
      phase: { key: 'quiet', label: '할 일 없는 날', message: '새 거래가 오면 필요한 미션만 열어요' },
      levels: [], reward_is_example: true,
    },
  });
  const [verificationHydrated, setVerificationHydrated] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshCareer = () => getCareerVerification()
    .then((v) => setVerification({
      score: v.score, stage: v.stage, review_connection: v.review_connection,
      verified: v.verified, piggybank: v.piggybank,
    }))
    .catch(() => {});

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
        setVerification({ score: v.score, stage: v.stage, review_connection: v.review_connection, verified: v.verified, piggybank: v.piggybank });
      })
      .catch(() => {})
      .finally(() => setVerificationHydrated(true));
    // 마운트 시점의 빈 conn은 서버 복원용 키 목록으로만 사용한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 연결 상태는 입력일 뿐, 점수·검증 단계·커리어 저금통 XP는 백엔드 결정론 응답을 표시한다.
  useEffect(() => {
    if (!verificationHydrated) return;
    const active = (Object.keys(conn) as ConnSrc[]).filter((src) => conn[src]);
    updateCareerVerification(active, 'developer')
      .then((v) => setVerification({ score: v.score, stage: v.stage, review_connection: v.review_connection, verified: v.verified, piggybank: v.piggybank }))
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
    enter: () => { setBackgroundPersonaEnabled(true); setEntered(true); },
    // 첫 실행 온보딩 — 인트로 '시작하기'에서 흩어진 이력 모으기로 바로 이어진다
    enterOnboarding: () => { setBackgroundPersonaEnabled(false); setCareerReviewPending(false); setEntered(true); setCsMode('onboard'); setPush('careerSync'); setSheet(null); },
    leave: () => { setBackgroundPersonaEnabled(false); setCareerReviewPending(false); setEntered(false); setPush(null); setTab('home'); },
    nav: (t: Tab) => { setTab(t); setPush(null); setSheet(null); },
    pushScr: (id: Exclude<Push, null>) => { setPush(id); setSheet(null); },
    openJob: (key: JobKey) => { setDetail(key); setPush('verifiedDetail'); setSheet(null); },
    openRetire: (t: 'curve' | 'pension') => { setRetireTab(t); setPush('retirementDetail'); setSheet(null); },
    // 페르소나→배분 플로우 — 홈 미션·온보딩은 연결 화면부터(온보딩은 공개 후 홈 착지), 가계부 입금 카드는 배분만
    openAllocFlow: (start: 'connect' | 'onboard' | 'deposit' | 'review') => { setPlStart(start); setPush('personaLedger'); setSheet(null); },
    // 이력 연동 — 평시 진입(browse: 승인·상품 포함). 온보딩 진입은 enterOnboarding이 담당.
    openCareerSync: () => { setCsMode('browse'); setPush('careerSync'); setSheet(null); },
    // 온보딩에서 모은 이력을 커리어 탭에 먼저 공개하고, 사용자 확인 뒤에만 페르소나 판독 화면을 연다.
    reviewCareerHistory: () => { setCareerReviewPending(true); setTab('piggy'); setPush(null); setSheet(null); },
    confirmCareerHistory: () => { setCareerReviewPending(false); setPlStart('onboard'); setPush('personaLedger'); setSheet(null); },
    // 온보딩 플로우의 일괄 연결 — 개별 연결과 같은 경로(점수 반영 + F13 계측)
    connectSources: (srcs: ConnSrc[]) => srcs.forEach((s) => apply(s, true)),
    openProduct: (key: ProductKey) => { setProduct(key); setPush('productDetail'); setSheet(null); },
    openTransactions: (initialTab: 'verified' | 'unverified' = 'verified') => {
      setTransactionsTab(initialTab); setPush('transactions'); setSheet(null);
    },
    back: () => setPush(null),
    openSheet: (s: Exclude<Sheet, null>) => setSheet(s),
    noteAllocation: (n: AllocNotice) => setLastAlloc(n),
    markAllocConfirmed: () => {
      setLastAlloc((p) => (p ? { ...p, confirmed: true } : p));
      refreshCareer();
    },
    refreshCareer,
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
    const scr = push || tab;
    const stage: keyof typeof STAGE_MAP = verification.stage;
    const sc = SC[scenario];
    return {
      scr, conn: c, stage, score,
      verified: verification.verified,
      piggybank: verification.piggybank,
      reviewReady: verification.review_connection.available,
      reviewLabel: verification.review_connection.label,
      reviewBasis: verification.review_connection.basis,
      stageColor: STAGE_MAP[stage][0], stageBg: STAGE_MAP[stage][1],
      scLabel: sc[0] as string, scLeft: sc[1] as number, scWidth: sc[2] as number, scSub: sc[3] as string,
      tabTitle: ({ ledger: '가계부', missions: '미션', piggy: '커리어', future: '미래' } as Record<string, string>)[tab] || '',
      headerTitle: ({ connect: '커리어 연결하기', jobProof: '일감 증명', verifiedDetail: '검증 상세', tax: '자동 봉투', retirement: '미래 소득 · 은퇴', dataSovereignty: '데이터 주권', products: '상품 연결', settings: '알림 · 설정', nestEgg: '노후 준비', txDetail: '거래 상세', productDetail: '상품 상세', emptyState: '커리어 (빈 상태)', scrapWrite: '커리어 조각 저금', my: '마이', transactions: '거래 내역', goals: '목표 봉투', retirementDetail: '미래 소득 · 은퇴' } as Record<string, string>)[push || ''] || '',
      showGreeting: !push && tab === 'home',
      showTabTitle: !push && tab !== 'home',
      showBackHdr: !!push,
    };
  }, [conn, push, tab, scenario, verification]);

  return { entered, tab, push, sheet, scenario, detail, product, transactionsTab, plStart, csMode, careerReviewPending, backgroundPersonaEnabled, retireTab, lastAlloc, pacingApplied, flash, vals, actions };
}

export function AppProvider({ children, startTab = 'home' }: { children: ReactNode; startTab?: Tab }) {
  const value = useAppState(startTab);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
