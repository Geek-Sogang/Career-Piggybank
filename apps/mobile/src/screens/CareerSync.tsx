import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { Icon, type IconName } from '@/components/Icon';
import { Mascot } from '@/components/ui';
import { Frame, Title, FlowHeader } from '@/components/flow';
import { useApp } from '@/store';

// 영상 [9] 초창기 · 이력 연동 온보딩 플로우.
// 토스식 진행형 UX: 한 화면 = 한 목적 = 한 액션. 여러 플랫폼에 흩어진 이력을
// 순차로 모아 → 요약 → 미인증 안내 → 맞춤 금융상품까지 한 흐름으로 잇는다.

type Step = 'intro' | 'scan' | 'summary' | 'unverified' | 'products';
const STEPS: Step[] = ['intro', 'scan', 'summary', 'unverified', 'products'];

// 순차 스캔 대상 — 흩어진 이력의 출처들
const SOURCES: { label: string; sub: string; icon: IconName; tint: string; color: string }[] = [
  { label: '입금 내역', sub: '은행 거래에서 정산 입금을 찾고 있어요', icon: 'download', tint: colors.greenTint, color: colors.green },
  { label: '세금지출 내역', sub: '홈택스 3.3% 신고소득을 대사하고 있어요', icon: 'building', tint: colors.bufferTint, color: colors.buffer },
  { label: 'KOSA · KODIA 인증서', sub: '협회 경력·기술등급을 확인하고 있어요', icon: 'shieldCheck', tint: colors.indigoTint, color: colors.indigo },
];

// 모아진 검증 이력 (계약금 포함)
const HISTORY: { name: string; memo: string; date: string; amount: number; kind: '정산' | '계약금' | '인증' }[] = [
  { name: '△△커머스', memo: '결제모듈 개발', date: '2025.05', amount: 3_300_000, kind: '정산' },
  { name: '㈜테크플로우', memo: 'API 연동 · 진행중', date: '2025.06', amount: 1_800_000, kind: '계약금' },
  { name: '○○스튜디오', memo: '브랜드 웹 리뉴얼', date: '2025.04', amount: 2_750_000, kind: '정산' },
  { name: '크몽', memo: '랜딩페이지 제작', date: '2025.03', amount: 900_000, kind: '정산' },
];

// 아직 인증 안 된 이력 — 추가 절차가 필요한 것들
const UNVERIFIED: { name: string; memo: string; need: string }[] = [
  { name: '개인 이체 입금 2건', memo: '계약금으로 추정돼요', need: '홈택스 신고내역 대사 필요' },
  { name: 'KOSA 경력 인증', memo: 'SW기술자 경력 3년차', need: 'KOSA 협회 경력 인증 필요' },
];

// 커리어로 누릴 수 있는 금융상품
const PRODUCTS: { name: string; sub: string; badge: string; tint: string; color: string }[] = [
  { name: '긱워커 비상금 대출', sub: '검증 이력 기반 · 최대 2,000만원', badge: '검증 연동', tint: colors.greenTint, color: colors.green },
  { name: '세금봉투 우대 파킹통장', sub: '5월 종소세 대비 · 우대금리 3.1%', badge: '세금 대비', tint: colors.bufferTint, color: colors.buffer },
  { name: '프리랜서 실손 케어', sub: '불규칙 소득 맞춤 · 월 1.2만원', badge: '맞춤', tint: colors.pinkTint, color: colors.pinkStrong },
];

const NAME = '조대흠';

export function CareerSync() {
  const { actions } = useApp();
  const [step, setStep] = useState<Step>('intro');
  const idx = STEPS.indexOf(step);
  const go = (s: Step) => setStep(s);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
      <FlowHeader total={STEPS.length} index={idx} onBack={actions.back} />

      {step === 'intro' && <Intro name={NAME} onStart={() => go('scan')} onLater={actions.back} />}
      {step === 'scan' && <Scan onDone={() => go('summary')} />}
      {step === 'summary' && <Summary name={NAME} onNext={() => go('unverified')} />}
      {step === 'unverified' && <Unverified onNow={() => go('products')} onLater={() => go('products')} />}
      {step === 'products' && <Products name={NAME} onDone={() => { actions.back(); actions.nav('home'); }} />}
    </SafeAreaView>
  );
}

// ── 1) 인트로 · 연동 제안 ──────────────────────────────────────────
function Intro({ name, onStart, onLater }: { name: string; onStart: () => void; onLater: () => void }) {
  return (
    <Frame cta="이력 연동 시작하기" secondary="다음에 할게요" onCta={onStart} onSecondary={onLater}>
      <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 12 }}>
        <Mascot head size={120} radius={34} />
      </View>
      <Title
        title={`첫 방문이시네요, ${name}님!\n흩어진 이력을 모아드릴까요?`}
        sub="여러 플랫폼에 흩어진 정산·세금·경력 이력을 한 번에 모아, 금융 신뢰로 바꿔드려요."
      />
      <View style={{ gap: 10 }}>
        {SOURCES.map((s) => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.bg, borderRadius: 14, padding: 14 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: s.tint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={s.icon} size={21} color={s.color} />
            </View>
            <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{s.label}</Text>
          </View>
        ))}
      </View>
    </Frame>
  );
}

