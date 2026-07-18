import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { approveJob, getPendingJobs, type PendingJob } from '@/api';
import { PRODUCTS, type ProductKey } from '@/products';
import { colors } from '@/theme/colors';
import { Icon, type IconName } from '@/components/Icon';
import { Mascot } from '@/components/ui';
import { Frame, Title, FlowHeader } from '@/components/flow';
import { useApp, type ConnSrc } from '@/store';

// 영상 [9] 초창기 · 이력 연동 온보딩 플로우 — 토스식 진행형 UX(한 화면 = 한 목적 = 한 액션).
// 무대는 극본, 배우는 실 데이터: 스캔 = 행별 실 연결(conn·점수·F13), 요약 = 실 검증 이력,
// 미인증 = 실 승인 큐(사람의 승인만 검증 사건을 만든다), 상품 = products.ts 실 카탈로그.

type Step = 'intro' | 'scan' | 'summary' | 'unverified' | 'products';
const STEPS: Step[] = ['intro', 'scan', 'summary', 'unverified', 'products'];

// 순차 스캔 대상 — 각 행이 완료될 때 해당 소스를 실제로 연결한다
const SOURCES: { label: string; sub: string; icon: IconName; tint: string; color: string; src: ConnSrc }[] = [
  { label: '입금 내역', sub: '은행 거래에서 정산 입금을 찾고 있어요', icon: 'download', tint: colors.greenTint, color: colors.green, src: 'mydata' },
  { label: '세금지출 내역', sub: '홈택스 3.3% 신고소득을 대사하고 있어요', icon: 'building', tint: colors.bufferTint, color: colors.buffer, src: 'hometax' },
  { label: 'KOSA · KODIA 인증서', sub: '협회 경력·기술등급을 확인하고 있어요', icon: 'shieldCheck', tint: colors.indigoTint, color: colors.indigo, src: 'kosa' },
];

// 온보딩에서 보여줄 하나은행 상품 — products.ts 실 카탈로그의 부분집합
const PRODUCT_KEYS: ProductKey[] = ['account', 'parking', 'emergency', 'youth'];

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
      {step === 'unverified' && <Unverified onNext={() => go('products')} />}
      {step === 'products' && <Products name={NAME} onStart={() => actions.pushScr('products')} onLater={() => { actions.back(); actions.nav('home'); }} />}
    </SafeAreaView>
  );
}

// ── 1) 인트로 · 연동 제안 ──────────────────────────────────────────
function Intro({ name, onStart, onLater }: { name: string; onStart: () => void; onLater: () => void }) {
  return (
    <Frame cta="이력 연동 시작하기" ctaSub="연결하면 각 기관의 자료 제공에 동의하게 돼요" secondary="다음에 할게요" onCta={onStart} onSecondary={onLater}>
      <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 12 }}>
        <Mascot head size={120} radius={34} />
      </View>
      <Title
        title={`${name}님,\n흩어진 이력을 모아드릴까요?`}
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

