import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { bankDeposit, consumeAgenda, decideAllocation, decidePacing, DEMO_DEPOSIT, fetchProductMatch, getAgenda, getEnvelopeBalances, getPersona, OFFLINE_ALLOCATION, proposePacing, readPersona, type AgendaItem, type Allocation, type EnvelopeSplit, type PacingProposal, type ProductMatchPick } from '@/api';
import { type ProductKey } from '@/products';
import { colors } from '@/theme/colors';
import { Icon, type IconName } from '@/components/Icon';
import { Mascot } from '@/components/ui';
import { AppProvider, useApp } from '@/store';
import { Home } from '@/screens/Home';
import { Piggy } from '@/screens/Piggy';
import { Connect } from '@/screens/Connect';
import { VerifiedDetail } from '@/screens/VerifiedDetail';
import { Ledger } from '@/screens/Ledger';
import { Tax } from '@/screens/Tax';
import { Retirement } from '@/screens/Retirement';
import { My } from '@/screens/My';
import { DataSovereignty } from '@/screens/DataSovereignty';
import { Products } from '@/screens/Products';
import { Settings } from '@/screens/Settings';
import { NestEgg } from '@/screens/NestEgg';
import { Intro } from '@/screens/Intro';
import { Chat } from '@/screens/Chat';
import { LockScreen } from '@/screens/LockScreen';
import { TxDetail } from '@/screens/TxDetail';
import { ProductDetail } from '@/screens/ProductDetail';
import { EmptyState } from '@/screens/EmptyState';

export default function Index() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

const SCREENS: Record<string, () => JSX.Element> = {
  home: Home, piggy: Piggy, ledger: Ledger, my: My,
  connect: Connect, verifiedDetail: VerifiedDetail, tax: Tax, retirement: Retirement,
  dataSovereignty: DataSovereignty, products: Products, settings: Settings, nestEgg: NestEgg, txDetail: TxDetail,
  productDetail: ProductDetail, emptyState: EmptyState,
};