// ── 2) 순차 스캔 · 로딩→체크 ───────────────────────────────────────
function Scan({ onDone }: { onDone: () => void }) {
  const [done, setDone] = useState(0); // 완료된 소스 수. done번째가 현재 로딩 중.

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    SOURCES.forEach((_, i) => timers.push(setTimeout(() => setDone(i + 1), 1100 * (i + 1))));
    timers.push(setTimeout(onDone, 1100 * SOURCES.length + 900));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8 }}>
      <Title title={'이력을 모으고 있어요'} sub="잠시만 기다려 주세요. 플랫폼마다 확인하고 있어요." />
      <View style={{ gap: 12 }}>
        {SOURCES.map((s, i) => {
          const state = i < done ? 'done' : i === done ? 'loading' : 'wait';
          return (
            <View
              key={s.label}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 13,
                backgroundColor: state === 'wait' ? colors.bg : '#fff',
                borderWidth: 1.4, borderColor: state === 'done' ? colors.greenLine : state === 'loading' ? colors.green : colors.line,
                borderRadius: 16, padding: 15, opacity: state === 'wait' ? 0.5 : 1,
              }}
            >
              <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: s.tint, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={s.icon} size={22} color={s.color} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{s.label}</Text>
                <Text style={{ fontSize: 12, fontWeight: '500', color: colors.sub2, marginTop: 2 }}>
                  {state === 'done' ? '확인 완료' : state === 'loading' ? s.sub : '대기 중'}
                </Text>
              </View>
              {state === 'done' ? (
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={15} color="#fff" sw={2.6} />
                </View>
              ) : state === 'loading' ? (
                <ActivityIndicator size="small" color={colors.green} />
              ) : (
                <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.6, borderColor: colors.line }} />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── 3) 이력 요약 ───────────────────────────────────────────────────
function Summary({ name, onNext }: { name: string; onNext: () => void }) {
  const total = HISTORY.filter((h) => h.amount > 0).reduce((a, h) => a + h.amount, 0);
  const kindStyle = (k: string) =>
    k === '계약금' ? { c: colors.orange, bg: colors.orangeTint } : k === '인증' ? { c: colors.indigo, bg: colors.indigoTint } : { c: colors.green, bg: colors.greenTint };
  return (
    <Frame cta="다음" onCta={onNext}>
      <Title kicker={`${HISTORY.length}건을 찾았어요`} title={`${name}님의 이력은\n다음과 같아요!`} />
      <View style={{ backgroundColor: colors.green, borderRadius: 18, padding: 18, marginBottom: 16 }}>
        <Text style={{ fontSize: 12.5, fontWeight: '500', color: 'rgba(255,255,255,.82)' }}>모아진 정산 이력 합계</Text>
        <Text style={{ fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.8, marginTop: 4, fontVariant: ['tabular-nums'] }}>
          ₩{total.toLocaleString('en-US')}
        </Text>
      </View>
      <View style={{ gap: 10 }}>
        {HISTORY.map((h) => {
          const ks = kindStyle(h.kind);
          return (
            <View key={h.name + h.memo} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14 }}>
              <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: ks.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: ks.c }}>{h.name.replace(/[△○㈜]/g, '').slice(0, 1) || h.name.slice(0, 1)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{h.name} · {h.memo}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: ks.c, backgroundColor: ks.bg, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6, overflow: 'hidden' }}>{h.kind}</Text>
                  <Text style={{ fontSize: 11.5, fontWeight: '500', color: colors.sub2 }}>{h.date}</Text>
                </View>
              </View>
              {h.amount > 0 ? (
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>₩{h.amount.toLocaleString('en-US')}</Text>
              ) : (
                <Icon name="shieldCheck" size={20} color={colors.indigo} />
              )}
            </View>
          );
        })}
      </View>
    </Frame>
  );
}

// ── 4) 미인증 안내 ─────────────────────────────────────────────────
function Unverified({ onNow, onLater }: { onNow: () => void; onLater: () => void }) {
  return (
    <Frame cta="지금 인증하기" ctaSub="추가 절차는 1~2분이면 끝나요" secondary="다음에 하기" onCta={onNow} onSecondary={onLater}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.orangeTint, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.orange }}>!</Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.orange }}>{UNVERIFIED.length}건이 아직 인증 전이에요</Text>
      </View>
      <Title title={'조금만 더 하면\n인증이 완료돼요'} sub="아래 이력은 몇 가지 추가 절차를 완료하면 검증 이력으로 인정돼요." />
      <View style={{ gap: 12 }}>
        {UNVERIFIED.map((u) => (
          <View key={u.name} style={{ borderWidth: 1.4, borderColor: colors.orangeTint, backgroundColor: '#FFFCF8', borderRadius: 16, padding: 15 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{u.name}</Text>
              <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.orange, backgroundColor: colors.orangeTint, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 7, overflow: 'hidden' }}>인증 전</Text>
            </View>
            <Text style={{ fontSize: 12.5, fontWeight: '500', color: colors.sub2, marginTop: 4 }}>{u.memo}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, borderTopWidth: 1, borderTopColor: colors.line2, paddingTop: 10 }}>
              <Icon name="arrowRight" size={15} color={colors.orange} sw={2.2} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.orange }}>{u.need}</Text>
            </View>
          </View>
        ))}
      </View>
    </Frame>
  );
}

// ── 5) 맞춤 금융상품 ───────────────────────────────────────────────
function Products({ name, onDone }: { name: string; onDone: () => void }) {
  return (
    <Frame cta="시작하기" onCta={onDone}>
      <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
        <Mascot head size={88} radius={26} />
      </View>
      <Title kicker="검증된 커리어로 열린 혜택" title={`${name}님의 커리어로\n누릴 수 있는 상품이에요`} />
      <View style={{ gap: 12 }}>
        {PRODUCTS.map((p) => (
          <View key={p.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 15 }}>
            <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: p.tint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="cardPig" size={22} color={p.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{p.name}</Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '500', color: colors.sub2, marginTop: 3 }}>{p.sub}</Text>
            </View>
            <Text style={{ fontSize: 10, fontWeight: '800', color: p.color, backgroundColor: p.tint, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7, overflow: 'hidden' }}>{p.badge}</Text>
          </View>
        ))}
      </View>
    </Frame>
  );
}
