import { Image, View, Text, type ViewStyle, type TextStyle, type ImageStyle } from 'react-native';
import { colors } from '@/theme/colors';

const headImg = require('../../assets/mascot-head.png');
const fullImg = require('../../assets/mascot.png');

export function Mascot({ head, size = 40, radius, style }: { head?: boolean; size?: number; radius?: number; style?: ImageStyle | ImageStyle[] }) {
  return (
    <Image
      source={head ? headImg : fullImg}
      style={[{ width: size, height: head ? size : undefined, aspectRatio: 1, borderRadius: radius, backgroundColor: head ? colors.pinkTint : undefined }, style as ImageStyle]}
      resizeMode="contain"
    />
  );
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