function Shell() {
  const { entered, tab, push, sheet, vals, actions } = useApp();
  const insets = useSafeAreaInsets();
  const Screen = SCREENS[vals.scr] || Home;

  // 벨 인박스 — 어젠다 큐(피기가 아직 말하지 않은 사건). 시트가 닫힐 때마다 재조회:
  // 배분 승인/조정 직후가 바로 어젠다(후속 질문·브리핑)가 생기는 순간이다
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [inbox, setInbox] = useState(false);
  const personaBooted = useRef(false);
  // 온보딩 뒤 백그라운드 판독. 입금 핫패스를 막지 않으며, 완료 전에는 모든 화면이
  // '소득 구조 기반'이라고 정직하게 표시한다. 없거나 stale인 축만 다시 읽는다.
  useEffect(() => {
    if (!entered || personaBooted.current) return;
    personaBooted.current = true;
    getPersona()
      .then((p) => {
        if (!p.staleness || p.staleness.stale !== false) return readPersona('onboarding');
        return undefined;
      })
      .catch(() => readPersona('onboarding'))
      .catch(() => {});
  }, [entered]);
  useEffect(() => {
    if (!sheet && entered) getAgenda().then((r) => setAgenda(r.items)).catch(() => {});
  }, [sheet, entered]);
  const openInbox = () => { if (agenda.length) setInbox(true); };
  const closeInbox = (consume: boolean) => {
    setInbox(false);
    if (consume) { consumeAgenda().catch(() => {}); setAgenda([]); }
  };

  // 인트로 플로우 / 풀스크린(자체 chrome) 화면들
  if (!entered) return <Intro />;
  if (push === 'chat') return <Chat />;
  if (push === 'lockscreen') return <LockScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* 헤더 */}
      {vals.showGreeting && (
        <View style={{ height: 54, paddingHorizontal: 20, paddingTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Mascot head size={38} radius={19} style={{ borderWidth: 1, borderColor: colors.line }} />
            <View>
              <Text style={{ fontSize: 17, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>조대흠님</Text>
              <Text style={{ fontSize: 11.5, color: '#8A9098', fontWeight: '500' }}>프리랜스 개발자</Text>
            </View>
          </View>
          <Pressable onPress={openInbox} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell" size={22} color="#3A4047" sw={1.8} />
            {agenda.length > 0 && (
              <View style={{ position: 'absolute', top: 3, right: 3, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: '#FF4D4F', borderWidth: 1.5, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                <Text style={{ fontSize: 8.5, fontWeight: '800', color: '#fff' }}>{agenda.length}</Text>
              </View>
            )}
          </Pressable>
        </View>
      )}
      {vals.showTabTitle && (
        <View style={{ height: 52, paddingHorizontal: 20, paddingTop: 4, justifyContent: 'center' }}>
          <Text style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.6, color: colors.ink }}>{vals.tabTitle}</Text>
        </View>
      )}
      {vals.showBackHdr && (
        <View style={{ height: 52, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line3 }}>
          <Pressable onPress={actions.back} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevronLeft" size={24} color={colors.ink} sw={2} />
          </Pressable>
          <Text style={{ fontSize: 16.5, fontWeight: '700', letterSpacing: -0.3, color: colors.ink }}>{vals.headerTitle}</Text>
          <View style={{ width: 40 }} />
        </View>
      )}

      {/* 본문 */}
      <ScrollView key={vals.scr} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 14, paddingBottom: 26 }} showsVerticalScrollIndicator={false}>
        <Screen />
      </ScrollView>

      {/* 피기 코치 상시 플로팅 */}
      {!push && !sheet && (
        <Pressable onPress={() => actions.pushScr('chat')} style={{ position: 'absolute', right: 16, bottom: insets.bottom + 76, width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.greenLine, shadowColor: '#0F1217', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }}>
          <Mascot head size={42} radius={21} />
          <View style={{ position: 'absolute', top: -3, right: -3, backgroundColor: colors.green, borderRadius: 9, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1.5, borderColor: '#fff' }}>
            <Text style={{ fontSize: 8.5, fontWeight: '800', color: '#fff', letterSpacing: 0.3 }}>AI</Text>
          </View>
        </Pressable>
      )}

      {/* 탭바 */}
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line3, paddingTop: 9, paddingBottom: Math.max(insets.bottom, 8) }}>
        <TabButton icon="tabHome" label="홈" active={tab === 'home'} onPress={() => actions.nav('home')} />
        <TabButton icon="tabPiggy" label="저금통" active={tab === 'piggy'} onPress={() => actions.nav('piggy')} />
        <TabButton icon="tabLedger" label="가계부" active={tab === 'ledger'} onPress={() => actions.nav('ledger')} />
        <TabButton icon="tabMy" label="마이" active={tab === 'my'} onPress={() => actions.nav('my')} />
      </View>

      {/* 시트 */}
      {sheet === 'consent' && <ConsentSheet onConfirm={actions.confirm} onClose={actions.closeSheet} bottomInset={insets.bottom} />}
      {sheet === 'invest' && <InvestSheet onClose={actions.closeSheet} bottomInset={insets.bottom} />}
      {sheet === 'allocation' && <AllocationSheet onClose={actions.closeSheet} bottomInset={insets.bottom} />}
      {sheet === 'pacing' && <PacingSheet onClose={actions.closeSheet} bottomInset={insets.bottom} />}
      {inbox && (
        <InboxSheet
          items={agenda}
          bottomInset={insets.bottom}
          onAsk={() => { closeInbox(true); actions.pushScr('chat'); }}
          onClose={() => closeInbox(true)}
        />
      )}
    </SafeAreaView>
  );
}

// ⑤b 금액 페이싱 시트 — 여윳돈(버퍼)에서 목표 봉투로. 판단(우선순위·스탠스)은 AI,
// 원화 번역은 산수(합계 보존), 실행은 confirm만 — source=buffer 재배치 회계.
const STANCE_COLOR: Record<string, string> = { 당김: '#7C5CBF', 기본: colors.sub, 보류: colors.sub3 };

