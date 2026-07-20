import { Image, View, Text, Pressable, type ViewStyle, type TextStyle, type ImageStyle } from 'react-native';
import { colors } from '@/theme/colors';

/** 디자인 토글 스위치 (46x28). */
export function Toggle({ on, onPress }: { on: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: on ? colors.green : colors.line4 }}>
      <View style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 }} />
    </Pressable>
  );
}

const headImg = require('../../assets/mascot-head.png');
const fullImg = require('../../assets/mascot.png');

const FULL_RATIO = 734 / 1202; // 캐릭터 세로 크롭 비율

/** head=true: 정사각 얼굴, head=false: 세로 전신. size는 head=너비, full=높이 기준. */
export function Mascot({ head, size = 40, radius, style }: { head?: boolean; size?: number; radius?: number; style?: ImageStyle | ImageStyle[] }) {
  // full은 폭을 명시(네이티브 absolute 위치 보정: right 기준이 폭 없으면 어긋남)
  const base: ImageStyle = head
    ? { width: size, height: size, borderRadius: radius, backgroundColor: colors.pinkTint }
    : { width: Math.round(size * FULL_RATIO), height: size, borderRadius: radius };
  return <Image source={head ? headImg : fullImg} style={[base, style as ImageStyle]} resizeMode="contain" />;
}

/** 흰 카드 컨테이너 (디자인 기본 카드). */
export function Card({ children, style, p = 18 }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[]; p?: number }) {
  return (
    <View style={[{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: p, shadowColor: '#111827', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 }, style as ViewStyle]}>
      {children}
    </View>
  );
}

export const T = {
  // tabular-nums 금액
  num: { fontVariant: ['tabular-nums'] as TextStyle['fontVariant'], letterSpacing: -0.3 } as TextStyle,
};

/** 라벨+숫자 스탯 (검증카드·가계부 등). */
export function Stat({ value, unit, label, flex = 1, borderLeft }: { value: string; unit?: string; label: string; flex?: number; borderLeft?: boolean }) {
  return (
    <View style={{ flex, borderLeftWidth: borderLeft ? 1 : 0, borderLeftColor: colors.line, paddingLeft: borderLeft ? 14 : 0 }}>
      <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: colors.ink }}>
        {value}
        {unit ? <Text style={{ fontSize: 14, fontWeight: '600', color: colors.sub2 }}>{unit}</Text> : null}
      </Text>
      <Text style={{ fontSize: 11.5, color: colors.sub2, marginTop: 2, fontWeight: '500' }}>{label}</Text>
    </View>
  );
}
