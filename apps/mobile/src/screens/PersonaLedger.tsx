import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { Icon, type IconName } from '@/components/Icon';
import { Mascot } from '@/components/ui';
import { Frame, Title, FlowHeader } from '@/components/flow';
import { useApp } from '@/store';

// 영상 [10] 완숙기1 · 페르소나 → 맞춤 가계부 → 봉투 배분.
// 타 가계부는 '지출'에 집중하지만 우리는 불규칙한 '소득'을 평탄화한다 —
// 입금 1건을 페르소나에 맞춰 4봉투(세금·지출·비상금·투자금)로 나눈다.

type Step = 'connect' | 'personaLoading' | 'persona' | 'ledgerLoading' | 'deposit' | 'ack' | 'allocation';
const DOT: Record<Step, number> = { connect: 0, personaLoading: 1, persona: 1, ledgerLoading: 2, deposit: 2, ack: 2, allocation: 3 };
const DOT_TOTAL = 4;

const NAME = '조대흠';
const DEPOSIT = 3_000_000;
const STEP = 100_000;

// 연결할 데이터 소스
const SOURCES: { label: string; sub: string; icon: IconName; tint: string; color: string }[] = [
  { label: '마이데이터', sub: '입출금 · 소득 흐름', icon: 'card', tint: colors.bufferTint, color: colors.buffer },
  { label: '커리어 정보', sub: '검증된 일감 이력', icon: 'shieldCheck', tint: colors.greenTint, color: colors.green },
  { label: '공공 정보', sub: '국세청 · 건강보험', icon: 'building', tint: colors.indigoTint, color: colors.indigo },
];

// 봉투 4종
type EnvKey = 'tax' | 'spending' | 'emergency' | 'invest';
const ENVS: { key: EnvKey; label: string; color: string; note: string }[] = [
  { key: 'tax', label: '세금봉투', color: colors.tax, note: '5월 종소세 대비 · 파킹통장' },
  { key: 'spending', label: '지출봉투', color: colors.expense, note: '이번 달 생활·경비' },
  { key: 'emergency', label: '비상금봉투', color: colors.buffer, note: '소득 공백 대비' },
  { key: 'invest', label: '투자금봉투', color: colors.indigo, note: '남는 돈은 투자로' },
];
const DEFAULT_ALLOC: Record<EnvKey, number> = { tax: 450_000, spending: 1_200_000, emergency: 750_000, invest: 600_000 };

export function PersonaLedger() {
  const { actions } = useApp();
  const [step, setStep] = useState<Step>('connect');
  const go = (s: Step) => setStep(s);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
      <FlowHeader total={DOT_TOTAL} index={DOT[step]} onBack={actions.back} />

      {step === 'connect' && <Connect onNext={() => go('personaLoading')} onBack={actions.back} />}
      {step === 'personaLoading' && <Loading title="페르소나를 만들고 있어요" sub="연결된 데이터를 읽어 나를 분석하고 있어요" onDone={() => go('persona')} />}
      {step === 'persona' && <Persona onNext={() => go('ledgerLoading')} />}
      {step === 'ledgerLoading' && <Loading title={`${NAME}님만을 위한\n가계부를 준비하고 있어요`} sub="소득 리듬에 맞춘 봉투를 설계하고 있어요" onDone={() => go('deposit')} />}
      {step === 'deposit' && <Deposit onYes={() => go('ack')} onNo={() => go('ack')} />}
      {step === 'ack' && <Ack onNext={() => go('allocation')} />}
      {step === 'allocation' && <Allocation onDone={() => { actions.back(); actions.nav('ledger'); }} />}
    </SafeAreaView>
  );
}

// ── 데이터 연결 ────────────────────────────────────────────────────
function Connect({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <Frame cta="연결하고 페르소나 만들기" secondary="다음에 할게요" onCta={onNext} onSecondary={onBack}>
      <Title title={'나를 이해하려면\n세 가지가 필요해요'} sub="마이데이터·커리어·공공 정보를 연결하면 나만을 위한 가계부를 만들어요." />
      <View style={{ gap: 10 }}>
        {SOURCES.map((s) => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.bg, borderRadius: 14, padding: 15 }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: s.tint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={s.icon} size={21} color={s.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{s.label}</Text>
              <Text style={{ fontSize: 12, fontWeight: '500', color: colors.sub2, marginTop: 2 }}>{s.sub}</Text>
            </View>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={14} color="#fff" sw={2.6} />
            </View>
          </View>
        ))}
      </View>
    </Frame>
  );
}