function PacingSheet({ onClose, bottomInset }: { onClose: () => void; bottomInset: number }) {
  const { actions } = useApp();
  const [prop, setProp] = useState<PacingProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    let live = true;
    getEnvelopeBalances()
      .then((e) => {
        const buffer = Math.floor(e.balances.buffer ?? 0);
        if (buffer <= 0) { if (live) setError('아직 여윳돈이 없어요 — 입금 배분 후 다시 열어주세요'); return; }
        return proposePacing(buffer, DEMO_DEPOSIT.date, 'buffer');
      })
      .then((p) => { if (live && p) setProp(p); })
      .catch(() => { if (live) setError('제안을 불러오지 못했어요 — 서버 연결을 확인해 주세요'); });
    return () => { live = false; };
  }, []);

  const confirm = async () => {
    if (!prop || confirming) return;
    setConfirming(true);
    try {
      await decidePacing(prop.id, 'confirm');
      actions.applyPacing({});
    } catch {
      setError('반영하지 못했어요 — 잔액이 바뀌었는지 확인한 뒤 다시 시도해 주세요');
      setConfirming(false);
    }
  };
  const reject = () => {
    if (!prop) { onClose(); return; }
    decidePacing(prop.id, 'reject').catch(() => {}).finally(onClose);
  };

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,18,23,.45)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 28 + bottomInset }}>
        <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: '#E2E5E9', alignSelf: 'center', marginBottom: 16 }} />
        {error ? (
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 10 }}>
            <Text style={{ fontSize: 13, color: colors.sub, fontWeight: '600', textAlign: 'center', lineHeight: 19 }}>{error}</Text>
            <Pressable onPress={onClose} style={{ alignSelf: 'stretch', borderWidth: 1.4, borderColor: colors.line, borderRadius: 15, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: colors.sub, fontSize: 14.5, fontWeight: '700' }}>닫기</Text>
            </Pressable>
          </View>
        ) : !prop ? (
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 22 }}>
            <Mascot head size={48} radius={15} />
            <Text style={{ fontSize: 13.5, color: colors.sub, fontWeight: '600', textAlign: 'center' }}>피기가 목표별 페이스를 판단하고 있어요 …{'\n'}<Text style={{ fontSize: 11.5, color: colors.sub3 }}>온디바이스 AI라 몇 초 걸릴 수 있어요</Text></Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Mascot head size={44} radius={13} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', letterSpacing: -0.4, color: colors.ink }}>여윳돈 ₩{prop.available.toLocaleString('en-US')} 나누기</Text>
                <Text style={{ fontSize: 12, color: colors.sub2, fontWeight: '500', marginTop: 2 }}>
                  {prop.persona_used ? '금융 성향·팩트를 읽고 우선순위를 판단했어요' : '소득 구조·목표 기한을 기준으로 판단했어요'}
                </Text>
              </View>
              <Text style={{ fontSize: 10, fontWeight: '800', color: prop.persona_used ? '#7C5CBF' : colors.green, backgroundColor: prop.persona_used ? '#F5F1FB' : colors.greenTint, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7, overflow: 'hidden' }}>{prop.persona_used ? '성향 반영' : '구조 기반'}</Text>
            </View>
            <View style={{ backgroundColor: colors.bg, borderRadius: 16, padding: 14, marginTop: 14, gap: 9 }}>
              {prop.goals.map((g) => (
                <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: STANCE_COLOR[g.stance] ?? colors.sub, backgroundColor: '#fff', paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7, overflow: 'hidden' }}>{g.stance}</Text>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.sub }}>{g.name}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink }}>₩{g.amount.toLocaleString('en-US')}</Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: colors.line2, paddingTop: 9 }}>
                <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '600', color: colors.sub2 }}>여윳돈에 남김</Text>
                <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.sub }}>₩{(prop.split.buffer ?? 0).toLocaleString('en-US')}</Text>
              </View>
            </View>
            <View style={{ marginTop: 12, gap: 5 }}>
              <Text style={{ fontSize: 11, color: colors.sub2, fontWeight: '500', lineHeight: 16 }}>· {prop.judgment.reason || prop.reasons[0]}</Text>
              {!prop.persona_used && <Text style={{ fontSize: 10.5, color: colors.sub3, fontWeight: '500', lineHeight: 15 }}>· 금융 성향 판독이 완료되면 다음 제안부터 성향까지 반영해요</Text>}
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable onPress={reject} style={{ flex: 1, borderWidth: 1.4, borderColor: colors.line, borderRadius: 15, paddingVertical: 15, alignItems: 'center' }}>
                <Text style={{ color: colors.sub, fontSize: 14.5, fontWeight: '700' }}>이번엔 안 할래요</Text>
              </Pressable>
              <Pressable onPress={confirm} disabled={confirming} style={{ flex: 1.6, backgroundColor: colors.green, borderRadius: 15, paddingVertical: 15, alignItems: 'center', shadowColor: colors.green, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, opacity: confirming ? 0.6 : 1 }}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{confirming ? '반영 중…' : '이대로 담기'}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// 벨 인박스 시트 — 어젠다 큐의 발화문(결정론 템플릿) 목록. 열람 = spoken 처리(consume).
