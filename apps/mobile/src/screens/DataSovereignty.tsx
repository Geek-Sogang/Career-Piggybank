import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card, Toggle } from '@/components/ui';
import { useApp, type ConnSrc } from '@/store';

const SOURCES: { key: ConnSrc; label: string }[] = [
  { key: 'github', label: 'GitHub' },
  { key: 'mydata', label: '마이데이터' },
  { key: 'hometax', label: '홈택스' },
  { key: 'behance', label: 'Behance' },
];
const CONSENTS = [
  { t: '수집 · 보관', d: '활동·소득 데이터 저장', def: true },
  { t: 'VC 외부 제시', d: '검증서를 외부에 증명', def: true },
  { t: '여신 · 투자 활용', d: '한도·상품 심사에 사용', def: false },
];

export function DataSovereignty() {
  const { vals } = useApp();
  const [consent, setConsent] = useState(CONSENTS.map((c) => c.def));
  return (
    <View style={{ gap: 13 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.greenTint, borderWidth: 1, borderColor: '#D2E8E8', borderRadius: 16, padding: 14, paddingHorizontal: 16 }}>
        <Icon name="shieldCheck" size={26} color={colors.green} />
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.greenInk, lineHeight: 20 }}>내 데이터, 내가 관리해요.{'\n'}동의는 항목별로 따로 켜고 끌 수 있어요.</Text>
      </View>

      <Text style={[label]}>연동 현황</Text>
      <Card p={0} style={{ paddingHorizontal: 16 }}>
        {SOURCES.map((s, i) => {
          const on = vals.conn[s.key];
          return (
            <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: i < SOURCES.length - 1 ? 1 : 0, borderBottomColor: colors.line2 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: on ? colors.ink : colors.sub2 }}>{s.label}</Text>
              <Text style={{ fontSize: 12, fontWeight: on ? '700' : '600', color: on ? colors.green : colors.faint }}>{on ? '연결됨 ✓' : '미연결'}</Text>
            </View>
          );
        })}
      </Card>

      <Text style={[label]}>동의 항목 (3분)</Text>
      <Card p={0} style={{ paddingHorizontal: 16 }}>
        {CONSENTS.map((c, i) => (
          <View key={c.t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: i < CONSENTS.length - 1 ? 1 : 0, borderBottomColor: colors.line2 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.ink }}>{c.t}</Text>
              <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '500', marginTop: 1 }}>{c.d}</Text>
            </View>
            <Toggle on={consent[i]} onPress={() => setConsent((p) => p.map((v, j) => (j === i ? !v : v)))} />
          </View>
        ))}
      </Card>

      <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: '#F6D2D3', backgroundColor: '#FEF4F4', borderRadius: 14, padding: 14 }}>
        <View>
          <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.taxInk }}>데이터 삭제</Text>
          <Text style={{ fontSize: 11.5, color: '#D08688', fontWeight: '600', marginTop: 2 }}>삭제하면 진짜 사라집니다 (검증 이력 포함)</Text>
        </View>
        <Icon name="chevronRight" size={20} color={colors.tax} sw={2} />
      </Pressable>
    </View>
  );
}

const label = { fontSize: 13, fontWeight: '700' as const, color: colors.sub, marginHorizontal: 4, marginTop: 2, marginBottom: -4 };