// ── 로딩(자동 진행) ────────────────────────────────────────────────
function Loading({ title, sub, onDone }: { title: string; sub: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingBottom: 60, gap: 20 }}>
      <Mascot head size={104} radius={30} />
      <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: -0.5, lineHeight: 28, color: colors.ink, textAlign: 'center' }}>{title}</Text>
      <ActivityIndicator size="small" color={colors.green} />
      <Text style={{ fontSize: 13, fontWeight: '500', color: colors.sub2, textAlign: 'center' }}>{sub}</Text>
    </View>
  );
}

// ── 페르소나 공개 ──────────────────────────────────────────────────
function Persona({ onNext }: { onNext: () => void }) {
  const traits = ['월 2~3건 정산 리듬', '계약금 + 잔금 구조', '종소세 관리 필요'];
  return (
    <Frame cta="맞춤 가계부 만들기" onCta={onNext}>
      <Title kicker="AI가 읽은 나" title={`${NAME}님은\n'꾸준한 정산형 긱워커'`} />
      <View style={{ backgroundColor: colors.greenTint2, borderWidth: 1, borderColor: colors.greenLine, borderRadius: 20, padding: 20, alignItems: 'center' }}>
        <Mascot head size={96} radius={28} style={{ backgroundColor: '#fff' }} />
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 14 }}>꾸준한 정산형 긱워커</Text>
        <Text style={{ fontSize: 13, fontWeight: '500', color: colors.greenInk, textAlign: 'center', lineHeight: 20, marginTop: 6 }}>
          규칙적인 정산 리듬에 계약금 비중이 큰{'\n'}프리랜스 개발자예요
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 16 }}>
          {traits.map((t) => (
            <Text key={t} style={{ fontSize: 11.5, fontWeight: '700', color: colors.green, backgroundColor: '#fff', paddingVertical: 6, paddingHorizontal: 11, borderRadius: 10, overflow: 'hidden' }}>{t}</Text>
          ))}
        </View>
      </View>
      <Text style={{ fontSize: 12.5, fontWeight: '500', color: colors.sub2, lineHeight: 19, marginTop: 16 }}>
        타 가계부는 '지출'을 봐요. 우리는 불규칙한 '소득'을 평탄하게 관리해요 — 그래서 입금이 오면 봉투로 나눠 담아요.
      </Text>
    </Frame>
  );
}

// ── 입금 감지 · 계약금 확인 ────────────────────────────────────────
function Deposit({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <Frame cta="네, 계약금이에요" secondary="아니에요, 다른 수입이에요" onCta={onYes} onSecondary={onNo}>
      <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 8 }}>
        <Mascot head size={104} radius={30} />
      </View>
      <View style={{ backgroundColor: colors.green, borderRadius: 20, padding: 22, alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ fontSize: 12.5, fontWeight: '500', color: 'rgba(255,255,255,.82)' }}>일주일 전 입금</Text>
        <Text style={{ fontSize: 34, fontWeight: '800', color: '#fff', letterSpacing: -1, marginTop: 4, fontVariant: ['tabular-nums'] }}>₩{DEPOSIT.toLocaleString('en-US')}</Text>
      </View>
      <Title title={'마침 일주일 전\n300만원 입금 내역이 있어요\n혹시 새 업무 계약금인가요?'} sub="어떤 돈인지 알려주시면 세금·비상금까지 알아서 나눠 담을게요." />
    </Frame>
  );
}

// ── 반영 감사 ──────────────────────────────────────────────────────
function Ack({ onNext }: { onNext: () => void }) {
  return (
    <Frame cta="봉투 배분 보기" onCta={onNext}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 18 }}>
        <Mascot head size={112} radius={32} />
        <Text style={{ fontSize: 23, fontWeight: '800', letterSpacing: -0.6, lineHeight: 32, color: colors.ink, textAlign: 'center' }}>
          일하느라 고생하셨어요!{'\n'}가계부에 반영할게요
        </Text>
        <Text style={{ fontSize: 14, fontWeight: '500', color: colors.sub2, textAlign: 'center' }}>계약금으로 확인했어요 · 세금은 미리 챙겨둘게요</Text>
      </View>
    </Frame>
  );
}