// ── 2) 순차 스캔 — 행이 완료될 때마다 해당 소스를 실제로 연결한다 ─────────────
function Scan({ onDone }: { onDone: () => void }) {
  const { actions } = useApp();
  const [done, setDone] = useState(0); // 완료된 소스 수. done번째가 현재 로딩 중.

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    SOURCES.forEach((s, i) => timers.push(setTimeout(() => {
      actions.connectSources([s.src]);   // 실 연결 — 점수 반영 + F13 계측 + 백엔드 동기화
      setDone(i + 1);
    }, 1100 * (i + 1))));
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
                  {state === 'done' ? '연결 완료' : state === 'loading' ? s.sub : '대기 중'}
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

// ── 3) 이력 요약 — 실 검증 이력(store, 백엔드 결정론 응답) ────────────────────
const yearMonth = (iso: string) => iso.slice(0, 7).replace('-', '.');

function Summary({ name, onNext }: { name: string; onNext: () => void }) {
  const { vals } = useApp();
  const recent = vals.verified.recent;
  const total = recent.reduce((a, h) => a + h.amount, 0);
  return (
    <Frame cta="다음" onCta={onNext}>
      {recent.length === 0 ? (
        <>
          <Title title={'아직 모인 이력이\n없어요'} sub="정산 입금이 쌓이면 검증 이력으로 모아드려요. 지금은 다음 단계로 넘어가도 돼요." />
        </>
      ) : (
        <>
          <Title kicker={`${vals.verified.count}건을 찾았어요`} title={`${name}님의 이력은\n다음과 같아요!`} />
          <View style={{ backgroundColor: colors.green, borderRadius: 18, padding: 18, marginBottom: 16 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '500', color: 'rgba(255,255,255,.82)' }}>모아진 검증 이력 합계</Text>
            <Text style={{ fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.8, marginTop: 4, fontVariant: ['tabular-nums'] }}>
              ₩{total.toLocaleString('en-US')}
            </Text>
          </View>
          <View style={{ gap: 10 }}>
            {recent.map((h) => (
              <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14 }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.green }}>{h.counterparty.replace(/[△○㈜\s]/g, '').slice(0, 1) || '일'}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{h.counterparty}{h.memo ? ` · ${h.memo}` : ''}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: colors.green, backgroundColor: colors.greenTint, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6, overflow: 'hidden' }}>검증 일감</Text>
                    <Text style={{ fontSize: 11.5, fontWeight: '500', color: colors.sub2 }}>{yearMonth(h.date)}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>₩{h.amount.toLocaleString('en-US')}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Frame>
  );
}

// ── 4) 미인증 안내 — 실 승인 큐. 사람의 승인만 검증 사건을 만든다(HITL) ────────
function Unverified({ onNext }: { onNext: () => void }) {
  const { actions } = useApp();
  const [jobs, setJobs] = useState<PendingJob[] | null>(null);
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getPendingJobs()
      .then((r) => { if (live) setJobs(r.jobs); })
      .catch(() => { if (live) setJobs([]); });
    return () => { live = false; };
  }, []);

  // 승인 대기 건이 없으면 이 단계는 보여줄 게 없다 — 상품으로 자동 진행
  useEffect(() => {
    if (jobs && jobs.length === 0) onNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]);

  const approve = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await approveJob(id);
      setApproved((a) => ({ ...a, [id]: true }));
      actions.refreshCareer();   // 검증 사건 → 점수·XP 갱신
    } catch {
      // 실패는 대기 상태 그대로 둔다 — 승인된 척하지 않는다
    }
    setBusyId(null);
  };

  if (!jobs) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <ActivityIndicator size="small" color={colors.green} />
        <Text style={{ fontSize: 13, fontWeight: '500', color: colors.sub2 }}>승인 대기 입금을 확인하고 있어요</Text>
      </View>
    );
  }

  const remaining = jobs.filter((j) => !approved[j.id]).length;

  return (
    <Frame cta="다음" ctaSub="지금 승인한 만큼 검증 이력과 커리어 점수로 쌓여요" onCta={onNext}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.orangeTint, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.orange }}>!</Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.orange }}>{remaining}건이 아직 승인 전이에요</Text>
      </View>
      <Title title={'내가 한 일이 맞다면\n승인해 주세요'} sub="확인된 일감 입금이에요. 사람의 승인만 검증 이력이 돼요 — 자동으로 올리지 않아요." />
      <View style={{ gap: 12 }}>
        {jobs.map((j) => {
          const ok = !!approved[j.id];
          return (
            <View key={j.id} style={{ borderWidth: 1.4, borderColor: ok ? colors.greenLine : colors.orangeTint, backgroundColor: ok ? colors.greenTint2 : '#FFFCF8', borderRadius: 16, padding: 15 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{j.counterparty}</Text>
                <Text style={{ fontSize: 10.5, fontWeight: '800', color: ok ? colors.green : colors.orange, backgroundColor: ok ? colors.greenTint : colors.orangeTint, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 7, overflow: 'hidden' }}>{ok ? '승인됨' : '승인 전'}</Text>
              </View>
              <Text style={{ fontSize: 12.5, fontWeight: '500', color: colors.sub2, marginTop: 4 }}>
                {yearMonth(j.date)} 입금 · ₩{j.amount.toLocaleString('en-US')}{j.memo ? ` · ${j.memo}` : ''}
              </Text>
              {!ok && (
                <Pressable onPress={() => approve(j.id)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, borderTopWidth: 1, borderTopColor: colors.line2, paddingTop: 10 }}>
                  {busyId === j.id
                    ? <ActivityIndicator size="small" color={colors.orange} />
                    : (
                      <>
                        <Icon name="check" size={15} color={colors.orange} sw={2.2} />
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.orange }}>내 일감으로 승인하기</Text>
                      </>
                    )}
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    </Frame>
  );
}

// ── 5) 맞춤 금융상품 — products.ts 실 카탈로그. 행 탭 = 실 상품 상세 ──────────
function Products({ name, onStart, onLater }: { name: string; onStart: () => void; onLater: () => void }) {
  const { actions } = useApp();
  return (
    <Frame cta="시작하기" secondary="다음에" onCta={onStart} onSecondary={onLater}>
      <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
        <Mascot head size={88} radius={26} />
      </View>
      <Title kicker="검증된 커리어로 열린 혜택" title={`${name}님의 커리어로\n누릴 수 있는 하나은행 상품이에요`} />
      <View style={{ gap: 12 }}>
        {PRODUCT_KEYS.map((k) => {
          const p = PRODUCTS[k];
          return (
            <Pressable key={k} onPress={() => actions.openProduct(k)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 15 }}>
              <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: p.badgeBg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: p.badgeColor }}>{p.badge}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{p.name}</Text>
                <Text style={{ fontSize: 12, fontWeight: '500', color: colors.sub2, marginTop: 3 }}>{p.tagline}</Text>
              </View>
              <Text style={{ fontSize: 10, fontWeight: '800', color: p.badgeColor, backgroundColor: p.badgeBg, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7, overflow: 'hidden' }}>{p.terms[0]}</Text>
            </Pressable>
          );
        })}
      </View>
    </Frame>
  );
}
