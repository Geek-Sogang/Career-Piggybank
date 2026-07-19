import { Text, View } from 'react-native';
import { type getEnvelopeBalances } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card, T } from '@/components/ui';

type EnvelopeState = Awaited<ReturnType<typeof getEnvelopeBalances>>;

const ENVELOPES = [
  { key: 'tax', label: '세금', color: colors.tax },
  { key: 'expense', label: '경비', color: colors.expense },
  { key: 'spendable', label: '즉시가용', color: colors.spendable },
  { key: 'buffer', label: '여윳돈', color: colors.buffer },
] as const;

// 홈의 기존 `내 봉투` 디자인이 정본이다. 홈과 가계부가 이 컴포넌트를 함께 사용한다.
export function AutoEnvelopeSummary({ data }: { data: EnvelopeState | null }) {
  const balances = data?.balances ?? null;
  const total = balances ? Object.values(balances).reduce((sum, value) => sum + Math.max(0, value), 0) : 0;

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sub }}>내 봉투</Text>
        <Icon name="chevronRight" size={18} color={colors.chev} sw={2.2} />
      </View>
      <Text style={{ fontSize: 12, color: colors.sub2, fontWeight: '600', marginTop: 10 }}>지금 쓸 수 있는 돈</Text>
      <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: -0.8, color: colors.ink, marginTop: 2, ...T.num }}>
        ₩{Math.round(balances?.spendable ?? 0).toLocaleString('en-US')}
      </Text>
      {total > 0 && (
        <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2, marginTop: 12 }}>
          {ENVELOPES.map((item) => {
            const width = Math.max(0, balances?.[item.key] ?? 0) / total;
            return width > 0.005 ? <View key={item.key} style={{ flex: width, backgroundColor: item.color }} /> : null;
          })}
        </View>
      )}
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        {ENVELOPES.filter((item) => item.key !== 'spendable').map((item, index) => (
          <View key={item.key} style={{ flex: 1, borderLeftWidth: index ? 1 : 0, borderLeftColor: colors.line, paddingLeft: index ? 14 : 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: item.color }} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.sub2 }}>{item.label}</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink, marginTop: 3, ...T.num }}>
              ₩{Math.round(balances?.[item.key] ?? 0).toLocaleString('en-US')}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
