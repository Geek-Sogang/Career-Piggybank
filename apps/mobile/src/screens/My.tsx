import { View, Text, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { Icon, type IconName } from '@/components/Icon';
import { Card, Mascot } from '@/components/ui';
import { useApp, type Push } from '@/store';

const MENU: { icon: IconName; color: string; label: string; push: Exclude<Push, null> }[] = [
  { icon: 'shield', color: colors.green, label: '데이터 주권 · 관리', push: 'dataSovereignty' },
  { icon: 'cardLink', color: colors.pinkStrong, label: '상품 연결', push: 'products' },
  { icon: 'gear', color: colors.sub, label: '알림 · 설정', push: 'settings' },
];

export function My() {
  const { vals, actions } = useApp();
  return (
    <View style={{ gap: 14 }}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Mascot head size={56} radius={16} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', letterSpacing: -0.4, color: colors.ink }}>조대흠</Text>
          <Text style={{ fontSize: 12.5, color: colors.sub2, fontWeight: '500', marginTop: 2 }}>프리랜스 개발자 · 28세</Text>
        </View>
        <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.green, backgroundColor: colors.greenTint, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 10, overflow: 'hidden' }}>확정 ✓</Text>
      </Card>

      <Card style={{ flexDirection: 'row' }}>
        <MyStat value="12건" label="검증" />
        <MyStat value="확정" label="검증 단계" color={colors.green} borderLeft />
        <MyStat value={`${vals.score}점`} label="커리어 점수" borderLeft />
      </Card>

      <Card p={0} style={{ paddingHorizontal: 16 }}>
        {MENU.map((m, i) => (
          <Pressable key={m.label} onPress={() => actions.pushScr(m.push)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 15, borderBottomWidth: i < MENU.length - 1 ? 1 : 0, borderBottomColor: colors.line2 }}>
            <Icon name={m.icon} size={20} color={m.color} />
            <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{m.label}</Text>
            <Icon name="chevronRight" size={18} color="#C2C7CE" sw={2.2} />
          </Pressable>
        ))}
      </Card>
    </View>
  );
}

function MyStat({ value, label, color, borderLeft }: { value: string; label: string; color?: string; borderLeft?: boolean }) {
  return (
    <View style={{ flex: 1, borderLeftWidth: borderLeft ? 1 : 0, borderLeftColor: colors.line, paddingLeft: borderLeft ? 16 : 0 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: color || colors.ink }}>{value}</Text>
      <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '600', marginTop: 2 }}>{label}</Text>
    </View>
  );
}
