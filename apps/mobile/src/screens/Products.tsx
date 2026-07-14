import { View, Text, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { Icon, type IconName } from '@/components/Icon';
import { Card, T } from '@/components/ui';
import { useApp } from '@/store';
import type { ProductKey } from '@/products';

const MORE: { key: ProductKey; icon: IconName; bg: string; color: string; name: string; desc: string }[] = [
  { key: 'account', icon: 'cardLink', bg: colors.bufferTint, color: colors.buffer, name: '하나 긱워커 통장', desc: '매출 자동분류 · 수수료 면제' },
  { key: 'youth', icon: 'coin', bg: colors.orangeTint, color: colors.orange, name: '하나원큐 햇살론유스', desc: '청년 정책금융 · 자격 확인' },
];

export function Products() {
  const { actions, vals } = useApp();
  // 비상금대출 한도 = min(상품 상한 200만, 검증 한도) — 점수·검증 단계가 실제 조건을 가른다
  const heroLimit = Math.min(2_000_000, vals.limit);
  return (
    <View style={{ gap: 14 }}>
      <Text style={{ fontSize: 13.5, color: colors.sub, fontWeight: '500', lineHeight: 20, marginHorizontal: 2 }}>
        검증된 한도 <Text style={{ color: colors.ink, fontWeight: '700' }}>{vals.limitManwon}만원</Text> 기준으로, 지금 받을 수 있는 조건이에요. <Text style={{ color: colors.sub2 }}>커리어 점수 {vals.score}점 × 검증 {vals.stage}</Text>
      </Text>

      {/* 히어로 — 비상금 대출 */}
      <View style={{ backgroundColor: colors.green, borderRadius: 18, padding: 20, shadowColor: colors.green, shadowOpacity: 0.5, shadowRadius: 22, shadowOffset: { width: 0, height: 12 } }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#fff', backgroundColor: 'rgba(255,255,255,.18)', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 9, overflow: 'hidden' }}>지금 가장 잘 맞아요</Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,.8)', fontWeight: '600' }}>비상금</Text>
        </View>
        <Text style={{ fontSize: 19, fontWeight: '800', color: '#fff', letterSpacing: -0.4, marginTop: 14 }}>하나 긱워커 비상금대출</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,.82)' }}>한도</Text>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.4, ...T.num }}>{heroLimit.toLocaleString('en-US')}원</Text>
        </View>
        <Text style={{ fontSize: 12.5, color: 'rgba(255,255,255,.82)', fontWeight: '500', marginTop: 4 }}>연 5.9%~ · 검증 활동 기반 중도상환 수수료 면제</Text>
        <Pressable onPress={() => actions.openProduct('emergency')} style={{ backgroundColor: '#fff', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 16 }}>
          <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.green }}>자세히 보고 신청</Text>
        </Pressable>
      </View>

      {MORE.map((m) => (
        <Pressable key={m.key} onPress={() => actions.openProduct(m.key)}>
          <Card p={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 16 }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: m.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={m.icon} size={22} color={m.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{m.name}</Text>
              <Text style={{ fontSize: 12, color: colors.sub2, fontWeight: '500', marginTop: 2 }}>{m.desc}</Text>
            </View>
            <Icon name="chevronRight" size={20} color="#C2C7CE" sw={2.2} />
          </Card>
        </Pressable>
      ))}
    </View>
  );
}
