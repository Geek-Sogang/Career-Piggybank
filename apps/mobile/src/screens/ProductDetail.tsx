import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { Card, T } from '@/components/ui';
import { useApp } from '@/store';
import { PRODUCTS } from '@/products';

export function ProductDetail() {
  const { product, vals, actions } = useApp();
  const p = PRODUCTS[product];
  const highlight = p.highlight;
  const needsVerification = product === 'emergency' && !vals.reviewReady;
  const [applied, setApplied] = useState(false);
  return (
    <View style={{ gap: 14 }}>
      <Card style={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
          <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: p.badgeBg, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: p.badgeColor }}>{p.badge}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.green }}>{p.tagline}</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', letterSpacing: -0.4, color: colors.ink, marginTop: 2 }}>{p.name}</Text>
          </View>
        </View>
        {highlight ? (
          <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line }}>
            <Text style={{ fontSize: 12, color: colors.sub2, fontWeight: '600' }}>{p.highlightLabel}</Text>
            <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: -1, color: colors.green, marginTop: 2, ...T.num }}>{highlight}</Text>
          </View>
        ) : null}
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {p.terms.map((t) => (
          <Text key={t} style={{ fontSize: 12, fontWeight: '700', color: colors.greenInk, backgroundColor: colors.greenTint, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10, overflow: 'hidden' }}>{t}</Text>
        ))}
      </View>

      <Card style={{ padding: 16 }}>
        <Text style={{ fontSize: 13.5, color: colors.ink2, fontWeight: '500', lineHeight: 22 }}>{p.desc}</Text>
      </Card>

      <View style={{ backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.dash, borderStyle: 'dashed', borderRadius: 14, padding: 14 }}>
        <Text style={{ fontSize: 12, color: colors.sub, lineHeight: 19, fontWeight: '500' }}>
          <Text style={{ fontWeight: '800', color: colors.ink2 }}>검증 연동</Text>{'\n'}
          커리어 검증 점수 {vals.score}점 · {vals.stage} 단계예요. {vals.reviewReady ? '연결된 자료를 심사 화면에 함께 가져갈 수 있어요.' : '홈택스 또는 KOSA 확인 후 검증자료 연결이 열려요.'}{'\n'}
          <Text style={{ fontWeight: '400', color: colors.sub2 }}>점수만으로 상품 자격·금리·한도를 계산하지 않아요.</Text>
        </Text>
      </View>

      <Pressable
        onPress={() => needsVerification ? actions.pushScr('connect') : setApplied(true)}
        style={{ backgroundColor: applied ? colors.greenTint : colors.green, borderRadius: 15, paddingVertical: 16, alignItems: 'center', marginTop: 2, shadowColor: colors.green, shadowOpacity: applied ? 0 : 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }}
      >
        <Text style={{ color: applied ? colors.green : '#fff', fontSize: 15.5, fontWeight: '800' }}>{applied ? '심사 연결됨 (데모)' : needsVerification ? '검증자료 준비하기' : p.cta}</Text>
      </Pressable>
      {applied ? <Text style={{ fontSize: 12, color: colors.sub2, textAlign: 'center', fontWeight: '400', marginTop: -4 }}>실제 자격·한도·금리는 하나원큐 심사에서 확인해요.</Text> : null}
    </View>
  );
}
