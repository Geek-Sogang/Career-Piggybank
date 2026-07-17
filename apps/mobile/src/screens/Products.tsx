import { View, Text, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { Icon, type IconName } from '@/components/Icon';
import { Card } from '@/components/ui';
import { useApp } from '@/store';
import type { ProductKey } from '@/products';

const MORE: { key: ProductKey; icon: IconName; bg: string; color: string; name: string; desc: string }[] = [
  { key: 'account', icon: 'cardLink', bg: colors.bufferTint, color: colors.buffer, name: '하나 긱워커 통장', desc: '매출 자동분류 · 수수료 면제' },
  { key: 'youth', icon: 'coin', bg: colors.orangeTint, color: colors.orange, name: '하나원큐 햇살론유스', desc: '청년 정책금융 · 자격 확인' },
];

export function Products() {
  const { actions, vals } = useApp();
  return (
    <View style={{ gap: 14 }}>
      <Text style={{ fontSize: 13.5, color: colors.sub, fontWeight: '500', lineHeight: 20, marginHorizontal: 2 }}>
        커리어 점수는 한도를 계산하지 않아요. <Text style={{ color: colors.ink, fontWeight: '700' }}>검증 {vals.stage}</Text> 단계에 따라 연결할 수 있는 심사자료만 달라집니다.
      </Text>

      {/* 히어로 — 비상금 대출 */}
      <View style={{ backgroundColor: colors.green, borderRadius: 18, padding: 20, shadowColor: colors.green, shadowOpacity: 0.5, shadowRadius: 22, shadowOffset: { width: 0, height: 12 } }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#fff', backgroundColor: 'rgba(255,255,255,.18)', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 9, overflow: 'hidden' }}>{vals.reviewLabel}</Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,.8)', fontWeight: '600' }}>비상금</Text>
        </View>
        <Text style={{ fontSize: 19, fontWeight: '800', color: '#fff', letterSpacing: -0.4, marginTop: 14 }}>하나 긱워커 비상금대출</Text>
        <Text style={{ fontSize: 15.5, color: '#fff', fontWeight: '700', marginTop: 9 }}>{vals.reviewReady ? '연결된 자료를 심사 화면에 함께 가져갈 수 있어요' : '홈택스 또는 KOSA 확인 후 심사자료 연결이 열려요'}</Text>
        <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,.76)', fontWeight: '400', lineHeight: 17, marginTop: 5 }}>상품 자격·한도·금리는 하나원큐의 실제 심사에서 결정돼요</Text>
        <Pressable onPress={() => vals.reviewReady ? actions.openProduct('emergency') : actions.pushScr('connect')} style={{ backgroundColor: '#fff', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 16 }}>
          <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.green }}>{vals.reviewReady ? '검증자료와 함께 심사 보기' : '검증자료 준비하기'}</Text>
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
