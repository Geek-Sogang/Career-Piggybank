import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { Card, Mascot, Toggle } from '@/components/ui';
import { useApp, type ConnSrc } from '@/store';

const SOURCES: { key: ConnSrc; label: string }[] = [
  { key: 'github', label: 'GitHub' },
  { key: 'mydata', label: '마이데이터' },
  { key: 'hometax', label: '홈택스' },
  { key: 'behance', label: 'Behance' },
];
const CONSENTS = [
  { t: '① 수집 · 이용', d: '검증·점수 산출에 데이터 사용', def: true },
  { t: '② VC 외부 제시', d: '타 기관에 증명서를 골라 제시', def: true },
  { t: '③ 내부 여신 투입', d: '대출 심사 보조지표로 활용', def: false },
];

export function DataSovereignty() {
  const { vals, actions } = useApp();
  const [consent, setConsent] = useState(CONSENTS.map((c) => c.def));
  return (
    <View style={{ gap: 14 }}>
      <View style={{ backgroundColor: colors.greenTint2, borderWidth: 1, borderColor: colors.greenLine, borderRadius: 18, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Mascot head size={40} radius={12} style={{ backgroundColor: '#fff' }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.greenInk }}>내 통장은 내 것</Text>
          <Text style={{ fontSize: 12, color: '#5E7B7A', marginTop: 3, fontWeight: '500', lineHeight: 17 }}>연결한 데이터는 언제든 조회·해제·삭제할 수 있어요.</Text>
        </View>
      </View>

      <Text style={[label]}>연동 현황</Text>
      <Card p={0} style={{ paddingHorizontal: 16 }}>
        {SOURCES.map((s, i) => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: i < SOURCES.length - 1 ? 1 : 0, borderBottomColor: colors.line2 }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink }}>{s.label}</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: vals.conn[s.key] ? colors.green : colors.sub3, marginRight: 12 }}>{vals.conn[s.key] ? '연결됨' : '미연결'}</Text>
            <Toggle on={vals.conn[s.key]} onPress={() => actions.toggle(s.key)} />
          </View>
        ))}
      </Card>

      <Text style={[label]}>동의 삼분 분리</Text>
      <Card p={0} style={{ paddingHorizontal: 16 }}>
        {CONSENTS.map((c, i) => (
          <View key={c.t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: i < CONSENTS.length - 1 ? 1 : 0, borderBottomColor: colors.line2 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{c.t}</Text>
              <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '500', marginTop: 2 }}>{c.d}</Text>
            </View>
            <Toggle on={consent[i]} onPress={() => setConsent((p) => p.map((v, j) => (j === i ? !v : v)))} />
          </View>
        ))}
      </Card>

      <View style={{ backgroundColor: '#FFF6F6', borderWidth: 1, borderColor: '#F4D2D2', borderRadius: 16, padding: 16 }}>
        <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.taxInk }}>삭제하면 진짜 사라집니다</Text>
        <Text style={{ fontSize: 12, color: '#B07474', fontWeight: '500', marginTop: 4, lineHeight: 18 }}>원본은 폰에만 있고, 원장엔 암호화된 지문만 있어요. 삭제 시 폰의 원본·열쇠를 파기(crypto-shredding)해 복원이 불가능합니다.</Text>
        <Pressable style={{ marginTop: 12, borderWidth: 1.5, borderColor: colors.tax, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.tax }}>내 데이터 모두 삭제</Text>
        </Pressable>
      </View>
    </View>
  );
}

const label = { fontSize: 13, fontWeight: '700' as const, color: colors.sub, marginHorizontal: 4, marginTop: 2, marginBottom: -2 };
