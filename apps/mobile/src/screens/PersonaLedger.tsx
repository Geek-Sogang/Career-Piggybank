import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  DEMO_DEPOSIT, OFFLINE_ALLOCATION, decideAllocation, getGigProfile, getPersona,
  getTransactions, proposeAllocation, readPersona,
  type Allocation, type EnvelopeSplit, type GigProfile, type Txn,
} from '@/api';
import { colors } from '@/theme/colors';
import { Icon, type IconName } from '@/components/Icon';
import { Mascot } from '@/components/ui';
import { Frame, Title, FlowHeader } from '@/components/flow';
import { PersonaCard } from '@/screens/My';
import { usePersonalizationV2 } from '@/lib/personalization';
import { useApp, type AllocNotice } from '@/store';

// 영상 [10] 완숙기 · 페르소나 → 맞춤 가계부 → 봉투 배분. 토스식 진행형 UX(한 화면 = 한 목적).
// 무대는 극본 그대로, 배우는 실 데이터: 페르소나 = getGigProfile/getPersona, 입금 = 실 거래,
// 배분 = proposeAllocation(근거 포함) → 사람이 조정·확정(decideAllocation) → 소득리듬 층 갱신.
// 진입 2종: 홈 오늘의 미션 = 풀플로우(connect부터), 가계부 입금 카드 = 배분만(deposit부터).

type Step = 'connect' | 'personaLoading' | 'persona' | 'habits' | 'envelopes' | 'ledgerLoading' | 'deposit' | 'ack' | 'allocation';
const DOT: Record<Step, number> = { connect: 0, personaLoading: 1, persona: 1, habits: 1, envelopes: 2, ledgerLoading: 2, deposit: 2, ack: 2, allocation: 3 };
const DOT_TOTAL = 4;

const NAME = '조대흠';           // 앱 전역 시연 사용자 (홈 헤더와 동일)
const STEP = 100_000;            // 봉투 조정 단위

// 페르소나 판독에 들어가는 데이터 — 연결 여부는 store conn(백엔드 복원값)이 진실
const SOURCES: { label: string; sub: string; icon: IconName; tint: string; color: string }[] = [
  { label: '마이데이터', sub: '입출금 · 소득 흐름', icon: 'card', tint: colors.bufferTint, color: colors.buffer },
  { label: '홈택스', sub: '3.3% 신고소득 대사', icon: 'building', tint: colors.indigoTint, color: colors.indigo },
  { label: '앱 활동 기록', sub: '연결 · 승인 같은 행동 신호', icon: 'shieldCheck', tint: colors.greenTint, color: colors.green },
];

// 봉투 4종 — 백엔드 순차 배분과 같은 체계(세금>경비>생활비>여윳돈). 여윳돈이 잔여 평형추.
type EnvKey = keyof EnvelopeSplit;
const ENVS: { key: EnvKey; label: string; color: string; note: string }[] = [
  { key: 'tax', label: '세금 봉투', color: colors.tax, note: '5월 종소세 대비 · 세율표로 계산' },
  { key: 'expense', label: '경비 봉투', color: colors.expense, note: '일 유지비 · 구독' },
  { key: 'spendable', label: '생활비 봉투', color: colors.spendable, note: '이번 달 쓸 수 있는 돈' },
  { key: 'buffer', label: '여윳돈 봉투', color: colors.buffer, note: '소득 공백 대비 · 남는 돈은 전부 여기로' },
];

// 서버가 없을 때도 데모가 죽지 않는 폴백 페르소나 (라이브 시드 실측과 동일 표현)
const FALLBACK_GIG: Pick<GigProfile, 'archetype' | 'volatility' | 'rhythm' | 'phase' | 'concentration'> = {
  archetype: '고변동 긱워커 — 큰 대금이 가끔, 세금·가뭄 대비가 핵심',
  volatility: '고변동', rhythm: '플랫폼 정기형', phase: '성장기', concentration: '다각화',
};

