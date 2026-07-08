import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { getForecast, type Forecast } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { useApp, type Scenario } from '@/store';

export function Retirement() {
  const { vals, scenario, actions } = useApp();
  // 원장 시계열 라이브 예측 — 서버 다운 시 정적 시나리오 폴백 (데모 불사)
  const [fc, setFc] = useState<Forecast | null>(null);
  useEffect(() => {
    getForecast().then(setFc).catch(() => {});
  }, []);
  const liveBand = fc?.retirement.find((b) => b.scenario === scenario)?.label;
  const chart = fc ? buildChart(fc.path, fc.retirement, scenario) : null;
  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={{ fontSize: 13, color: colors.sub, fontWeight: '700' }}>예상 은퇴 시점 — 일감 흐름 기준</Text>
        <Text style={{ fontSize: 32, fontWeight: '800', letterSpacing: -1, color: colors.green, marginTop: 4 }}>{liveBand ?? vals.scLabel}</Text>
        <Text style={{ fontSize: 12.5, color: colors.sub2, fontWeight: '600', marginTop: 3 }}>
          {fc
            ? `미래 ${fc.mc.runs.toLocaleString('en-US')}개 시뮬레이션 — 90%가 ${fc.mc.band_end_year}년 이전 은퇴선 도달 · 내 입금 시계열 기반`
            : `${vals.scSub} · 신뢰구간 밴드`}
        </Text>
      </View>

      {/* 다음 수입 예측 — 스트림 분해 합성(플랫폼 주기·재수주 리듬·진행 중 계약), 없으면 간격 통계 폴백 */}
      {fc && (
        <View style={{ backgroundColor: colors.greenTint2, borderWidth: 1, borderColor: colors.greenLine, borderRadius: 14, padding: 13, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="trending" size={18} color={colors.green} sw={2.2} />
            <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '600', color: colors.ink, lineHeight: 18 }}>
              다음 수입 예상: <Text style={{ fontWeight: '800' }}>{(fc.streams.composite_next?.expected_date ?? fc.income_gap.expected_next_date).slice(5).replace('-', '/')}</Text>
              {'  '}
              <Text style={{ color: colors.sub2, fontWeight: '500' }}>
                {fc.streams.composite_next
                  ? fc.streams.composite_next.basis
                  : `입금 간격 중앙값 ${Math.round(fc.income_gap.median_gap_days)}일 기준`}
              </Text>
            </Text>
          </View>
          {/* 진행 중 계약 — 착수금은 왔고 잔금은 아직 (원장이 아는 미래) */}
          {fc.streams.pending_settlements.map((p) => (
            <View key={p.counterparty + p.advance_date} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 11 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.green, backgroundColor: colors.greenTint, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 6, overflow: 'hidden' }}>진행 중 계약</Text>
              <Text style={{ flex: 1, fontSize: 11.5, fontWeight: '600', color: colors.ink }}>
                {p.counterparty} 잔금 예상 {p.expected_date.slice(5).replace('-', '/')} <Text style={{ color: colors.sub2, fontWeight: '500' }}>(착수금 {p.advance_date.slice(5).replace('-', '/')} 관측)</Text>
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* 차트 — API 경로(연도별 일감 흐름) 좌표 렌더. 서버 다운 시 정적 곡선 폴백 */}
      <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 16, paddingBottom: 14 }}>
        <View style={{ position: 'relative' }}>
          {/* preserveAspectRatio=none: viewBox x좌표 = 컨테이너 % — 밴드 오버레이와 같은 좌표계 */}
          <Svg viewBox="0 0 320 200" width="100%" height={130} preserveAspectRatio="none">
            {chart ? (
              <>
                <Path d={chart.band} fill="rgba(0,132,133,.10)" />
                <Line x1={X0} y1={chart.targetY} x2={X1} y2={chart.targetY} stroke="#D7DBE0" strokeWidth={1.4} strokeDasharray="4 4" />
                <Path d={chart.curve} fill="none" stroke={colors.green} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                {chart.crossX != null && <Circle cx={chart.crossX} cy={chart.targetY} r={4.5} fill={colors.green} stroke="#fff" strokeWidth={2} />}
              </>
            ) : (
              <>
                <Path d="M10 170 C 110 150 205 86 310 50 L 310 104 C 205 134 110 168 10 176 Z" fill="rgba(0,132,133,.10)" />
                <Line x1="10" y1="74" x2="310" y2="74" stroke="#D7DBE0" strokeWidth={1.4} strokeDasharray="4 4" />
                <Path d="M10 173 C 110 158 205 92 310 62" fill="none" stroke={colors.green} strokeWidth={2.6} strokeLinecap="round" />
                <Circle cx="206" cy="74" r="4.5" fill={colors.green} stroke="#fff" strokeWidth={2} />
              </>
            )}
          </Svg>
          {/* 시나리오 신뢰구간 밴드 — 라이브면 밴드 연도 → x좌표 */}
          <View style={{ position: 'absolute', top: 4, bottom: 18, left: `${(chart ? chart.bandLeft : vals.scLeft) * 100}%`, width: `${(chart ? chart.bandWidth : vals.scWidth) * 100}%`, backgroundColor: 'rgba(0,132,133,.13)', borderLeftWidth: 1.5, borderRightWidth: 1.5, borderColor: colors.green, borderStyle: 'dashed', borderRadius: 2 }}>
            <Text style={{ position: 'absolute', top: -8, alignSelf: 'center', fontSize: 10, fontWeight: '800', color: colors.greenDark, backgroundColor: colors.greenTint, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6, overflow: 'hidden' }}>{liveBand ?? vals.scLabel}</Text>
          </View>
          <Text style={{ position: 'absolute', left: 10, top: chart ? `${(chart.targetY / 200) * 100 - 6}%` : '44%', fontSize: 10, fontWeight: '700', color: colors.faint, backgroundColor: '#fff', paddingHorizontal: 4 }}>{chart ? '생활비 목표' : '목표 자산'}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          {(chart ? chart.xLabels : ['2025', '2035', '2045']).map((y) => <Text key={y} style={{ fontSize: 10.5, fontWeight: '600', color: colors.faint }}>{y}</Text>)}
        </View>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line2 }}>
          <Legend color={colors.green} text={chart ? '일감 흐름(월 소득)' : '자산 추세'} />
          <Legend band text="신뢰구간" />
          <Legend dash text={chart ? '생활비 목표' : '목표'} />
        </View>
      </View>

      {/* 자금 달성형(B) — "충분히 모아서 그만둘 수 있는 해". 위 차트(A: 일감 흐름 소멸)와
          병행: A는 저축을 안 보고, B는 저축이 예측을 움직인다 — 서로 다른 질문에 답한다 */}
      {fc?.funded && <FundedCard funded={fc.funded} />}

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
          <Text style={{ fontWeight: '800', color: colors.ink2 }}>예측 기준 — 긱워커 전용 커리어 신호</Text>{'\n'}
          {fc
            ? fc.career_signals.reasons.map((r) => `· ${r}`).join('\n')
            : '수주 간격·발주처 다양성·단가 추세(우리 원장만 가진 신호)가 연령 곡선보다 우선 반영돼요. 입금 데이터가 쌓일수록 신뢰구간이 좁아집니다.'}
        </Text>
      </View>

      <Pressable onPress={() => actions.pushScr('nestEgg')} style={{ backgroundColor: colors.green, borderRadius: 15, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, shadowColor: colors.green, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }}>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>노후 준비 시작하기</Text>
        <Icon name="arrowRight" size={18} color="#fff" sw={2.2} />
      </Pressable>
    </View>
  );
}

