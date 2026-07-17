import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card, Toggle } from '@/components/ui';
import { useApp } from '@/store';

const ALERTS = ['특이 입출금 감지', '검증 완료', '세금 일정 (5월 등)', '마케팅 · 혜택'];
const PREFS: [string, string][] = [['생체 인증', 'Face ID'], ['언어', '한국어'], ['버전 정보', '1.0.0']];

export function Settings() {
  const { actions } = useApp();
  const [alerts, setAlerts] = useState([true, true, true, false]);
  return (
    <View style={{ gap: 13 }}>
      <Text style={[label]}>알림</Text>
      <Card p={0} style={{ paddingHorizontal: 16 }}>
        {ALERTS.map((a, i) => (
          <View key={a} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: i < ALERTS.length - 1 ? 1 : 0, borderBottomColor: colors.line2 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: alerts[i] ? colors.ink : colors.sub2 }}>{a}</Text>
            <Toggle on={alerts[i]} onPress={() => setAlerts((p) => p.map((v, j) => (j === i ? !v : v)))} />
          </View>
        ))}
      </Card>

      <Text style={[label]}>설정</Text>
      <Card p={0} style={{ paddingHorizontal: 16 }}>
        {PREFS.map(([k, val], i) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: i < PREFS.length - 1 ? 1 : 0, borderBottomColor: colors.line2 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>{k}</Text>
            <Text style={{ fontSize: 13, color: colors.sub2, fontWeight: '600' }}>{val}</Text>
          </View>
        ))}
      </Card>

      <Card p={0} style={{ paddingHorizontal: 16 }}>
        <Pressable onPress={() => actions.pushScr('lockscreen')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line2 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>알림 미리보기 (잠금화면)</Text>
          <Icon name="chevronRight" size={18} color="#C2C7CE" sw={2.2} />
        </Pressable>
        <Pressable onPress={() => actions.pushScr('emptyState')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line2 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>빈 상태 미리보기 (커리어)</Text>
          <Icon name="chevronRight" size={18} color="#C2C7CE" sw={2.2} />
        </Pressable>
        <Pressable onPress={() => actions.leave()} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>인트로 다시 보기</Text>
          <Icon name="chevronRight" size={18} color="#C2C7CE" sw={2.2} />
        </Pressable>
      </Card>
    </View>
  );
}

const label = { fontSize: 13, fontWeight: '700' as const, color: colors.sub, marginHorizontal: 4, marginTop: 2, marginBottom: -4 };
