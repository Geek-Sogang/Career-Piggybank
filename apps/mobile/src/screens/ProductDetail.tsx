import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { Card, T } from '@/components/ui';
import { useApp } from '@/store';
import { PRODUCTS } from '@/products';

export function ProductDetail() {
  const { product, vals } = useApp();
  const p = PRODUCTS[product];
  const highlight = product === 'emergency'
    ? `${Math.min(2_000_000, vals.limit).toLocaleString('en-US')}원`
    : p.highlight;
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

      <View style={{ backgroundColor: '#FBFBFC', borderWidth: 1, borderColor: colors.dash, borderStyle: 'dashed', borderRadius: 14, padding: 14 }}>
        <Text style={{ fontSize: 12, color: colors.sub, lineHeight: 19, fontWeight: '500' }}>
          <Text style={{ fontWeight: '800', color: colors.ink2 }}>검증 연동</Text>{'\n'}
          내 커리어 점수 {vals.score}점(검증 {vals.stage})이 보조지표로 들어가요 — 지금 검증 한도 ₩{vals.limitWon}. 데이터를 더 연결하면 같은 조건에서 더 나은 한도·우대를 받아요.
        </Text>
      </View>

      <Pressable
        onPress={() => setApplied(true)}
        style={{ backgroundColor: applied ? colors.greenTint : colors.green, borderRadius: 15, paddingVertical: 16, alignItems: 'center', marginTop: 2, shadowColor: colors.green, shadowOpacity: applied ? 0 : 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }}
      >
        <Text style={{ color: applied ? colors.green : '#fff', fontSize: 15.5, fontWeight: '800' }}>{applied ? '신청 접수됨 ✓ (데모)' : p.cta}</Text>
      </Pressable>
      {applied ? <Text style={{ fontSize: 12, color: colors.sub2, textAlign: 'center', fontWeight: '500', marginTop: -4 }}>실제 신청은 하나원큐 인증 후 진행돼요.</Text> : null}
    </View>
  );
}
