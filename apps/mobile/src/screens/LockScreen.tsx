import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { Mascot } from '@/components/ui';
import { useApp } from '@/store';

const NOTIS = [
  { time: '지금', title: '특이 입금 감지 · ₩500,000', body: '새 일감 매출 같아요. 세금봉투에 18,150원 담을까요?', op: 0.92 },
  { time: '10분 전', title: '검증 1건 확정 ✓', body: '○○커머스 일감이 3자 교차검증됐어요.', op: 0.82 },
];

export function LockScreen() {
  const { lastAlloc, actions } = useApp();
  const won = (v: number) => `₩${v.toLocaleString('en-US')}`;
  // 최근 입금 배분 이벤트가 있으면 첫 알림을 그 사건으로 (시트·챗과 같은 사건을 이어 말함)
  const notis = lastAlloc
    ? [
        {
          time: '지금',
          title: `정산 입금 ${won(lastAlloc.deposit)} 도착`,
          body: `평소의 ${lastAlloc.windfall.toFixed(1)}배 큰 입금! 세금 ${won(lastAlloc.split.tax)} · 여윳돈 ${won(lastAlloc.split.buffer)}로 ${lastAlloc.confirmed ? '나눠 담았어요 ✓' : '나누는 걸 제안했어요 — 확인해 주세요'}`,
          op: 0.92,
        },
        NOTIS[1],
      ]
    : NOTIS;
  return (
    <Pressable onPress={actions.back} style={{ flex: 1, backgroundColor: '#0C2E2F' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ alignItems: 'center', marginTop: 30 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,.7)' }}>6월 27일 금요일</Text>
          <Text style={{ fontSize: 78, fontWeight: '700', color: '#fff', letterSpacing: -3 }}>9:41</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'flex-end', gap: 10, paddingHorizontal: 14, paddingBottom: 36 }}>
          {notis.map((n, i) => (
            <Pressable key={i} onPress={() => actions.pushScr('chat')} style={{ backgroundColor: `rgba(255,255,255,${n.op})`, borderRadius: 20, padding: 14, flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 11, overflow: 'hidden', backgroundColor: colors.green }}>
                <Mascot head size={40} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.ink2 }}>커리어 저금통</Text>
                  <Text style={{ fontSize: 11, color: colors.sub2, fontWeight: '500' }}>{n.time}</Text>
                </View>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.ink, marginTop: 3 }}>{n.title}</Text>
                <Text style={{ fontSize: 12.5, color: '#5A6069', marginTop: 2, lineHeight: 17 }}>{n.body}</Text>
              </View>
            </Pressable>
          ))}
          <Text style={{ textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,.5)', fontWeight: '500', marginTop: 6 }}>탭하면 닫혀요</Text>
        </View>
      </SafeAreaView>
    </Pressable>
  );
}
