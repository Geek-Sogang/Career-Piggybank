import { useState } from 'react';
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
            <Circle cx={48} cy={48} r={40} fill="none" stroke={colors.line3} strokeWidth={11} />
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

      <PensionAICard />

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
          {/* 정액 자동이체는 보릿고개 달에 깨진다 — 긱 리듬 페이싱이 우리 문법 */}
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.sub, backgroundColor: colors.line2, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 9, overflow: 'hidden' }}>소득 리듬 맞춤 납입</Text>
        </View>
      </Pressable>

      <Pressable onPress={() => actions.openProduct('pensionFund')}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16 }} p={16}>
          <View>
            <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>하나 연금저축펀드</Text>
            <Text style={{ fontSize: 12, color: colors.sub2, fontWeight: '500', marginTop: 3 }}>소수점 적립 · 보수적 포트폴리오</Text>
          </View>
          <Icon name="chevronRight" size={20} color={colors.chev} sw={2.2} />
        </Card>
      </Pressable>
    </View>
  );
}

function PensionAICard() {
  const [linked, setLinked] = useState(false);
  return (
    <View style={{ backgroundColor: colors.greenTint2, borderWidth: 1, borderColor: colors.greenLine, borderRadius: 16, padding: 16, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="trending" size={17} color="#fff" sw={2.2} />
          </View>
          <Text style={{ fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>하나 AI 연금 솔루션</Text>
        </View>
        <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.green, backgroundColor: '#fff', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden' }}>하나원큐 연동</Text>
      </View>
      <Text style={{ fontSize: 12.5, color: colors.sub, fontWeight: '500', lineHeight: 19 }}>연금 소득·투자 성향을 분석해 몇 살에 얼마가 모일지 예측하고, 맞춤 노후 포트폴리오를 제안해요.</Text>
      <Pressable onPress={() => setLinked(true)} style={{ backgroundColor: linked ? '#fff' : colors.green, borderWidth: linked ? 1 : 0, borderColor: colors.green, borderRadius: 11, paddingVertical: 12, alignItems: 'center' }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: linked ? colors.green : '#fff' }}>{linked ? '연동 완료 ✓ · 맞춤 분석 중' : '하나원큐 연금 솔루션 연동하기'}</Text>
      </Pressable>
    </View>
  );
}
