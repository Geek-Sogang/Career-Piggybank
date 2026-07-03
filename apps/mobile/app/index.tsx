import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { decideAllocation, proposeAllocation, OFFLINE_ALLOCATION, type Allocation, type EnvelopeSplit } from '@/api';
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
              <Text style={{ fontSize: 17, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>김도현님</Text>
              <Text style={{ fontSize: 11.5, color: '#8A9098', fontWeight: '500' }}>프리랜스 개발자</Text>
            </View>
          </View>
          <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell" size={22} color="#3A4047" sw={1.8} />
            <View style={{ position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF4D4F', borderWidth: 1.5, borderColor: colors.bg }} />
          </View>
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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 14, paddingBottom: 26 }} showsVerticalScrollIndicator={false}>
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
    </SafeAreaView>
  );
}

// 입금 도착 → 배분 제안 시트 — 백엔드 파이프라인(예측→배분→코치 확인) 라이브 데모.
// 서버가 꺼져 있으면 동일 수치의 오프라인 제안으로 폴백(데모가 죽지 않는 원칙).
function AllocationSheet({ onClose, bottomInset }: { onClose: () => void; bottomInset: number }) {
  const [alloc, setAlloc] = useState<Allocation | null>(null);
  const [offline, setOffline] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    proposeAllocation(3_000_000)
      .then(setAlloc)
      .catch(() => { setOffline(true); setAlloc(OFFLINE_ALLOCATION); });
  }, []);

  const confirm = async () => {
    if (!alloc) return;
    if (!offline) { try { await decideAllocation(alloc.id, 'confirm'); } catch {} }
    setDone(true);
  };

  const ENV: { key: keyof EnvelopeSplit; label: string; color: string }[] = [
    { key: 'tax', label: '세금봉투', color: colors.tax },
    { key: 'expense', label: '경비봉투', color: colors.expense },
    { key: 'spendable', label: '즉시가용', color: colors.spendable },
    { key: 'buffer', label: '여윳돈', color: colors.buffer },
  ];

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,18,23,.45)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 28 + bottomInset }}>
        <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: '#E2E5E9', alignSelf: 'center', marginBottom: 16 }} />
        {!alloc ? (
          <Text style={{ fontSize: 13.5, color: colors.sub, fontWeight: '600', textAlign: 'center', paddingVertical: 30 }}>피기가 배분을 계산하고 있어요 …</Text>
        ) : done ? (
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
            <Mascot head size={56} radius={17} />
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink }}>봉투에 반영했어요 ✓</Text>
            <Text style={{ fontSize: 12.5, color: colors.sub2, fontWeight: '500' }}>승인해 주신 그대로 4개 봉투에 나눠 담았어요</Text>
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
                  평소의 {alloc.windfall_ratio.toFixed(1)}배 큰 입금이에요. 이렇게 나눌까요?
                </Text>
              </View>
              {offline && (
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.sub2, backgroundColor: '#F1F2F4', paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7, overflow: 'hidden' }}>오프라인</Text>
              )}
            </View>
            <View style={{ backgroundColor: colors.bg, borderRadius: 16, padding: 14, marginTop: 14, gap: 9 }}>
              {ENV.map((e) => (
                <View key={e.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                  <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: e.color }} />
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.sub }}>{e.label}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink }}>₩{alloc.proposed[e.key].toLocaleString('en-US')}</Text>
                </View>
              ))}
            </View>
            <View style={{ marginTop: 12, gap: 5 }}>
              {alloc.reasons.slice(0, 4).map((r, i) => (
                <Text key={i} style={{ fontSize: 11, color: colors.sub2, fontWeight: '500', lineHeight: 16 }}>· {r}</Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable onPress={onClose} style={{ flex: 1, borderWidth: 1.4, borderColor: colors.line, borderRadius: 15, paddingVertical: 15, alignItems: 'center' }}>
                <Text style={{ color: colors.sub, fontSize: 14.5, fontWeight: '700' }}>나중에</Text>
              </Pressable>
              <Pressable onPress={confirm} style={{ flex: 2, backgroundColor: colors.green, borderRadius: 15, paddingVertical: 15, alignItems: 'center', shadowColor: colors.green, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } }}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>이대로 반영</Text>
              </Pressable>
            </View>
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
