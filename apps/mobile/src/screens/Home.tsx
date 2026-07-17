import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { getForecast, type Forecast } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { CareerPiggybank } from '@/components/CareerPiggybank';
import { Card, Mascot, T } from '@/components/ui';
import { CAREER_SCORE_VALUES, useApp } from '@/store';

export function Home() {
  const { vals, actions } = useApp();
  // 일감 소득 밴드·미니 곡선 — 원장 시계열 라이브 계산 (서버 다운 시 정적 폴백)
  const [fc, setFc] = useState<Forecast | null>(null);
  const [forecastUnavailable, setForecastUnavailable] = useState(false);
  useEffect(() => {
    let live = true;
    getForecast()
      .then((next) => { if (live) setFc(next); })
      .catch(() => { if (live) setForecastUnavailable(true); });
    return () => { live = false; };
  }, []);
  const band = fc?.retirement.find((b) => b.scenario === 'base')?.label
    ?? (forecastUnavailable ? '2041 ~ 2044' : '계산 중…');
  const mini = fc ? buildMini(fc.path) : null;
  const nextTask = !vals.conn.hometax
    ? {
      title: `홈택스 연결하고 +${CAREER_SCORE_VALUES.hometax}점 받기`,
      sub: '확정 단계 · 미션 경험치 +30 XP',
      onPress: () => actions.pushScr('connect' as const),
    }
    : {
      title: '다음 입금 배분을 확인하고 XP 받기',
      sub: '첫 정산 승인 미션 · +25 XP',
      onPress: () => actions.nav('ledger' as const),
    };
  return (
    <View style={{ gap: 14 }}>
      {/* 커리어 검증 점수 — 한도와 분리된 평판 신호 */}
      <View style={{ borderRadius: 22, padding: 20, paddingBottom: 18, paddingRight: 96, backgroundColor: colors.green, overflow: 'hidden', shadowColor: colors.green, shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 14 } }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,.82)' }}>커리어 검증 점수</Text>
          <Text style={{ fontSize: 10.5, fontWeight: '600', color: '#fff', backgroundColor: 'rgba(255,255,255,.2)', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 7, overflow: 'hidden' }}>저금통 Lv.{vals.piggybank.level}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 9 }}>
          <Text style={{ fontSize: 44, fontWeight: '800', color: '#fff', letterSpacing: -1.2, ...T.num }}>{vals.score}</Text>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff', opacity: 0.9 }}>점</Text>
        </View>
        <Text style={{ fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,.82)', marginTop: 3 }}>검증 이력과 연결 자료로 만든 이식 가능한 평판</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 15 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff', backgroundColor: 'rgba(255,255,255,.18)', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 9, overflow: 'hidden' }}>검증 {vals.stage}</Text>
          <Text style={{ fontSize: 11, fontWeight: '600', backgroundColor: colors.pink, color: '#fff', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 9, overflow: 'hidden' }}>{vals.reviewLabel}</Text>
        </View>
        <Mascot size={132} style={{ position: 'absolute', right: 2, bottom: -8 }} />
      </View>

      <Pressable onPress={() => actions.nav('piggy')}>
        <CareerPiggybank piggybank={vals.piggybank} compact />
      </Pressable>

      {/* 3단계 진입 */}
      <Card p={6} style={{ flexDirection: 'row' }}>
        <Quick icon="download" tint={colors.greenTint} color={colors.green} title="일감 증명" sub="커리어 연결" onPress={() => actions.pushScr('connect')} />
        <Divider />
        <Quick icon="trending" tint={colors.bufferTint} color={colors.buffer} title="정산 관리" sub="세금·경비" onPress={() => actions.nav('ledger')} />
        <Divider />
        <Quick icon="cardPig" tint={colors.pinkTint} color={colors.pinkStrong} title="금융 연결" sub="검증 기반 상품" onPress={() => actions.nav('piggy')} />
      </Card>

      {/* 다음 할 일 */}
      <Pressable onPress={nextTask.onPress}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }} p={16}>
          <Mascot head size={44} radius={13} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.green, letterSpacing: 0.2 }}>다음 할 일</Text>
            <Text style={{ fontSize: 14.5, fontWeight: '700', marginTop: 3, color: colors.ink }}>{nextTask.title}</Text>
            <Text style={{ fontSize: 12, color: colors.sub2, marginTop: 2, fontWeight: '400' }}>{nextTask.sub}</Text>
          </View>
          <Icon name="chevronRight" size={20} color="#C2C7CE" sw={2.2} />
        </Card>
      </Pressable>

      {/* 미래 소득 미리보기 — 실제 은퇴자금 달성 시점과 구분 */}
      <Pressable onPress={() => actions.pushScr('retirement')}>
        <Card style={{ gap: 10 }} p={16}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sub }}>미래 소득 미리보기</Text>
            <Icon name="chevronRight" size={18} color="#C2C7CE" sw={2.2} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.sub2 }}>생활비 하회 가능 구간</Text>
            <Text style={{ fontSize: 21, fontWeight: '800', letterSpacing: -0.4, color: colors.ink }}>{band}</Text>
          </View>
          <Svg viewBox="0 0 300 60" width="100%" height={56} preserveAspectRatio="none">
            {mini ? (
              <>
                <Path d={mini.band} fill="rgba(0,132,133,.10)" />
                <Path d={mini.curve} fill="none" stroke={colors.green} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                <Line x1="2" y1={mini.targetY} x2="298" y2={mini.targetY} stroke="#D7DBE0" strokeWidth={1.2} strokeDasharray="3 3" />
                {mini.crossX != null && <Circle cx={mini.crossX} cy={mini.targetY} r={4} fill={colors.green} stroke="#fff" strokeWidth={2} />}
              </>
            ) : forecastUnavailable ? (
              <>
                <Path d="M2 52 C 70 46 150 30 298 12 L 298 30 C 150 44 70 52 2 56 Z" fill="rgba(0,132,133,.10)" />
                <Path d="M2 54 C 70 48 150 28 298 18" fill="none" stroke={colors.green} strokeWidth={2.4} strokeLinecap="round" />
                <Line x1="2" y1="26" x2="298" y2="26" stroke="#D7DBE0" strokeWidth={1.2} strokeDasharray="3 3" />
                <Circle cx="196" cy="26" r="4" fill={colors.green} stroke="#fff" strokeWidth={2} />
              </>
            ) : (
              <Line x1="2" y1="30" x2="298" y2="30" stroke="#E3E6EA" strokeWidth={8} strokeLinecap="round" />
            )}
          </Svg>
          <Text style={{ fontSize: 12, color: colors.sub2, fontWeight: '500' }}>
            {fc || forecastUnavailable ? '입금 추세 + 커리어 성장률로 계산한 소득 유지 전망' : '내 입금 시계열을 불러오는 중이에요'}
          </Text>
        </Card>
      </Pressable>
    </View>
  );
}