// ── 봉투 배분 (+ 세금봉투 경고) ────────────────────────────────────
function Allocation({ onDone }: { onDone: () => void }) {
  const [alloc, setAlloc] = useState<Record<EnvKey, number>>(DEFAULT_ALLOC);
  const [taxUnlocked, setTaxUnlocked] = useState(false);
  const [warn, setWarn] = useState(false);
  const [done, setDone] = useState(false);

  // 조정: 대상 봉투에서 ±STEP, 상대는 항상 투자금(잔여 평형추). 합계 불변.
  const move = (key: EnvKey, dir: 1 | -1) => {
    if (key === 'invest') return;
    setAlloc((a) => {
      const nextEnv = a[key] + dir * STEP;
      const nextInvest = a.invest - dir * STEP;
      if (nextEnv < 0 || nextInvest < 0) return a;
      return { ...a, [key]: nextEnv, invest: nextInvest };
    });
  };
  const onTaxStep = (dir: 1 | -1) => {
    if (!taxUnlocked) { setWarn(true); return; }
    move('tax', dir);
  };

  if (done) {
    return (
      <Frame cta="완료" onCta={onDone}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 16 }}>
          <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={40} color="#fff" sw={2.6} />
          </View>
          <Text style={{ fontSize: 23, fontWeight: '800', letterSpacing: -0.6, color: colors.ink, textAlign: 'center' }}>가계부에 담았어요</Text>
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.sub2, textAlign: 'center' }}>4개 봉투에 나눠 담았어요 · 언제든 다시 조정할 수 있어요</Text>
        </View>
      </Frame>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Frame cta="이대로 담기" onCta={() => setDone(true)}>
        <Title kicker="AI 추천 배분" title={'이렇게 나눠 담는 걸\n추천드려요'} sub={`평소 지출과 수입을 정리했어요. 자유롭게 조정하셔도 돼요.`} />
        {/* 비율 막대 */}
        <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2, marginBottom: 18 }}>
          {ENVS.map((e) => {
            const w = alloc[e.key] / DEPOSIT;
            return w > 0.001 ? <View key={e.key} style={{ flex: w, backgroundColor: e.color }} /> : null;
          })}
        </View>
        {/* 봉투 행 */}
        <View style={{ gap: 12 }}>
          {ENVS.map((e) => {
            const locked = e.key === 'tax' && !taxUnlocked;
            const residual = e.key === 'invest';
            return (
              <View key={e.key} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 15 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: e.color }} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{e.label}</Text>
                      {locked ? <Icon name="shield" size={13} color={colors.tax} /> : null}
                    </View>
                    <Text style={{ fontSize: 11.5, fontWeight: '500', color: colors.sub2, marginTop: 2 }}>{e.note}</Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>₩{alloc[e.key].toLocaleString('en-US')}</Text>
                </View>
                {!residual && (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <Stepper label="−" onPress={() => (e.key === 'tax' ? onTaxStep(-1) : move(e.key, -1))} />
                    <Stepper label="+" onPress={() => (e.key === 'tax' ? onTaxStep(1) : move(e.key, 1))} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
        <Text style={{ fontSize: 11.5, fontWeight: '500', color: colors.sub3, lineHeight: 17, marginTop: 14 }}>
          조정한 만큼은 투자금 봉투에서 오가요 · 합계는 늘 ₩{DEPOSIT.toLocaleString('en-US')}
        </Text>
      </Frame>

      {/* 세금봉투 경고 모달 */}
      {warn && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Pressable onPress={() => setWarn(false)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,18,23,.5)' }} />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 30 }}>
            <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: '#E2E5E9', alignSelf: 'center', marginBottom: 18 }} />
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.taxBg, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
              <Icon name="shield" size={28} color={colors.tax} />
            </View>
            <Text style={{ fontSize: 19, fontWeight: '800', letterSpacing: -0.4, color: colors.ink, textAlign: 'center', marginTop: 14 }}>세금봉투는 지켜드릴게요</Text>
            <Text style={{ fontSize: 13.5, fontWeight: '500', color: colors.sub, textAlign: 'center', lineHeight: 21, marginTop: 8 }}>
              5월 종합소득세를 위해 미리 모아두는 봉투예요. 걱정 마세요 —{'\n'}세금봉투는 <Text style={{ fontWeight: '800', color: colors.green }}>우대금리 파킹통장</Text>에 넣어 이자까지 챙겨드려요.
            </Text>
            <Pressable onPress={() => setWarn(false)} style={{ backgroundColor: colors.green, borderRadius: 15, paddingVertical: 16, alignItems: 'center', marginTop: 20 }}>
              <Text style={{ fontSize: 15.5, fontWeight: '800', color: '#fff' }}>우대금리 혜택 누리기</Text>
            </Pressable>
            <Pressable onPress={() => { setTaxUnlocked(true); setWarn(false); }} style={{ paddingVertical: 13, alignItems: 'center', marginTop: 2 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.sub3 }}>그래도 조정할게요</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, borderWidth: 1.4, borderColor: colors.line, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.sub }}>{label}</Text>
    </Pressable>
  );
}
