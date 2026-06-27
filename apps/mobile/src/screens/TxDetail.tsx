import { View, Text } from 'react-native';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card, T } from '@/components/ui';

export function TxDetail() {
  return (
    <View style={{ gap: 14 }}>
      {/* 거래 헤더 */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.sub }}>구독</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>Figma 구독</Text>
            <Text style={{ fontSize: 12.5, color: colors.sub2, fontWeight: '500', marginTop: 2 }}>경비 · 소프트웨어</Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.sub2, ...T.num }}>−₩18,000</Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '600' }}>분류</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', marginTop: 3, color: colors.ink }}>경비봉투</Text>
          </View>
          <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: colors.line, paddingLeft: 16 }}>
            <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '600' }}>결제일</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', marginTop: 3, color: colors.ink }}>2025.05.18</Text>
          </View>
        </View>
      </Card>

      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sub, marginHorizontal: 4, marginBottom: -4 }}>자동 분류</Text>
      <Card p={0} style={{ paddingHorizontal: 16 }}>
        <Row icon="card" color={colors.expense} title="경비봉투에서 차감" desc="운영 경비로 미리 잡아둔 돈에서 빠져요" border />
        <Row icon="building" color={colors.green} title="종소세 절세 반영" desc="사업 경비 → 과세표준에서 제외" />
      </Card>

      <View style={{ backgroundColor: '#FBFBFC', borderWidth: 1, borderColor: colors.dash, borderStyle: 'dashed', borderRadius: 14, padding: 14 }}>
        <Text style={{ fontSize: 12, color: colors.sub, lineHeight: 19, fontWeight: '500' }}>
          <Text style={{ fontWeight: '800', color: colors.ink2 }}>경비 자동 분류</Text>{'\n'}
          소프트웨어·장비 구독은 사업 경비로 자동 분류돼, 과세표준에서 빠지고 5월에 낼 세금이 줄어요.
        </Text>
      </View>
    </View>
  );
}

function Row({ icon, color, title, desc, border }: { icon: 'card' | 'building'; color: string; title: string; desc: string; border?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14, borderBottomWidth: border ? 1 : 0, borderBottomColor: colors.line2 }}>
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: '#F4F5F6', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{title}</Text>
        <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '500', marginTop: 2 }}>{desc}</Text>
      </View>
    </View>
  );
}
