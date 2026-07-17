import { View, Text } from 'react-native';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card, T } from '@/components/ui';
import { useApp } from '@/store';
import { JOBS } from '@/jobs';

export function VerifiedDetail() {
  const { detail } = useApp();
  const job = JOBS[detail];
  const v = job.verified;
  const matched = job.nodes.filter((n) => n.ok).length;

  return (
    <View style={{ gap: 14 }}>
      {/* 헤더 카드 */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: job.badgeBg, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: job.badgeColor }}>{job.badge}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>{job.name}</Text>
            <Text style={{ fontSize: 12.5, color: colors.sub2, fontWeight: '500', marginTop: 2 }}>{job.role}</Text>
          </View>
          <Text style={{ fontSize: 12, fontWeight: '800', color: v ? colors.green : colors.sub2, backgroundColor: v ? colors.greenTint : colors.line, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 10, overflow: 'hidden' }}>{v ? '검증 확정 ✓' : '자기보고'}</Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '600' }}>정산 금액</Text>
            <Text style={{ fontSize: 21, fontWeight: '800', letterSpacing: -0.4, marginTop: 3, color: v ? colors.ink : colors.sub3, ...T.num }}>{job.amount}</Text>
          </View>
          <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: colors.line, paddingLeft: 16 }}>
            <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '600' }}>{v ? '정산일' : '기간'}</Text>
            <Text style={{ fontSize: 21, fontWeight: '800', letterSpacing: -0.4, marginTop: 3, color: colors.ink }}>{job.date}</Text>
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginHorizontal: 4, marginTop: 2, marginBottom: -2 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink }}>{v ? `${job.nodes.length}자 교차검증` : '데이터 출처'}</Text>
        <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '600' }}>{v ? `${matched}곳의 데이터가 일치` : '검증에 필요한 출처'}</Text>
      </View>

      {/* 타임라인 */}
      <Card style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16 }}>
        <View style={{ paddingLeft: 34, position: 'relative' }}>
          <View style={{ position: 'absolute', left: 13, top: 24, bottom: 30, width: 2, backgroundColor: v ? '#D2E8E8' : colors.line }} />
          {job.nodes.map((n, i) => (
            <View key={i} style={{ paddingTop: 16, paddingBottom: 4, position: 'relative' }}>
              <View style={{ position: 'absolute', left: -34, top: 16, width: 28, height: 28, borderRadius: 14, backgroundColor: n.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={n.icon} size={16} color="#fff" sw={2} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: n.ok ? colors.ink : colors.sub3 }}>{n.title}</Text>
                <Text style={{ fontSize: 10.5, fontWeight: '700', color: n.ok ? colors.green : colors.sub3, backgroundColor: n.ok ? colors.greenTint : colors.line, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 7, overflow: 'hidden' }}>{n.match}</Text>
              </View>
              <Text style={{ fontSize: 12.5, color: colors.sub, marginTop: 4, fontWeight: '500' }}>{n.desc}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, padding: 14, backgroundColor: v ? colors.greenTint : '#FFF6EC', borderRadius: 14 }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: v ? colors.green : colors.expense, alignItems: 'center', justifyContent: 'center' }}>
            {v ? <Icon name="check" size={18} color="#fff" sw={2.4} /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>!</Text>}
          </View>
          <Text style={{ fontSize: 13, fontWeight: '800', color: v ? colors.greenInk : '#A56A19' }}>{job.resultText}</Text>
        </View>
      </Card>

      <View style={{ backgroundColor: '#FBFBFC', borderWidth: 1, borderColor: colors.dash, borderStyle: 'dashed', borderRadius: 14, padding: 14 }}>
        <Text style={{ fontSize: 12, color: colors.sub, lineHeight: 19, fontWeight: '500' }}>
          <Text style={{ fontWeight: '800', color: colors.ink2 }}>{v ? '검증 가능한 산수' : '자기보고란?'}</Text>{'\n'}
          {job.mathNote}
        </Text>
      </View>
    </View>
  );
}
