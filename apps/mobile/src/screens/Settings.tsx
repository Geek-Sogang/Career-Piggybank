import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { Card, Toggle } from '@/components/ui';

const ALERTS = ['특이 입출금 알림', '검증 완료 알림', '세금봉투 적립 알림', '5월 종소세 리마인드'];
const PREFS = ['생체 인증 잠금', '다크 모드'];

export function Settings() {
  const [alerts, setAlerts] = useState([true, true, true, false]);
  const [prefs, setPrefs] = useState([true, false]);
  return (
    <View style={{ gap: 14 }}>
      <Text style={[label]}>알림</Text>
      <Card p={0} style={{ paddingHorizontal: 16 }}>
        {ALERTS.map((a, i) => (
          <Row key={a} text={a} on={alerts[i]} onPress={() => setAlerts((p) => p.map((v, j) => (j === i ? !v : v)))} last={i === ALERTS.length - 1} />
        ))}
      </Card>

      <Text style={[label]}>설정</Text>
      <Card p={0} style={{ paddingHorizontal: 16 }}>
        {PREFS.map((a, i) => (
          <Row key={a} text={a} on={prefs[i]} onPress={() => setPrefs((p) => p.map((v, j) => (j === i ? !v : v)))} last={i === PREFS.length - 1} />
        ))}
      </Card>

      <Card p={0} style={{ paddingHorizontal: 16 }}>
        <Pressable style={{ paddingVertical: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.tax }}>로그아웃</Text>
        </Pressable>
      </Card>
      <Text style={{ fontSize: 11.5, color: colors.faint, fontWeight: '500', textAlign: 'center', marginTop: 2 }}>Career Piggybank v0.1 · 데모</Text>
    </View>
  );
}

function Row({ text, on, onPress, last }: { text: string; on: boolean; onPress: () => void; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line2 }}>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink }}>{text}</Text>
      <Toggle on={on} onPress={onPress} />
    </View>
  );
}

const label = { fontSize: 13, fontWeight: '700' as const, color: colors.sub, marginHorizontal: 4, marginTop: 2, marginBottom: -2 };