export function PersonaLedger() {
  const { actions, plStart, lastAlloc } = useApp();
  // 시작 단계 — 홈 미션·온보딩=connect(페르소나 장 도입) / 가계부=deposit(배분만) / review=확정 배분 재검토
  const [step, setStep] = useState<Step>(plStart === 'review' ? 'allocation' : plStart === 'deposit' ? 'deposit' : 'connect');
  const [gig, setGig] = useState<GigProfile | null>(null);
  const [txn, setTxn] = useState<Txn | null>(null);
  const go = (s: Step) => setStep(s);

  // 배분 대상 = 가장 최근 일감 입금(실 거래). 실패 시 데모 시드 상수로 폴백.
  useEffect(() => {
    getTransactions()
      .then((txns) => {
        const income = txns.filter((t) => t.direction === 'in' && t.kind === 'income');
        if (income.length) setTxn(income[0]);
      })
      .catch(() => {});
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
      <FlowHeader total={DOT_TOTAL} index={DOT[step]} onBack={actions.back} />

      {step === 'connect' && <Connect onNext={() => go('personaLoading')} onBack={actions.back} />}
      {step === 'personaLoading' && (
        <PersonaLoading onDone={(g) => { setGig(g); go('persona'); }} />
      )}
      {step === 'persona' && <Persona gig={gig} cta="내 돈 관리 습관 보기" onNext={() => go('habits')} />}
      {step === 'habits' && (
        // 기록은 입력(과거), 봉투는 출력(미래): 페르소나의 산출물을 '가계부'가 아니라 '봉투 설계'로 부른다.
        <Habits
          cta="이 습관에 맞춘 봉투 보기"
          onNext={() => (plStart === 'onboard' ? go('envelopes') : go('ledgerLoading'))}
        />
      )}
      {step === 'envelopes' && (
        // 온보딩 마침표 — 설계의 실물(자동 봉투 4종의 역할). 금액은 입금마다 계산되므로 여기선 약속하지 않는다.
        // 착지는 가계부: 연결에서 찾은 미처리 입금 카드가 첫 운영 사건(배분)을 안내한다.
        <EnvelopeIntro onNext={() => { actions.back(); actions.nav('ledger'); }} />
      )}
      {step === 'ledgerLoading' && (
        <Loading title={`${NAME}님만을 위한\n봉투를 설계하고 있어요`} sub="입금이 오면 나눠 담을 4개 봉투를 준비하고 있어요" onDone={() => go('deposit')} />
      )}
      {step === 'deposit' && <Deposit txn={txn} onYes={() => go('ack')} onOther={() => { actions.back(); actions.pushScr('transactions'); }} />}
      {step === 'ack' && <Ack onNext={() => go('allocation')} />}
      {step === 'allocation' && (
        <Allocate
          txn={txn}
          review={plStart === 'review' ? lastAlloc : null}
          onDone={() => { actions.back(); actions.nav('ledger'); }}
        />
      )}
    </SafeAreaView>
  );
}

// ── 데이터 연결 — 체크는 실 연결 상태(conn), CTA가 실제로 연결한다 ──────────
function Connect({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { vals, actions } = useApp();
  // 행별 실 연결 상태 — 마이데이터/홈택스는 ConnSrc, 앱 활동은 계측이라 항상 켜져 있다
  const checked = [vals.conn.mydata, vals.conn.hometax, true];
  // 이력 연동을 거쳐 왔으면 이미 연결됨 — 재동의를 요구하지 않고 문구만 바꾼다
  const already = vals.conn.mydata && vals.conn.hometax;
  return (
    <Frame
      cta={already ? '페르소나 만들기' : '연결하고 페르소나 만들기'}
      ctaSub={already ? '세 가지가 이미 연결돼 있어요 — 바로 읽을 수 있어요' : '연결하면 마이데이터·홈택스 제공에 동의하게 돼요'}
      secondary="다음에 할게요"
      onCta={() => { if (!already) actions.connectSources(['mydata', 'hometax']); onNext(); }}
      onSecondary={onBack}
    >
      {/* 이미 연결됐으면 '요청'이 아니라 '안내' — 방금 모은 기록을 읽겠다는 선언으로 바뀐다 */}
      <Title
        title={already ? '방금 모은 기록으로\n나를 읽을게요' : '나를 이해하려면\n세 가지가 필요해요'}
        sub={already
          ? '이력 연동에서 모은 세 가지 기록이에요. 이걸 읽어 페르소나를 만들고, 앞으로 들어올 돈을 담을 봉투를 설계해요.'
          : '세 가지 기록을 읽어 페르소나를 만들고, 앞으로 들어올 돈을 담을 봉투를 설계해요.'}
      />
      <View style={{ gap: 10 }}>
        {SOURCES.map((s, i) => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.bg, borderRadius: 14, padding: 15 }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: s.tint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={s.icon} size={21} color={s.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{s.label}</Text>
              <Text style={{ fontSize: 12, fontWeight: '500', color: colors.sub2, marginTop: 2 }}>{s.sub}</Text>
            </View>
            {checked[i] ? (
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="check" size={14} color="#fff" sw={2.6} />
              </View>
            ) : (
              <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.6, borderColor: colors.line }} />
            )}
          </View>
        ))}
      </View>
    </Frame>
  );
}

