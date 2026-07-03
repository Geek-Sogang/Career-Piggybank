import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { JobKey } from '@/jobs';
import type { ProductKey } from '@/products';

export type Tab = 'home' | 'piggy' | 'ledger' | 'my';
export type Push = null | 'connect' | 'verifiedDetail' | 'tax' | 'retirement' | 'dataSovereignty' | 'products' | 'settings' | 'nestEgg' | 'chat' | 'lockscreen' | 'txDetail' | 'productDetail' | 'emptyState';
export type Sheet = null | 'consent' | 'invest' | 'allocation';
export type Scenario = 'cons' | 'base' | 'opt';
export type ConnSrc = 'github' | 'mydata' | 'hometax' | 'behance' | 'portfolio';
type Conn = Record<ConnSrc, boolean>;

const VAL: Record<ConnSrc, number> = { github: 500000, mydata: 1200000, hometax: 700000, behance: 400000, portfolio: 300000 };
const SCORE_VAL: Record<ConnSrc, number> = { github: 30, mydata: 50, hometax: 40, behance: 30, portfolio: 20 };
const BASE_SCORE = 320;
const AGE_KR = ['영', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'] as const;
const STAGE_MAP = { 잠정: ['#6B7280', '#F1F2F4'], 준검증: ['#0091C7', '#E7F4FB'], 확정: ['#008485', '#E8F4F4'] } as const;
const SC = {
  cons: ['2044 ~ 2047', 0.74, 0.12, '보수적 가정'],
  base: ['2041 ~ 2044', 0.63, 0.11, '기본 가정'],
  opt: ['2039 ~ 2041', 0.56, 0.08, '낙관 가정'],
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
  const [conn, setConn] = useState<Conn>({ github: false, mydata: false, hometax: false, behance: false, portfolio: false });
  const [scenario, setScenario] = useState<Scenario>('base');
  const [detail, setDetail] = useState<JobKey>('commerce');
  const [product, setProduct] = useState<ProductKey>('emergency');
  const [flash, setFlash] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fl = (t: string) => {
    setFlash(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(null), 1900);
  };
  const apply = (src: ConnSrc, on: boolean) => {
    setConn((c) => ({ ...c, [src]: on }));
    if (on) fl(`+${SCORE_VAL[src]}점`);
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
    closeSheet: () => setSheet(null),
    confirm: () => { apply('mydata', true); setSheet(null); },
    scen: (s: Scenario) => setScenario(s),
    toggle,
  };

  const vals = useMemo(() => {
    const c = conn;
    const limit = (Object.keys(VAL) as ConnSrc[]).reduce((a, k) => a + (c[k] ? VAL[k] : 0), 0);
    const score = BASE_SCORE + (Object.keys(SCORE_VAL) as ConnSrc[]).reduce((a, k) => a + (c[k] ? SCORE_VAL[k] : 0), 0);
    const ageIdx = Math.min(Math.floor(score / 100), AGE_KR.length - 1);
    const nextIdx = Math.min(ageIdx + 1, AGE_KR.length - 1);
    const toNext = 100 - (score % 100);
    const scr = push || tab;
    const cnt = Object.values(c).filter(Boolean).length;
    const stage: keyof typeof STAGE_MAP = c.hometax ? '확정' : cnt >= 2 ? '준검증' : '잠정';
    const sc = SC[scenario];
    return {
      scr, conn: c, limit, stage, score, toNext, ageLabel: `${AGE_KR[ageIdx]} 살`, nextAgeLabel: `${AGE_KR[nextIdx]} 살`,
      stageColor: STAGE_MAP[stage][0], stageBg: STAGE_MAP[stage][1],
      limitWon: limit.toLocaleString('en-US'),
      scLabel: sc[0] as string, scLeft: sc[1] as number, scWidth: sc[2] as number, scSub: sc[3] as string,
      tabTitle: ({ piggy: '저금통', ledger: '가계부', my: '마이' } as Record<string, string>)[tab] || '',
      headerTitle: ({ connect: '커리어 연결하기', verifiedDetail: '검증 상세', tax: '자동 봉투', retirement: '은퇴 곡선', dataSovereignty: '데이터 주권', products: '상품 연결', settings: '알림 · 설정', nestEgg: '노후 준비', txDetail: '거래 상세', productDetail: '상품 상세', emptyState: '저금통 (빈 상태)' } as Record<string, string>)[push || ''] || '',
      showGreeting: !push && tab === 'home',
      showTabTitle: !push && tab !== 'home',
      showBackHdr: !!push,
    };
  }, [conn, push, tab, scenario]);

  return { entered, tab, push, sheet, scenario, detail, product, flash, vals, actions };
}

export function AppProvider({ children, startTab = 'home' }: { children: ReactNode; startTab?: Tab }) {
  const value = useAppState(startTab);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
