import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  dataSovereignty: DataSovereignty, products: Products, settings: Settings,
};

function Shell() {
  const { tab, sheet, vals, actions } = useApp();
  const insets = useSafeAreaInsets();
  const Screen = SCREENS[vals.scr] || Home;

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

      {/* 탭바 */}
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line3, paddingTop: 9, paddingBottom: Math.max(insets.bottom, 8) }}>
        <TabButton icon="tabHome" label="홈" active={tab === 'home'} onPress={() => actions.nav('home')} />
        <TabButton icon="tabPiggy" label="저금통" active={tab === 'piggy'} onPress={() => actions.nav('piggy')} />
        <TabButton icon="tabLedger" label="가계부" active={tab === 'ledger'} onPress={() => actions.nav('ledger')} />
        <TabButton icon="tabMy" label="마이" active={tab === 'my'} onPress={() => actions.nav('my')} />
      </View>

      {/* 동의 시트 */}
      {sheet === 'consent' && <ConsentSheet onConfirm={actions.confirm} onClose={actions.closeSheet} bottomInset={insets.bottom} />}
    </SafeAreaView>
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