// ── 페르소나 로딩 — 실 판독을 기다리는 동안 '나에게 맞춰지는 과정' 3단계를 보여준다.
// 대기가 곧 설명: 구조(규칙·통계) → 성향(EXAONE 판독) → 개인화(구조+성향). 마이 탭 카드와 같은 서사.
const READ_STAGES: { n: string; title: string; badge: string; sub: string }[] = [
  { n: '1', title: '긱 소득 구조', badge: '규칙·통계', sub: '변동성 · 입금 간격 · 소득원을 재고 있어요' },
  { n: '2', title: '금융 행동 성향', badge: 'EXAONE 판독', sub: '안전 여유 · 돈의 시간 · 지출 조절 · 관리 습관' },
  { n: '3', title: '서비스 개인화', badge: '구조 + 성향', sub: '봉투 설계 · 관리 방식 · 목표 페이스에 반영해요' },
];

function PersonaLoading({ onDone }: { onDone: (gig: GigProfile | null) => void }) {
  const [stage, setStage] = useState(0);   // 완료된 단계 수 — stage번째가 진행 중
  useEffect(() => {
    let live = true;
    const started = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    READ_STAGES.forEach((_, i) => timers.push(setTimeout(() => setStage(i + 1), 800 * (i + 1))));
    const finish = (g: GigProfile | null) => {
      // 3단계 연출(2.4초)이 끝난 뒤에 넘어간다 — 판독이 캐시라 즉답이어도 화면이 튀지 않게
      const wait = Math.max(0, 800 * READ_STAGES.length + 300 - (Date.now() - started));
      timers.push(setTimeout(() => { if (live) onDone(g); }, wait));
    };
    (async () => {
      try {
        // 판독 스냅샷이 없으면(404) 온보딩 트리거로 실판독을 돌린다 — 축당 7.8B라 오래 걸릴 수 있음
        await getPersona().catch(() => readPersona('onboarding').catch(() => null));
        const g = await getGigProfile();
        finish(g);
      } catch {
        finish(null);
      }
    })();
    return () => { live = false; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8 }}>
      <View style={{ alignItems: 'center', paddingVertical: 14 }}>
        <Mascot head size={88} radius={26} />
      </View>
      <Title title={'페르소나를 만들고 있어요'} sub="측정할 수 있는 구조와 AI가 읽은 행동을 섞지 않고, 마지막 결정에서 결합해요." />
      <View style={{ gap: 12 }}>
        {READ_STAGES.map((s, i) => {
          const state = i < stage ? 'done' : i === stage ? 'loading' : 'wait';
          return (
            <View
              key={s.n}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 13,
                backgroundColor: state === 'wait' ? colors.bg : '#fff',
                borderWidth: 1.4, borderColor: state === 'done' ? colors.greenLine : state === 'loading' ? colors.green : colors.line,
                borderRadius: 16, padding: 15, opacity: state === 'wait' ? 0.5 : 1,
              }}
            >
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: state === 'done' ? colors.green : colors.bg, borderWidth: state === 'done' ? 0 : 1.4, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
                {state === 'done'
                  ? <Icon name="check" size={14} color="#fff" sw={2.6} />
                  : <Text style={{ fontSize: 12, fontWeight: '800', color: colors.sub }}>{s.n}</Text>}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{s.title}</Text>
                  <Text style={{ fontSize: 9.5, fontWeight: '700', color: colors.sub2 }}>{s.badge}</Text>
                </View>
                <Text style={{ fontSize: 11.5, fontWeight: '500', color: colors.sub2, marginTop: 2 }}>{s.sub}</Text>
              </View>
              {state === 'loading' ? <ActivityIndicator size="small" color={colors.green} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── 돈 관리 습관 — AI 성향 4축(마이 탭 카드와 단일 소스). 공개(구조) 다음 장 ──
function Habits({ cta, onNext }: { cta: string; onNext: () => void }) {
  return (
    <Frame cta={cta} onCta={onNext}>
      <Title kicker="AI가 읽은 나" title={'돈 관리 습관도\n읽어뒀어요'} />
      <PersonaCard />
    </Frame>
  );
}

// ── 봉투 준비 완료(온보딩 마침표) — 설계의 실물. 자동 봉투 4종의 역할만 소개하고,
// 금액은 약속하지 않는다(비율·금액은 입금이 올 때마다 페르소나·세율표로 계산 — 정직 원칙).
function EnvelopeIntro({ onNext }: { onNext: () => void }) {
  return (
    <Frame cta="가계부에서 시작하기" ctaSub="연결에서 찾은 입금이 기다리고 있어요 — 첫 배분을 해볼 수 있어요" onCta={onNext}>
      <Title kicker="설계 완료" title={'내 봉투 4개가\n준비됐어요'} sub="입금이 오면 이 순서로 나눠 담아요. 실제 금액은 그때그때 내 리듬과 세율표로 계산해요." />
      <View style={{ gap: 12 }}>
        {ENVS.map((e, i) => (
          <View key={e.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 15 }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: e.color }} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{i + 1}. {e.label}</Text>
              <Text style={{ fontSize: 12, fontWeight: '500', color: colors.sub2, marginTop: 2 }}>{e.note}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 11.5, fontWeight: '500', color: colors.sub3, lineHeight: 17, marginTop: 14 }}>
        세금이 항상 먼저예요(세율표 산수) · 남는 돈은 여윳돈으로 — 목표 봉투는 여윳돈이 생기면 추천해 드려요.
      </Text>
    </Frame>
  );
}

// ── 로딩(연출 전환용) ──────────────────────────────────────────────
function Loading({ title, sub, onDone }: { title: string; sub: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <LoadingBody title={title} sub={sub} />;
}

function LoadingBody({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingBottom: 60, gap: 20 }}>
      <Mascot head size={104} radius={30} />
      <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: -0.5, lineHeight: 28, color: colors.ink, textAlign: 'center' }}>{title}</Text>
      <ActivityIndicator size="small" color={colors.green} />
      <Text style={{ fontSize: 13, fontWeight: '500', color: colors.sub2, textAlign: 'center' }}>{sub}</Text>
    </View>
  );
}

// ── 페르소나 공개 — 실 긱 프로필(archetype·구조 라벨)이 주인공 ──────────────
function Persona({ gig, cta = '맞춤 가계부 만들기', onNext }: { gig: GigProfile | null; cta?: string; onNext: () => void }) {
  const v2 = usePersonalizationV2();   // 구조 2요소 — 마이 탭 '내 일감·정산 흐름'과 같은 소스
  const g = gig ?? FALLBACK_GIG;
  const [headline, tail] = g.archetype.split(' — ');
  const traits = [g.rhythm, `소득원 ${g.concentration}`, g.phase].filter(Boolean);
  return (
    <Frame cta={cta} onCta={onNext}>
      <Title kicker="AI가 읽은 나" title={`${NAME}님은\n'${headline}'`} />
      <View style={{ backgroundColor: colors.greenTint2, borderWidth: 1, borderColor: colors.greenLine, borderRadius: 20, padding: 20, alignItems: 'center' }}>
        <Mascot head size={96} radius={28} style={{ backgroundColor: '#fff' }} />
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 14 }}>{headline}</Text>
        {tail ? (
          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.greenInk, textAlign: 'center', lineHeight: 20, marginTop: 6 }}>{tail}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 16 }}>
          {traits.map((t) => (
            <Text key={t} style={{ fontSize: 11.5, fontWeight: '700', color: colors.green, backgroundColor: '#fff', paddingVertical: 6, paddingHorizontal: 11, borderRadius: 10, overflow: 'hidden' }}>{t}</Text>
          ))}
        </View>
      </View>
      {/* 구조 2요소 — 방금 모은 기록에서 측정된 일·정산 흐름(결정론) */}
      {(v2?.gig_structure ?? []).length > 0 && (
        <View style={{ gap: 10, marginTop: 12 }}>
          {v2!.gig_structure.map((s) => (
            <View key={s.key} style={{ backgroundColor: colors.bg, borderRadius: 14, padding: 15 }}>
              <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.sub2 }}>{s.label}</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink, marginTop: 3 }}>{s.level}</Text>
              <Text style={{ fontSize: 12, fontWeight: '500', color: colors.sub2, marginTop: 3, lineHeight: 17 }}>{s.detail}</Text>
            </View>
          ))}
        </View>
      )}
      <Text style={{ fontSize: 12.5, fontWeight: '500', color: colors.sub2, lineHeight: 19, marginTop: 16 }}>
        타 가계부는 '지출'을 봐요. 우리는 불규칙한 '소득'을 평탄하게 관리해요 — 그래서 입금이 오면 봉투로 나눠 담아요.
      </Text>
    </Frame>
  );
}

