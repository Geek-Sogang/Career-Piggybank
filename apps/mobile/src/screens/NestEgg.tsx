import { View, Text, Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/ui';
import { useApp } from '@/store';

export function NestEgg() {
  const { actions } = useApp();
  return (
    <View style={{ gap: 14 }}>
      {/* 진행 카드 */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 18, padding: 20 }}>
        <View style={{ width: 96, height: 96 }}>
          <Svg width={96} height={96} viewBox="0 0 96 96">
            <Circle cx={48} cy={48} r={40} fill="none" stroke="#EDEFF2" strokeWidth={11} />
            <Circle cx={48} cy={48} r={40} fill="none" stroke={colors.green} strokeWidth={11} strokeLinecap="round" strokeDasharray="45 251" transform="rotate(-90 48 48)" />
          </Svg>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 21, fontWeight: '800', color: colors.ink }}>18%</Text>
            <Text style={{ fontSize: 9.5, color: colors.sub2, fontWeight: '600' }}>목표</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: colors.sub2, fontWeight: '600' }}>유휴금으로 준비중</Text>
          <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginTop: 3, color: colors.ink }}>노후 자금 만들기</Text>
          <Text style={{ fontSize: 12, color: colors.spendable, fontWeight: '700', marginTop: 5 }}>여윳돈 봉투에서 월 ₩99,555</Text>
        </View>
      </Card>

      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sub, marginHorizontal: 4, marginBottom: -4 }}>추천 연금</Text>

      {/* IRP 추천 */}
      <Pressable onPress={() => actions.openProduct('irp')} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.green, borderRadius: 16, padding: 16, shadowColor: colors.green, shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>하나 IRP 개인형 퇴직연금</Text>
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff', backgroundColor: colors.green, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 8, overflow: 'hidden' }}>추천</Text>
        </View>
        <Text style={{ fontSize: 12.5, color: colors.sub, fontWeight: '500', marginTop: 6, lineHeight: 19 }}>연 납입액의 13.2~16.5% 세액공제 — 프리랜서에게 가장 효율적이에요.</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.greenInk, backgroundColor: colors.greenTint, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 9, overflow: 'hidden' }}>연 최대 148.5만 공제</Text>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.sub, backgroundColor: '#F1F2F4', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 9, overflow: 'hidden' }}>자동이체 연동</Text>
        </View>
      </Pressable>

      <Pressable onPress={() => actions.openProduct('pensionFund')}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16 }} p={16}>
          <View>
            <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>하나 연금저축펀드</Text>
            <Text style={{ fontSize: 12, color: colors.sub2, fontWeight: '500', marginTop: 3 }}>소수점 적립 · 보수적 포트폴리오</Text>
          </View>
          <Icon name="chevronRight" size={20} color="#C2C7CE" sw={2.2} />
        </Card>
      </Pressable>
    </View>
  );
}