// 그리기 영역 (viewBox 320×200 안) — 연도→x, 원화→y 매핑의 기준
const X0 = 10, X1 = 310, Y0 = 24, Y1 = 176;

function buildChart(p: Forecast['path'], retirement: Forecast['retirement'], scenario: Scenario) {
  const years = p.years;
  const span = Math.max(1, years[years.length - 1] - years[0]);
  const x = (yr: number) => X0 + ((yr - years[0]) / span) * (X1 - X0);
  const maxV = Math.max(...p.hi);
  const y = (v: number) => Y1 - (v / maxV) * (Y1 - Y0);
  const pt = (yr: number, v: number) => `${x(yr).toFixed(1)} ${y(v).toFixed(1)}`;

  const curve = 'M ' + years.map((yr, i) => pt(yr, p.base[i])).join(' L ');
  const loRev = years.map((yr, i) => pt(yr, p.lo[i])).reverse();
  const band = 'M ' + years.map((yr, i) => pt(yr, p.hi[i])).join(' L ') + ' L ' + loRev.join(' L ') + ' Z';
  const targetY = y(p.living_target);

  // 정점 이후 곡선이 생활비 목표 아래로 내려가는 지점 (선형 보간) — 은퇴 정의 그 자체
  const peakIdx = Math.max(0, years.indexOf(p.peak_year));
  let crossX: number | null = null;
  for (let i = peakIdx + 1; i < years.length; i++) {
    if (p.base[i] < p.living_target && p.base[i - 1] >= p.living_target) {
      const f = (p.base[i - 1] - p.living_target) / (p.base[i - 1] - p.base[i]);
      crossX = x(years[i - 1] + f * (years[i] - years[i - 1]));
      break;
    }
  }

  const b = retirement.find((r) => r.scenario === scenario);
  const bandLeft = b ? x(b.band_start_year) / 320 : 0.62;
  const bandWidth = b ? Math.max(0.05, (x(b.band_end_year) - x(b.band_start_year)) / 320) : 0.14;
  const mid = years[Math.floor((years.length - 1) / 2)];
  return { curve, band, targetY, crossX, bandLeft, bandWidth, xLabels: [String(years[0]), String(mid), String(years[years.length - 1])] };
}