const AGENDA_BADGE: Record<string, string> = {
  follow_up_adjust: '질문', follow_up_reject: '질문',
  deposit_briefing: '브리핑', stale_settlement: '확인 필요',
};

function InboxSheet({ items, bottomInset, onAsk, onClose }: {
  items: AgendaItem[]; bottomInset: number; onAsk: () => void; onClose: () => void;
}) {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,18,23,.45)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 28 + bottomInset }}>
        <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: '#E2E5E9', alignSelf: 'center', marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Mascot head size={40} radius={12} />
          <Text style={{ flex: 1, fontSize: 16.5, fontWeight: '800', color: colors.ink }}>피기가 전할 소식 {items.length}건</Text>
        </View>
        <View style={{ marginTop: 14, gap: 8 }}>
          {items.map((it, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 9, backgroundColor: colors.bg, borderRadius: 13, padding: 12 }}>
              <Text style={{ fontSize: 9.5, fontWeight: '800', color: it.priority === 1 ? colors.pinkStrong : colors.green, backgroundColor: '#fff', paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7, overflow: 'hidden', alignSelf: 'flex-start' }}>
                {AGENDA_BADGE[it.kind] ?? '소식'}
              </Text>
              <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '600', color: colors.ink, lineHeight: 18 }}>{it.line}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Pressable onPress={onClose} style={{ flex: 1, borderWidth: 1.4, borderColor: colors.line, borderRadius: 15, paddingVertical: 15, alignItems: 'center' }}>
            <Text style={{ color: colors.sub, fontSize: 14.5, fontWeight: '700' }}>확인했어요</Text>
          </Pressable>
          <Pressable onPress={onAsk} style={{ flex: 1.6, backgroundColor: colors.green, borderRadius: 15, paddingVertical: 15, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>피기와 이야기하기</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// 입금 도착 → 배분 제안 시트 — 백엔드 파이프라인(예측→배분→코치 확인) 라이브 데모.
// 서버가 꺼져 있으면 동일 수치의 오프라인 제안으로 폴백(데모가 죽지 않는 원칙).
// 조정 = 즉시가용 ↔ 여윳돈만 (세금·경비는 불가침) — 조정 방향은 학습 배분 정책의
// 방향 크레딧으로 귀속돼 다음 제안의 안전 수준을 움직인다 (백엔드 credits_for).
const ADJUST_STEP = 100_000;

function AllocationSheet({ onClose, bottomInset }: { onClose: () => void; bottomInset: number }) {
  const { actions } = useApp();
  const [alloc, setAlloc] = useState<Allocation | null>(null);
  const [offline, setOffline] = useState(false);
  const [done, setDone] = useState<null | 'confirmed' | 'adjusted'>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [delta, setDelta] = useState(0); // 즉시가용 → 여윳돈 이동액 (음수 = 반대 방향)
  // ⑥ AI 상품 매칭 — 룰 훅을 즉시 보여주고, 로컬 LLM 매칭이 돌아오면 승급 (핫패스 비차단)
  const [aiHooks, setAiHooks] = useState<ProductMatchPick[] | null>(null);
  // 같은 사건을 코치 챗·잠금화면 알림이 이어 말하도록 스토어에 기록
  const note = (a: Allocation, split: EnvelopeSplit, confirmed: boolean) =>
    actions.noteAllocation({ id: a.id, deposit: a.deposit, windfall: a.windfall_ratio, split, reasons: a.reasons, confirmed });
  useEffect(() => {
    let live = true;
    // 실제 입금 플로우: 백엔드가 원장 기록 + 분류 + 저장 이력 기반 제안까지 수행
    bankDeposit()
      .then((r) => {
        if (!live) return;
        if (r.allocation) {
          setAlloc(r.allocation); note(r.allocation, r.allocation.proposed, false);
          // 비동기 AI 승급 — 실패·타임아웃이면 룰 훅 그대로 (조용한 폴백)
          fetchProductMatch()
            .then((m) => { if (live && m.matches.length) setAiHooks(m.matches); })
            .catch(() => {});
        }
        else { setOffline(true); setAlloc(OFFLINE_ALLOCATION); note(OFFLINE_ALLOCATION, OFFLINE_ALLOCATION.proposed, false); }
      })
      .catch(() => { setOffline(true); setAlloc(OFFLINE_ALLOCATION); note(OFFLINE_ALLOCATION, OFFLINE_ALLOCATION.proposed, false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 조정본 — 합계는 구조적으로 보존된다 (한쪽에서 뺀 만큼 다른 쪽에 더함)
  const split: EnvelopeSplit | null = alloc
    ? {
        tax: alloc.proposed.tax,
        expense: alloc.proposed.expense,
        spendable: Math.round((alloc.proposed.spendable - delta) * 100) / 100,
        buffer: Math.round((alloc.proposed.buffer + delta) * 100) / 100,
      }
    : null;
  const canToBuffer = !!split && split.spendable - ADJUST_STEP >= 0;
  const canToSpendable = !!split && split.buffer - ADJUST_STEP >= 0;

  const confirm = async () => {
    if (!alloc) return;
    if (!offline) { try { await decideAllocation(alloc.id, 'confirm'); } catch {} }
    note(alloc, alloc.proposed, true);
    setDone('confirmed');
  };

  const applyAdjust = async () => {
    if (!alloc || !split) return;
    if (delta === 0) return confirm(); // 조정 0 = 그대로 승인
    if (!offline) { try { await decideAllocation(alloc.id, 'adjust', split); } catch {} }
    note(alloc, split, true);
    setDone('adjusted');
  };

  const ENV: { key: keyof EnvelopeSplit; label: string; color: string; locked?: boolean }[] = [
    { key: 'tax', label: '세금봉투', color: colors.tax, locked: true },
    { key: 'expense', label: '경비봉투', color: colors.expense, locked: true },
    { key: 'spendable', label: '즉시가용', color: colors.spendable },
    { key: 'buffer', label: '여윳돈', color: colors.buffer },
  ];

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,18,23,.45)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 28 + bottomInset }}>
        <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: '#E2E5E9', alignSelf: 'center', marginBottom: 16 }} />
        {!alloc || !split ? (
          <Text style={{ fontSize: 13.5, color: colors.sub, fontWeight: '600', textAlign: 'center', paddingVertical: 30 }}>피기가 배분을 계산하고 있어요 …</Text>
        ) : done ? (
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
            <Mascot head size={56} radius={17} />
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink }}>
              {done === 'adjusted' ? '조정하신 대로 반영했어요 ✓' : '봉투에 반영했어요 ✓'}
            </Text>
            <Text style={{ fontSize: 12.5, color: colors.sub2, fontWeight: '500', textAlign: 'center', lineHeight: 18 }}>
              {done === 'adjusted'
                ? `${delta > 0 ? '여윳돈을 더 두껍게' : '지금 쓸 돈을 더 넉넉히'} 가져가시는 방향을 학습했어요 — 다음 제안부터 반영돼요`
                : '승인해 주신 그대로 4개 봉투에 나눠 담았어요'}
            </Text>
            <Pressable onPress={onClose} style={{ alignSelf: 'stretch', backgroundColor: colors.green, borderRadius: 15, paddingVertical: 15, alignItems: 'center', marginTop: 6 }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>확인</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Mascot head size={44} radius={13} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', letterSpacing: -0.4, color: colors.ink }}>₩{alloc.deposit.toLocaleString('en-US')} 도착!</Text>
                <Text style={{ fontSize: 12.5, color: colors.sub2, fontWeight: '500', marginTop: 2 }}>
                  {adjusting ? '세금·경비는 지켜드려요 — 즉시가용과 여윳돈만 조정돼요' : `평소의 ${alloc.windfall_ratio.toFixed(1)}배 큰 입금이에요. 이렇게 나눌까요?`}
                </Text>
              </View>
              {offline && (
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.sub2, backgroundColor: '#F1F2F4', paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7, overflow: 'hidden' }}>오프라인</Text>
              )}
            </View>
            {/* 긱워커 소득 유형 — 이 배분이 왜 이 사람에게 맞는지의 근거(결정론 측정) */}
            {!adjusting && alloc.gig_archetype ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.greenTint2, borderRadius: 11, paddingVertical: 8, paddingHorizontal: 11, marginTop: 12 }}>
                <Text style={{ fontSize: 9.5, fontWeight: '800', color: colors.green, backgroundColor: '#fff', paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7, overflow: 'hidden' }}>내 긱 유형</Text>
                <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: colors.greenInk, lineHeight: 15 }}>{alloc.gig_archetype}</Text>
              </View>
            ) : null}
            {!adjusting && !offline ? (
              <View style={{ backgroundColor: alloc.persona_used ? '#F5F1FB' : colors.bg, borderWidth: 1, borderColor: alloc.persona_used ? '#E2D8F3' : colors.line, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 11, marginTop: 8, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Text style={{ fontSize: 9.5, fontWeight: '800', color: alloc.persona_used ? '#7C5CBF' : colors.sub2, backgroundColor: '#fff', paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7, overflow: 'hidden' }}>{alloc.persona_used ? '금융 성향 반영' : '소득 구조 기반'}</Text>
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: colors.ink }}>
                    {alloc.persona_used && alloc.policy
                      ? `안전 ${alloc.policy.arm_id} · 여윳돈 목표 ${alloc.policy.months.toFixed(1)}개월`
                      : '성향은 판독 완료 후 다음 제안부터 반영'}
                  </Text>
                </View>
                <Text style={{ fontSize: 10.5, color: colors.sub2, fontWeight: '500', lineHeight: 15 }}>
                  여윳돈 목표 ₩{alloc.buffer_target.toLocaleString('en-US')}{alloc.persona_staleness?.stale ? ' · 기존 성향은 오래되어 이번 계산에서 제외' : ''}
                </Text>
              </View>
            ) : null}
            <View style={{ backgroundColor: colors.bg, borderRadius: 16, padding: 14, marginTop: 14, gap: 9 }}>
              {ENV.map((e) => {
                const changed = adjusting && !e.locked && split[e.key] !== alloc.proposed[e.key];
                return (
                  <View key={e.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: e.color }} />
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.sub }}>{e.label}</Text>
                    {adjusting && e.locked && (
                      <Text style={{ fontSize: 9.5, fontWeight: '800', color: colors.sub3, backgroundColor: '#F1F2F4', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6, overflow: 'hidden' }}>잠금</Text>
                    )}
                    <Text style={{ fontSize: 14, fontWeight: '800', color: changed ? colors.green : colors.ink }}>
                      ₩{split[e.key].toLocaleString('en-US')}
                    </Text>
                  </View>
                );
              })}
            </View>
            {adjusting ? (
              /* 조정 컨트롤 — 방향이 곧 신호: 이 조정이 다음 제안의 안전 수준을 학습시킨다 */
              <View style={{ marginTop: 12, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pressable
                    onPress={() => canToSpendable && setDelta((d) => d - ADJUST_STEP)}
                    style={{ flex: 1, borderWidth: 1.4, borderColor: canToSpendable ? colors.spendable : colors.line, borderRadius: 12, paddingVertical: 11, alignItems: 'center', opacity: canToSpendable ? 1 : 0.4 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.sub }}>← 지금 쓸 돈 +10만</Text>
                  </Pressable>
                  <Text style={{ minWidth: 86, textAlign: 'center', fontSize: 12, fontWeight: '800', color: delta === 0 ? colors.sub3 : colors.green }}>
                    {delta === 0 ? '제안 그대로' : delta > 0 ? `여윳돈 +${(delta / 10_000).toFixed(0)}만` : `생활비 +${(-delta / 10_000).toFixed(0)}만`}
                  </Text>
                  <Pressable
                    onPress={() => canToBuffer && setDelta((d) => d + ADJUST_STEP)}
                    style={{ flex: 1, borderWidth: 1.4, borderColor: canToBuffer ? colors.buffer : colors.line, borderRadius: 12, paddingVertical: 11, alignItems: 'center', opacity: canToBuffer ? 1 : 0.4 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.sub }}>여윳돈 +10만 →</Text>
                  </Pressable>
                </View>
                <Text style={{ fontSize: 10.5, color: colors.sub3, fontWeight: '500', lineHeight: 15 }}>
                  조정 방향은 피기가 학습해요 — 자주 늘리시는 쪽으로 다음 제안의 안전 수준이 움직여요
                </Text>
              </View>
            ) : (
              <View style={{ marginTop: 12, gap: 5 }}>
                {alloc.reasons.map((r, i) => (
                  <Text key={i} style={{ fontSize: 11, color: colors.sub2, fontWeight: '500', lineHeight: 16 }}>· {r}</Text>
                ))}
              </View>
            )}
            {/* 하나 상품 훅 — 룰 훅 즉시 표시 → AI 매칭(페르소나·팩트 접지) 도착 시 승급.
                AI 배지만 보라(시각 스킴: AI가 판단한 곳만 표시), 탭하면 상품 상세로 (조정 중 숨김) */}
            {!adjusting && (aiHooks ?? alloc.product_hooks ?? []).map((h) => {
              const isAi = 'source' in h && h.source === 'llm';
              return (
                <Pressable
                  key={h.product_id}
                  onPress={() => actions.openProduct(h.product_id as ProductKey)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: isAi ? '#F5F1FB' : colors.greenTint2, borderWidth: 1, borderColor: isAi ? '#E2D8F3' : colors.greenLine, borderRadius: 12, padding: 11, marginTop: 8 }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: isAi ? '#7C5CBF' : colors.green, backgroundColor: '#fff', paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7, overflow: 'hidden' }}>
                    {isAi ? 'AI 맞춤' : '하나 상품'}
                  </Text>
                  <Text style={{ flex: 1, fontSize: 11.5, fontWeight: '600', color: colors.ink, lineHeight: 16 }}>{h.line}</Text>
                  <Icon name="chevronRight" size={15} color={isAi ? '#7C5CBF' : colors.green} sw={2.2} />
                </Pressable>
              );
            })}
            {adjusting ? (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <Pressable onPress={() => { setAdjusting(false); setDelta(0); }} style={{ flex: 1, borderWidth: 1.4, borderColor: colors.line, borderRadius: 15, paddingVertical: 15, alignItems: 'center' }}>
                  <Text style={{ color: colors.sub, fontSize: 14.5, fontWeight: '700' }}>취소</Text>
                </Pressable>
                <Pressable onPress={applyAdjust} style={{ flex: 2, backgroundColor: colors.green, borderRadius: 15, paddingVertical: 15, alignItems: 'center', shadowColor: colors.green, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } }}>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{delta === 0 ? '그대로 반영' : '이렇게 반영'}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <Pressable onPress={onClose} style={{ flex: 1, borderWidth: 1.4, borderColor: colors.line, borderRadius: 15, paddingVertical: 15, alignItems: 'center' }}>
                  <Text style={{ color: colors.sub, fontSize: 14.5, fontWeight: '700' }}>나중에</Text>
                </Pressable>
                <Pressable onPress={() => setAdjusting(true)} style={{ flex: 1, borderWidth: 1.4, borderColor: colors.green, borderRadius: 15, paddingVertical: 15, alignItems: 'center' }}>
                  <Text style={{ color: colors.green, fontSize: 14.5, fontWeight: '800' }}>조정</Text>
                </Pressable>
                <Pressable onPress={confirm} style={{ flex: 1.6, backgroundColor: colors.green, borderRadius: 15, paddingVertical: 15, alignItems: 'center', shadowColor: colors.green, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } }}>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>이대로 반영</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function InvestSheet({ onClose, bottomInset }: { onClose: () => void; bottomInset: number }) {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,18,23,.45)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 28 + bottomInset }}>
        <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: '#E2E5E9', alignSelf: 'center', marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Mascot head size={44} radius={13} />
          <View>
            <Text style={{ fontSize: 18, fontWeight: '800', letterSpacing: -0.4, color: colors.ink }}>여윳돈 ₩99,555</Text>
            <Text style={{ fontSize: 12.5, color: colors.sub2, fontWeight: '500', marginTop: 2 }}>버퍼 초과분, 보수적으로 굴려볼까요?</Text>
          </View>
        </View>
        <View style={{ backgroundColor: colors.bg, borderRadius: 16, padding: 16, marginTop: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.sub }}>안전 70%</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.sub }}>성장 30%</Text>
          </View>
          <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2, marginTop: 8 }}>
            <View style={{ width: '70%', backgroundColor: colors.spendable }} />
            <View style={{ flex: 1, backgroundColor: colors.buffer }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Mini name="하나 ISA · 예금형" amt="₩69,688" />
            <Mini name="하나증권 · 소수점" amt="₩29,867" />
          </View>
        </View>
        <View style={{ backgroundColor: colors.greenTint2, borderRadius: 14, padding: 13, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="trending" size={18} color="#fff" sw={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.ink }}>하나증권 · 장 시작 예약 주문</Text>
            <Text style={{ fontSize: 11, color: colors.sub, fontWeight: '500', marginTop: 2, lineHeight: 16 }}>밤에 일하는 당신 대신 오전 9시에 걸어둬요. AI는 제안만, 마지막 실행은 직접 확인해요.</Text>
          </View>
        </View>
        <Text style={{ fontSize: 11.5, color: colors.sub3, fontWeight: '500', marginTop: 12, lineHeight: 18 }}>투자는 원금 손실이 발생할 수 있어요. 즉시가용·세금봉투는 건드리지 않아요.</Text>
        <Pressable onPress={onClose} style={{ backgroundColor: colors.green, borderRadius: 15, paddingVertical: 16, alignItems: 'center', marginTop: 14, shadowColor: colors.green, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } }}>
          <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '800' }}>보수적으로 시작하기</Text>
        </Pressable>
        <Pressable onPress={onClose} style={{ paddingVertical: 10, alignItems: 'center', marginTop: 2 }}>
          <Text style={{ color: colors.sub2, fontSize: 14, fontWeight: '700' }}>다음에 할게요</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Mini({ name, amt }: { name: string; amt: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 11, paddingHorizontal: 13 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.ink }}>{name}</Text>
      <Text style={{ fontSize: 11, color: colors.sub2, fontWeight: '500', marginTop: 2 }}>{amt}</Text>
    </View>
  );
}

