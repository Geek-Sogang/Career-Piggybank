import { View, Text } from 'react-native';
import { colors } from '@/theme/colors';
import { Card } from '@/components/ui';

type P = { badge: string; bg: string; color: string; name: string; desc: string; tag: string; on?: boolean };
const LINKED: P[] = [
  { badge: '통', bg: colors.greenTint, color: colors.green, name: '달달 하나 통장 + 체크카드', desc: '정산입금 급여성 태깅 · ATM 수수료 면제', tag: '연결됨', on: true },
  { badge: '비', bg: colors.bufferTint, color: colors.buffer, name: '하나원큐 비상금대출', desc: 'SGI 보증 · 마이너스통장 한도 300만', tag: '한도 조회', on: true },
];
const SUGGEST: P[] = [
  { badge: '햇', bg: colors.pinkTint, color: colors.pinkStrong, name: '하나원큐 햇살론유스', desc: "3.3% 신고로 '저소득 청년사업자' 요건 충족", tag: '맞춤 추천' },
  { badge: 'I', bg: colors.indigoTint, color: colors.indigo, name: '하나은행 ISA', desc: '여윳돈 버퍼 초과분 투자 라우팅 · 비과세', tag: '연결 가능' },
  { badge: '연', bg: colors.orangeTint, color: colors.orange, name: '하나 개인형 IRP', desc: '노후봉투 도착지 · 자유 적립', tag: '연결 가능' },
];

export function Products() {
  return (
    <View style={{ gap: 14 }}>
      <View style={{ backgroundColor: colors.greenTint, borderWidth: 1, borderColor: colors.greenLine, borderRadius: 16, padding: 15 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: colors.greenInk }}>검증된 커리어로 열린 상품</Text>
        <Text style={{ fontSize: 12, color: '#5E7B7A', marginTop: 3, fontWeight: '500', lineHeight: 17 }}>검증 한도 ₩2,400,000 기준으로 맞춤 상품이 열렸어요.</Text>
      </View>

      <Text style={[label]}>연결된 상품</Text>
      {LINKED.map((p) => <Item key={p.name} {...p} />)}

      <Text style={[label]}>연결 가능</Text>
      {SUGGEST.map((p) => <Item key={p.name} {...p} />)}
    </View>
  );
}

function Item({ badge, bg, color, name, desc, tag, on }: P) {
  return (
    <Card p={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16 }}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color }}>{badge}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{name}</Text>
        <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '500', marginTop: 2 }}>{desc}</Text>
      </View>
      <Text style={{ fontSize: 11, fontWeight: '700', color: on ? colors.green : colors.sub3, backgroundColor: on ? colors.greenTint : colors.line, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 8, overflow: 'hidden' }}>{tag}</Text>
    </Card>
  );
}

const label = { fontSize: 13, fontWeight: '700' as const, color: colors.sub, marginHorizontal: 4, marginTop: 2, marginBottom: -2 };
