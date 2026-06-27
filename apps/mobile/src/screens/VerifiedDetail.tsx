import { View, Text } from 'react-native';
import { colors } from '@/theme/colors';
import { Icon, type IconName } from '@/components/Icon';
import { Card, T } from '@/components/ui';

const NODES: { bg: string; icon: IconName; title: string; match: string; desc: string }[] = [
  { bg: colors.black, icon: 'github', title: 'GitHub 활동', match: '기간 일치', desc: 'React 커밋 142건 · PR 8건 (2025.04~05)' },
  { bg: colors.buffer, icon: 'docRow', title: '발주처 입금', match: '금액·거래처 일치', desc: '○○커머스 → ₩500,000 입금 (05.31)' },
  { bg: colors.green, icon: 'houseSmall', title: '홈택스 신고', match: '소득구분 일치', desc: '사업소득 3.3% 원천징수 ₩16,500 신고확인' },
];

export function VerifiedDetail() {
  return (
    <View style={{ gap: 14 }}>
      {/* 헤더 카드 */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: colors.indigoTint, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.indigo }}>커</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>○○커머스</Text>
            <Text style={{ fontSize: 12.5, color: colors.sub2, fontWeight: '500', marginTop: 2 }}>웹 프론트엔드 개발</Text>
          </View>
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.green, backgroundColor: colors.greenTint, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 10, overflow: 'hidden' }}>검증 확정 ✓</Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '600' }}>정산 금액</Text>
            <Text style={{ fontSize: 21, fontWeight: '800', letterSpacing: -0.4, marginTop: 3, color: colors.ink, ...T.num }}>₩500,000</Text>
          </View>
          <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: colors.line, paddingLeft: 16 }}>
            <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '600' }}>정산일</Text>
            <Text style={{ fontSize: 21, fontWeight: '800', letterSpacing: -0.4, marginTop: 3, color: colors.ink }}>2025.05.31</Text>
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginHorizontal: 4, marginTop: 2, marginBottom: -2 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink }}>3자 교차검증</Text>
        <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '600' }}>세 곳의 데이터가 일치</Text>
      </View>

      {/* 타임라인 */}
      <Card style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16 }}>
        <View style={{ paddingLeft: 34, position: 'relative' }}>
          <View style={{ position: 'absolute', left: 13, top: 24, bottom: 30, width: 2, backgroundColor: '#D2E8E8' }} />
          {NODES.map((n, i) => (
            <View key={i} style={{ paddingTop: 16, paddingBottom: 4, position: 'relative' }}>
              <View style={{ position: 'absolute', left: -34, top: 16, width: 28, height: 28, borderRadius: 14, backgroundColor: n.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={n.icon} size={16} color="#fff" sw={2} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.ink }}>{n.title}</Text>
                <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.green, backgroundColor: colors.greenTint, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 7, overflow: 'hidden' }}>{n.match}</Text>
              </View>
              <Text style={{ fontSize: 12.5, color: colors.sub, marginTop: 4, fontWeight: '500' }}>{n.desc}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, padding: 14, backgroundColor: colors.greenTint, borderRadius: 14 }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={18} color="#fff" sw={2.4} />
          </View>
          <Text style={{ fontSize: 13, fontWeight: '800', color: colors.greenInk }}>검증 완료 · 1건 확정</Text>
        </View>
      </Card>

      <View style={{ backgroundColor: '#FBFBFC', borderWidth: 1, borderColor: colors.dash, borderStyle: 'dashed', borderRadius: 14, padding: 14 }}>
        <Text style={{ fontSize: 12, color: colors.sub, lineHeight: 19, fontWeight: '500' }}>
          <Text style={{ fontWeight: '800', color: colors.ink2 }}>검증 가능한 산수</Text>{'\n'}
          입금 ₩500,000 = 신고소득 ₩500,000, 원천징수 ₩16,500(3.3%). 세 출처의 금액·시점이 맞아떨어져 자동 검증됐어요.
        </Text>
      </View>
    </View>
  );
}