// 자금 달성형(B) 카드 — 은퇴 넘버 도달 해 + 누적 저축 미니 곡선 (좌표 = API savings_path)
function FundedCard({ funded }: { funded: NonNullable<Forecast['funded']> }) {
  const eok = (v: number) => (v >= 100_000_000 ? `${(v / 100_000_000).toFixed(1)}억` : `${Math.round(v / 10_000).toLocaleString('ko-KR')}만`);
  // 미니 곡선: 도달 해 + 5년(또는 지평선 끝)까지 — 목표선을 넘는 순간이 보이게
  const endIdx = funded.reached
    ? Math.min(funded.years.length - 1, funded.years.indexOf(funded.funded_year) + 5)
    : funded.years.length - 1;
  const years = funded.years.slice(0, endIdx + 1);
  const path = funded.savings_path.slice(0, endIdx + 1);
  const maxV = Math.max(funded.target * 1.15, ...path, 1);
  const px = (i: number) => X0 + (i / Math.max(1, years.length - 1)) * (X1 - X0);
  const py = (v: number) => Y1 - (v / maxV) * (Y1 - Y0);
  const curve = 'M ' + path.map((v, i) => `${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' L ');
  const targetY = py(funded.target);
  const crossIdx = funded.reached ? funded.years.indexOf(funded.funded_year) : -1;
  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 16 }}>
      <Text style={{ fontSize: 13, color: colors.sub, fontWeight: '700' }}>충분히 모아서 은퇴한다면 — 자금 달성 기준</Text>
      {funded.reached ? (
        <>
          <Text style={{ fontSize: 26, fontWeight: '800', letterSpacing: -0.8, color: colors.ink, marginTop: 4 }}>
            {funded.funded_year}년 <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sub2 }}>은퇴 넘버 {eok(funded.target)} 도달</Text>
          </Text>
          <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '600', marginTop: 2 }}>
            변동성 반영 90% 구간 {funded.mc_p10}~{funded.mc_p90}년 · 저축을 늘리면 앞당겨져요
          </Text>
        </>
      ) : (
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink, marginTop: 6, lineHeight: 19 }}>
          지금 저축 속도로는 지평선 안 도달이 어려워요 — 여윳돈 마진을 만드는 게 먼저예요
        </Text>
      )}
      <Svg viewBox="0 0 320 200" width="100%" height={84} preserveAspectRatio="none" style={{ marginTop: 10 }}>
        <Line x1={X0} y1={targetY} x2={X1} y2={targetY} stroke="#D7DBE0" strokeWidth={1.4} strokeDasharray="4 4" />
        <Path d={curve} fill="none" stroke={colors.buffer ?? colors.green} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        {crossIdx >= 0 && crossIdx <= endIdx && (
          <Circle cx={px(crossIdx)} cy={py(funded.savings_path[crossIdx])} r={4.5} fill={colors.green} stroke="#fff" strokeWidth={2} />
        )}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={{ fontSize: 10.5, fontWeight: '600', color: colors.faint }}>{years[0]}</Text>
        <Text style={{ fontSize: 10.5, fontWeight: '600', color: colors.faint }}>은퇴 넘버 {eok(funded.target)} = 연 생활비 25배 (4% 룰)</Text>
        <Text style={{ fontSize: 10.5, fontWeight: '600', color: colors.faint }}>{years[years.length - 1]}</Text>
      </View>
      <Text style={{ fontSize: 11, color: colors.sub2, fontWeight: '500', lineHeight: 16, marginTop: 8 }}>
        {funded.reasons[funded.reasons.length - 1]}
      </Text>
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