// 미니 곡선 — Retirement 차트와 같은 경로 데이터, 작은 좌표계(300×60)로만 다시 매핑
function buildMini(p: Forecast['path']) {
  const years = p.years;
  const span = Math.max(1, years[years.length - 1] - years[0]);
  const x = (yr: number) => 2 + ((yr - years[0]) / span) * 296;
  const maxV = Math.max(...p.hi);
  const y = (v: number) => 54 - (v / maxV) * 46;
  const pt = (yr: number, i: number, arr: number[]) => `${x(yr).toFixed(1)} ${y(arr[i]).toFixed(1)}`;

  const curve = 'M ' + years.map((yr, i) => pt(yr, i, p.base)).join(' L ');
  const loRev = years.map((yr, i) => pt(yr, i, p.lo)).reverse();
  const band = 'M ' + years.map((yr, i) => pt(yr, i, p.hi)).join(' L ') + ' L ' + loRev.join(' L ') + ' Z';
  const targetY = y(p.living_target);

  const peakIdx = Math.max(0, years.indexOf(p.peak_year));
  let crossX: number | null = null;
  for (let i = peakIdx + 1; i < years.length; i++) {
    if (p.base[i] < p.living_target && p.base[i - 1] >= p.living_target) {
      const f = (p.base[i - 1] - p.living_target) / (p.base[i - 1] - p.base[i]);
      crossX = x(years[i - 1] + f * (years[i] - years[i - 1]));
      break;
    }
  }
  return { curve, band, targetY, crossX };
}

function Quick({ icon, tint, color, title, sub, onPress }: { icon: 'download' | 'trending' | 'cardPig'; tint: string; color: string; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 4 }}>
      <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} color={color} />
      </View>
      <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.ink }}>{title}</Text>
      <Text style={{ fontSize: 10.5, color: colors.sub2, fontWeight: '400' }}>{sub}</Text>
    </Pressable>
  );
}
const Divider = () => <View style={{ width: 1, backgroundColor: colors.line, marginVertical: 14 }} />;
