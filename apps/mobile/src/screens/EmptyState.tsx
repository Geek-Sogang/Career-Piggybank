import { View, Text, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { Mascot } from '@/components/ui';
import { useApp } from '@/store';

/** 저금통 빈 상태(신규 유저) — 설정 미리보기 + 연결 0일 때 재사용. */
export function EmptyState() {
  const { actions } = useApp();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingTop: 80 }}>
      <Mascot size={190} />
      <Text style={{ fontSize: 18, fontWeight: '800', letterSpacing: -0.4, marginTop: 14, color: colors.ink, textAlign: 'center' }}>아직 연결된 커리어가 없어요</Text>
      <Text style={{ fontSize: 13.5, color: colors.sub2, fontWeight: '500', lineHeight: 22, marginTop: 8, textAlign: 'center' }}>GitHub·홈택스를 연결하면{'\n'}검증이 시작되고 한도가 만들어져요.</Text>
      <Pressable onPress={() => actions.pushScr('connect')} style={{ backgroundColor: colors.green, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 40, marginTop: 22, shadowColor: colors.green, shadowOpacity: 0.5, shadowRadius: 22, shadowOffset: { width: 0, height: 12 } }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>커리어 연결하기</Text>
      </Pressable>
    </View>
  );
}