// ── 입금 감지 — 실 최신 일감 입금. 아니라고 하면 거래 내역(수기 태그)으로 ────
const monthDay = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;

function Deposit({ txn, onYes, onOther }: { txn: Txn | null; onYes: () => void; onOther: () => void }) {
  const amount = txn?.amount ?? DEMO_DEPOSIT.amount;
  const counterparty = txn?.counterparty ?? DEMO_DEPOSIT.counterparty;
  const date = monthDay(txn?.date ?? DEMO_DEPOSIT.date);
  const isAdvance = txn?.subtype === 'advance';
  return (
    <Frame cta={isAdvance ? '네, 계약금이에요' : '네, 일감 정산이에요'} secondary="아니에요, 다른 수입이에요" onCta={onYes} onSecondary={onOther}>
      <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 8 }}>
        <Mascot head size={104} radius={30} />
      </View>
      <View style={{ backgroundColor: colors.green, borderRadius: 20, padding: 22, alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ fontSize: 12.5, fontWeight: '500', color: 'rgba(255,255,255,.82)' }}>{date} · {counterparty}</Text>
        <Text style={{ fontSize: 34, fontWeight: '800', color: '#fff', letterSpacing: -1, marginTop: 4, fontVariant: ['tabular-nums'] }}>₩{amount.toLocaleString('en-US')}</Text>
      </View>
      <Title
        title={`${date}에 들어온\n₩${amount.toLocaleString('en-US')}이 있어요\n${isAdvance ? '혹시 새 업무 계약금인가요?' : '새 일감 정산이 맞나요?'}`}
        sub="연결한 기록에서 아직 봉투에 담지 않은 입금을 찾았어요. 어떤 돈인지 알려주시면 세금·여윳돈까지 알아서 나눠 담을게요."
      />
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
        <Text style={{ fontSize: 14, fontWeight: '500', color: colors.sub2, textAlign: 'center' }}>일감 수입으로 확인했어요 · 세금부터 미리 챙길게요</Text>
      </View>
    </Frame>
  );
}

