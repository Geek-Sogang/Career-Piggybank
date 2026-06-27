import { View, Text, Pressable } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { useApp, type Scenario } from '@/store';

export function Retirement() {
  const { vals, scenario, actions } = useApp();
  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={{ fontSize: 13, color: colors.sub, fontWeight: '700' }}>예상 은퇴 시점</Text>
        <Text style={{ fontSize: 32, fontWeight: '800', letterSpacing: -1, color: colors.green, marginTop: 4 }}>{vals.scLabel}</Text>
        <Text style={{ fontSize: 12.5, color: colors.sub2, fontWeight: '600', marginTop: 3 }}>{vals.scSub} · 신뢰구간 68%</Text>
      </View>

      {/* 차트 */}
      <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 16, paddingBottom: 14 }}>
        <View style={{ position: 'relative' }}>
          <Svg viewBox="0 0 320 200" width="100%" height={130}>
            <Path d="M10 170 C 110 150 205 86 310 50 L 310 104 C 205 134 110 168 10 176 Z" fill="rgba(0,132,133,.10)" />
            <Line x1="10" y1="74" x2="310" y2="74" stroke="#D7DBE0" strokeWidth={1.4} strokeDasharray="4 4" />
            <Path d="M10 173 C 110 158 205 92 310 62" fill="none" stroke={colors.green} strokeWidth={2.6} strokeLinecap="round" />
            <Circle cx="206" cy="74" r="4.5" fill={colors.green} stroke="#fff" strokeWidth={2} />
          </Svg>
          {/* 시나리오 신뢰구간 밴드 */}
          <View style={{ position: 'absolute', top: 4, bottom: 18, left: `${vals.scLeft * 100}%`, width: `${vals.scWidth * 100}%`, backgroundColor: 'rgba(0,132,133,.13)', borderLeftWidth: 1.5, borderRightWidth: 1.5, borderColor: colors.green, borderStyle: 'dashed', borderRadius: 2 }}>
            <Text style={{ position: 'absolute', top: -8, alignSelf: 'center', fontSize: 10, fontWeight: '800', color: colors.greenDark, backgroundColor: colors.greenTint, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6, overflow: 'hidden' }}>{vals.scLabel}</Text>
          </View>
          <Text style={{ position: 'absolute', left: 10, top: '44%', fontSize: 10, fontWeight: '700', color: colors.faint, backgroundColor: '#fff', paddingHorizontal: 4 }}>목표 자산</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          {['2025', '2035', '2045'].map((y) => <Text key={y} style={{ fontSize: 10.5, fontWeight: '600', color: colors.faint }}>{y}</Text>)}
        </View>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line2 }}>
          <Legend color={colors.green} text="자산 추세" />
          <Legend band text="신뢰구간" />
          <Legend dash text="목표" />
        </View>
      </View>

      {/* 시나리오 토글 */}
      <View style={{ flexDirection: 'row', gap: 6, backgroundColor: '#EDEFF2', borderRadius: 13, padding: 4 }}>
        {([['cons', '보수'], ['base', '기본'], ['opt', '낙관']] as [Scenario, string][]).map(([s, label]) => {
          const active = scenario === s;
          return (
            <Pressable key={s} onPress={() => actions.scen(s)} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: active ? '#fff' : 'transparent', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: active ? colors.green : colors.sub3 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ backgroundColor: '#FBFBFC', borderWidth: 1, borderColor: colors.dash, borderStyle: 'dashed', borderRadius: 14, padding: 14 }}>
        <Text style={{ fontSize: 12, color: colors.sub, lineHeight: 19, fontWeight: '500' }}>
          <Text style={{ fontWeight: '800', color: colors.ink2 }}>예측 기준</Text>{'\n'}
          월 적립 추세 + 커리어 성장률을 외삽해 자산 곡선을 그려요. 입금 데이터가 쌓일수록 신뢰구간이 좁아집니다.
        </Text>
      </View>

      <Pressable onPress={() => actions.pushScr('nestEgg')} style={{ backgroundColor: colors.green, borderRadius: 15, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, shadowColor: colors.green, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }}>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>노후 준비 시작하기</Text>
        <Icon name="arrowRight" size={18} color="#fff" sw={2.2} />
      </Pressable>
    </View>
  );
}

function Legend({ color, band, dash, text }: { color?: string; band?: boolean; dash?: boolean; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {band ? (
        <View style={{ width: 12, height: 10, borderRadius: 2, backgroundColor: 'rgba(0,132,133,.18)' }} />
      ) : dash ? (
        <View style={{ width: 14, borderTopWidth: 2, borderTopColor: '#C2C7CE', borderStyle: 'dashed' }} />
      ) : (
        <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: color }} />
      )}
      <Text style={{ fontSize: 11, color: colors.sub, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}