function TabButton({ icon, label, active, onPress }: { icon: IconName; label: string; active: boolean; onPress: () => void }) {
  const c = active ? colors.green : '#9AA1A9';
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Icon name={icon} size={25} color={c} />
      <Text style={{ fontSize: 10.5, fontWeight: '700', color: c }}>{label}</Text>
    </Pressable>
  );
}

function ConsentSheet({ onConfirm, onClose, bottomInset }: { onConfirm: () => void; onClose: () => void; bottomInset: number }) {
  const items = ['입출금 내역', '소득 · 지급 내역', '카드 사용 내역'];
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,18,23,.42)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 30 + bottomInset }}>
        <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: '#E2E5E9', alignSelf: 'center', marginBottom: 18 }} />
        <Text style={{ fontSize: 19, fontWeight: '800', letterSpacing: -0.4, color: colors.ink }}>마이데이터 연결 동의</Text>
        <Text style={{ fontSize: 12.5, color: colors.sub2, fontWeight: '500', marginTop: 5 }}>안전하게 암호화되어 전송되며, 언제든 철회할 수 있어요</Text>
        <View style={{ marginTop: 18 }}>
          {items.map((it, i) => (
            <View key={it} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.line2 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="check" size={15} color="#fff" sw={2.6} />
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{it}</Text>
            </View>
          ))}
        </View>
        <Pressable onPress={onConfirm} style={{ marginTop: 18, backgroundColor: colors.green, borderRadius: 15, paddingVertical: 16, alignItems: 'center', shadowColor: colors.green, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } }}>
          <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '800' }}>동의하고 연결</Text>
        </Pressable>
        <Pressable onPress={onClose} style={{ marginTop: 8, paddingVertical: 10, alignItems: 'center' }}>
          <Text style={{ color: colors.sub2, fontSize: 14, fontWeight: '700' }}>취소</Text>
        </Pressable>
      </View>
    </View>
  );
}