// ── 봉투 배분 — 실 제안(근거 포함) + 사람의 조정(잔여 평형추 = 여윳돈).
// review 모드: 확정된 배분(lastAlloc)의 근거를 다시 보고 재조정 — "언제든 다시 조정" 약속의 실현.
function Allocate({ txn, review, onDone }: { txn: Txn | null; review?: AllocNotice | null; onDone: () => void }) {
  const { actions } = useApp();
  const depositAmount = review?.deposit ?? txn?.amount ?? DEMO_DEPOSIT.amount;
  const [proposal, setProposal] = useState<Allocation | null>(null);
  const [alloc, setAlloc] = useState<EnvelopeSplit | null>(null);
  const [taxUnlocked, setTaxUnlocked] = useState(false);
  const [warn, setWarn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // 실 배분 제안 — AI 판정 + 산수. 서버가 죽어도 데모는 죽지 않는다(오프라인 폴백).
  // review면 새 제안을 만들지 않고 확정본을 그대로 편다(근거·배분 동일 사건).
  useEffect(() => {
    let live = true;
    if (review) {
      const synth: Allocation = {
        id: review.id ?? 'review', status: 'confirmed', deposit: review.deposit,
        proposed: review.split, windfall_ratio: review.windfall, needs_confirmation: false,
        reasons: review.reasons ?? [], buffer_target: 0, invest_available: 0, persona_used: true,
      };
      setProposal(synth);
      setAlloc(review.split);
      return () => { live = false; };
    }
    proposeAllocation(depositAmount)
      .then((a) => { if (live) { setProposal(a); setAlloc(a.proposed); } })
      .catch(() => { if (live) { setProposal(OFFLINE_ALLOCATION); setAlloc(OFFLINE_ALLOCATION.proposed); } });
    return () => { live = false; };
  }, [depositAmount, review]);

  // 조정: 대상 봉투에서 ±STEP, 상대는 항상 여윳돈(잔여 평형추). 합계 불변.
  const move = (key: EnvKey, dir: 1 | -1) => {
    if (key === 'buffer') return;
    setAlloc((a) => {
      if (!a) return a;
      const nextEnv = a[key] + dir * STEP;
      const nextBuffer = a.buffer - dir * STEP;
      if (nextEnv < 0 || nextBuffer < 0) return a;
      return { ...a, [key]: nextEnv, buffer: nextBuffer };
    });
  };
  const onTaxStep = (dir: 1 | -1) => {
    if (!taxUnlocked) { setWarn(true); return; }
    move('tax', dir);
  };

  const changed = !!proposal && !!alloc && ENVS.some((e) => alloc[e.key] !== proposal.proposed[e.key]);

  // 확정 — 제안 그대로면 confirm, 만졌으면 adjust. 결정은 언제나 사람.
  const submit = async () => {
    if (!proposal || !alloc || busy) return;
    // review에서 안 만졌으면 저장할 것이 없다 — 그대로 닫는다
    if (review && !changed) { onDone(); return; }
    setBusy(true);
    try {
      await decideAllocation(proposal.id, changed ? 'adjust' : 'confirm', changed ? alloc : undefined);
    } catch {
      // 오프라인 — 결정 이벤트는 세션에 남기고 진행(데모 불사 원칙)
    }
    actions.noteAllocation({
      id: proposal.id, deposit: depositAmount, windfall: proposal.windfall_ratio,
      split: alloc, reasons: proposal.reasons, confirmed: !!review,
    });
    if (!review) actions.markAllocConfirmed();   // 소득리듬 층 갱신 — 최초 결정에서만(재조정은 중복 집계 방지)
    setBusy(false);
    setDone(true);
  };

  if (!proposal || !alloc) {
    return <LoadingBody title="배분을 계산하고 있어요" sub="페르소나와 세율표를 함께 보고 있어요" />;
  }

  if (done) {
    return (
      <Frame cta="완료" onCta={onDone}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 16 }}>
          <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={40} color="#fff" sw={2.6} />
          </View>
          <Text style={{ fontSize: 23, fontWeight: '800', letterSpacing: -0.6, color: colors.ink, textAlign: 'center' }}>
            {review ? '조정을 저장했어요' : '가계부에 담았어요'}
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.sub2, textAlign: 'center' }}>
            {review ? '조정한 만큼 여윳돈에서 오갔어요 · 근거는 그대로 남아요' : '4개 봉투에 나눠 담았어요 · 언제든 다시 조정할 수 있어요'}
          </Text>
        </View>
      </Frame>
    );
  }

  const taxHook = proposal.product_hooks?.find((h) => h.envelope === 'tax');

  return (
    <View style={{ flex: 1 }}>
      <Frame
        cta={busy ? '저장 중…' : review ? (changed ? '조정 저장하기' : '좋아요, 이대로 둘게요') : '이대로 담기'}
        ctaDisabled={busy}
        onCta={submit}
      >
        {review ? (
          <Title kicker="배분 결과" title={'이렇게 나눠\n담았어요'} sub="근거를 다시 보고, 필요하면 조정할 수 있어요. 조정분은 여윳돈에서 오가요." />
        ) : (
          <Title kicker="AI 추천 배분" title={'이렇게 나눠 담는 걸\n추천드려요'} sub="내 소득 리듬과 세율표를 함께 봤어요. 자유롭게 조정하셔도 돼요." />
        )}
        {/* 비율 막대 */}
        <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2, marginBottom: 18 }}>
          {ENVS.map((e) => {
            const w = alloc[e.key] / depositAmount;
            return w > 0.001 ? <View key={e.key} style={{ flex: w, backgroundColor: e.color }} /> : null;
          })}
        </View>
        {/* 봉투 행 */}
        <View style={{ gap: 12 }}>
          {ENVS.map((e) => {
            const locked = e.key === 'tax' && !taxUnlocked;
            const residual = e.key === 'buffer';
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
        {/* 배분 근거 — AI 판정의 이유를 그대로 보여준다(신뢰 장치) */}
        {proposal.reasons.length > 0 && (
          <View style={{ backgroundColor: colors.bg, borderRadius: 14, padding: 15, marginTop: 14, gap: 7 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Mascot head size={22} radius={7} />
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.ink }}>피기가 이렇게 나눈 이유</Text>
            </View>
            {proposal.reasons.map((r) => (
              <Text key={r} style={{ fontSize: 12, fontWeight: '500', color: colors.sub, lineHeight: 18 }}>· {r}</Text>
            ))}
          </View>
        )}
        <Text style={{ fontSize: 11.5, fontWeight: '500', color: colors.sub3, lineHeight: 17, marginTop: 12 }}>
          조정한 만큼은 여윳돈 봉투에서 오가요 · 합계는 늘 ₩{depositAmount.toLocaleString('en-US')}
        </Text>
      </Frame>

      {/* 세금봉투 경고 모달 — 세금은 세율표 산수(기본 잠금), 넘어서는 조정은 사람의 결정 */}
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
              {taxHook
                ? taxHook.line
                : '5월 종합소득세를 위해 세율표로 계산해 미리 모아두는 봉투예요. 줄이면 5월에 낼 돈이 부족해질 수 있어요.'}
            </Text>
            <Pressable onPress={() => setWarn(false)} style={{ backgroundColor: colors.green, borderRadius: 15, paddingVertical: 16, alignItems: 'center', marginTop: 20 }}>
              <Text style={{ fontSize: 15.5, fontWeight: '800', color: '#fff' }}>추천대로 둘게요</Text>
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
