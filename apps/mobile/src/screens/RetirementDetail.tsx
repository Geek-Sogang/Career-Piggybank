import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { getForecast, type Forecast } from '@/api';
import { colors } from '@/theme/colors';
import { Icon, type IconName } from '@/components/Icon';
import { Card } from '@/components/ui';
import { useApp, type Scenario } from '@/store';

// 영상 [12] 은퇴 상세 — 상단 세그먼트 탭으로 '내 은퇴곡선'과 '내 연금'을 전환한다.
// 은퇴곡선: 예측 근거(수입 예측·지출 통계) + 은퇴를 미루는 솔루션.
// 내 연금: 납입 중 연금 + 은퇴곡선에 맞춘 납입 조정 조언.
export function RetirementDetail() {
  const { retireTab } = useApp();
  const [tab, setTab] = useState<'curve' | 'pension'>(retireTab);
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', backgroundColor: '#EDEFF2', borderRadius: 13, padding: 4 }}>
        {([['curve', '내 은퇴곡선'], ['pension', '내 연금']] as ['curve' | 'pension', string][]).map(([k, label]) => {
          const active = tab === k;
          return (
            <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: active ? '#fff' : 'transparent', alignItems: 'center', ...(active ? { shadowColor: '#111827', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } } : {}) }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: active ? colors.green : colors.sub3 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {tab === 'curve' ? <CurveTab /> : <PensionTab />}
    </View>
  );
}

// ── 내 은퇴곡선 ────────────────────────────────────────────────────
function CurveTab() {
  const { vals, scenario, actions } = useApp();
  const [fc, setFc] = useState<Forecast | null>(null);
  const [unavail, setUnavail] = useState(false);
  useEffect(() => {
    let live = true;
    getForecast().then((n) => { if (live) setFc(n); }).catch(() => { if (live) setUnavail(true); });
    return () => { live = false; };
  }, []);
  const liveBand = fc?.retirement.find((b) => b.scenario === scenario)?.label;
  const chart = fc ? buildChart(fc.path, fc.retirement, scenario) : null;

  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={{ fontSize: 13, color: colors.sub, fontWeight: '700' }}>일감 소득 유지 전망 · 생활비 기준</Text>
        <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: -1, color: colors.green, marginTop: 4 }}>{liveBand ?? (unavail ? vals.scLabel : '계산 중…')}</Text>
        <Text style={{ fontSize: 12.5, color: colors.sub2, fontWeight: '600', marginTop: 3, lineHeight: 18 }}>
          {fc
            ? `내 입금 시계열 기반 · 90%가 ${fc.mc.band_end_year}년 이전 생활비 기준선 하회`
            : unavail ? `${vals.scSub} · 오프라인 신뢰구간` : '내 입금 시계열을 불러오는 중이에요'}
        </Text>
      </View>

      {/* 차트 */}
      <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 16, paddingBottom: 14 }}>
        <View style={{ position: 'relative' }}>
          <Svg viewBox="0 0 320 200" width="100%" height={130} preserveAspectRatio="none">
            {chart ? (
              <>
                <Path d={chart.band} fill="rgba(0,132,133,.10)" />
                <Line x1={X0} y1={chart.targetY} x2={X1} y2={chart.targetY} stroke="#D7DBE0" strokeWidth={1.4} strokeDasharray="4 4" />
                <Path d={chart.curve} fill="none" stroke={colors.green} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                {chart.crossX != null && <Circle cx={chart.crossX} cy={chart.targetY} r={4.5} fill={colors.green} stroke="#fff" strokeWidth={2} />}
              </>
            ) : unavail ? (
              <>
                <Path d="M10 170 C 110 150 205 86 310 50 L 310 104 C 205 134 110 168 10 176 Z" fill="rgba(0,132,133,.10)" />
                <Line x1="10" y1="74" x2="310" y2="74" stroke="#D7DBE0" strokeWidth={1.4} strokeDasharray="4 4" />
                <Path d="M10 173 C 110 158 205 92 310 62" fill="none" stroke={colors.green} strokeWidth={2.6} strokeLinecap="round" />
                <Circle cx="206" cy="74" r="4.5" fill={colors.green} stroke="#fff" strokeWidth={2} />
              </>
            ) : (
              <Line x1="10" y1="100" x2="310" y2="100" stroke="#E3E6EA" strokeWidth={10} strokeLinecap="round" />
            )}
          </Svg>
          {(chart || unavail) && (
            <View style={{ position: 'absolute', top: 4, bottom: 18, left: `${(chart ? chart.bandLeft : vals.scLeft) * 100}%`, width: `${(chart ? chart.bandWidth : vals.scWidth) * 100}%`, backgroundColor: 'rgba(0,132,133,.13)', borderLeftWidth: 1.5, borderRightWidth: 1.5, borderColor: colors.green, borderStyle: 'dashed', borderRadius: 2 }}>
              <Text style={{ position: 'absolute', top: -8, alignSelf: 'center', fontSize: 10, fontWeight: '800', color: colors.greenDark, backgroundColor: colors.greenTint, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6, overflow: 'hidden' }}>{liveBand ?? vals.scLabel}</Text>
            </View>
          )}
          <Text style={{ position: 'absolute', left: 10, top: chart ? `${(chart.targetY / 200) * 100 - 6}%` : '44%', fontSize: 10, fontWeight: '700', color: colors.faint, backgroundColor: '#fff', paddingHorizontal: 4 }}>생활비 목표</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          {(chart ? chart.xLabels : ['2025', '2035', '2045']).map((y) => <Text key={y} style={{ fontSize: 10.5, fontWeight: '600', color: colors.faint }}>{y}</Text>)}
        </View>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line2 }}>
          <Legend color={colors.green} text="일감 흐름(월 소득)" />
          <Legend band text="신뢰구간" />
          <Legend dash text="생활비 목표" />
        </View>
      </View>

      {/* 소득 경로 토글 */}
      <View style={{ flexDirection: 'row', gap: 6, backgroundColor: '#EDEFF2', borderRadius: 13, padding: 4 }}>
        {([['cons', '소득 하방'], ['base', '기준'], ['opt', '소득 상방']] as [Scenario, string][]).map(([s, label]) => {
          const active = scenario === s;
          return (
            <Pressable key={s} onPress={() => actions.scen(s)} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: active ? '#fff' : 'transparent', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: active ? colors.green : colors.sub3 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* 계산 배경 — 수입 예측 · 지출 통계 */}
      <View style={{ backgroundColor: '#FBFBFC', borderWidth: 1, borderColor: colors.dash, borderStyle: 'dashed', borderRadius: 14, padding: 14 }}>
        <Text style={{ fontSize: 12, color: colors.sub, lineHeight: 19, fontWeight: '500' }}>
          <Text style={{ fontWeight: '800', color: colors.ink2 }}>어떻게 계산했나요?</Text>{'\n'}
          · 수입 예측: 수주 간격·발주처 다양성·단가 추세(내 원장만 가진 신호)를 연령 곡선보다 우선 반영해요.{'\n'}
          · 지출 통계: 최근 생활비 중앙값으로 '생활비 기준선'을 잡아요. 이 선 아래로 소득이 내려가는 해가 은퇴 구간이에요.{'\n'}
          {fc ? fc.career_signals.reasons.map((r) => `· ${r}`).join('\n') : '· 입금 데이터가 쌓일수록 신뢰구간이 좁아져요.'}
        </Text>
      </View>

      {/* 솔루션 — 은퇴를 뒤로 미루려면? */}
      <Card style={{ gap: 12 }}>
        <View>
          <Text style={{ fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>은퇴 시점을 더 미루려면?</Text>
          <Text style={{ fontSize: 12, color: colors.sub2, fontWeight: '500', marginTop: 3 }}>지금 상태에서 소득 유지 구간을 늘리는 두 가지 방법이에요.</Text>
        </View>
        <SolutionRow icon="trending" tint={colors.greenTint} color={colors.green} title="일을 더 수주하기" effect="월 1건 더 수주하면 소득 유지 구간 +3.2년" />
        <SolutionRow icon="coin" tint={colors.bufferTint} color={colors.buffer} title="지출 줄이기" effect="월 생활비 −30만원이면 은퇴 안정 시점 +2.1년" />
      </Card>

      <Pressable onPress={() => actions.pushScr('nestEgg')} style={{ backgroundColor: colors.green, borderRadius: 15, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, shadowColor: colors.green, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }}>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>노후 준비 시작하기</Text>
        <Icon name="arrowRight" size={18} color="#fff" sw={2.2} />
      </Pressable>
    </View>
  );
}

function SolutionRow({ icon, tint, color, title, effect }: { icon: IconName; tint: string; color: string; title: string; effect: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bg, borderRadius: 14, padding: 14 }}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={21} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{title}</Text>
        <Text style={{ fontSize: 12, fontWeight: '600', color, marginTop: 2 }}>{effect}</Text>
      </View>
    </View>
  );
}

// ── 내 연금 ────────────────────────────────────────────────────────
type Pension = { name: string; sub: string; monthly: number; color: string; tint: string; locked?: boolean };
const PENSIONS: Pension[] = [
  { name: '국민연금', sub: '의무 가입', monthly: 189_000, color: colors.buffer, tint: colors.bufferTint, locked: true },
  { name: '연금저축펀드', sub: '세액공제 대상 (16.5%)', monthly: 250_000, color: colors.green, tint: colors.greenTint },
  { name: 'IRP', sub: '개인형 퇴직연금', monthly: 100_000, color: colors.indigo, tint: colors.indigoTint },
];
const BASE_RETIRE_YEAR = 2043;   // 데모: 현재 납입 기준 은퇴 넘버 도달 해
const STEP = 50_000;             // 조절 단위 (연금저축 월 납입)

function PensionTab() {
  const [extra, setExtra] = useState(0);   // 연금저축 월 추가 납입액
  const projectedYear = Math.round((BASE_RETIRE_YEAR - (extra / STEP) * 0.6) * 10) / 10;
  const yearsEarlier = Math.round(((BASE_RETIRE_YEAR - projectedYear)) * 10) / 10;
  const savingMonthly = PENSIONS[1].monthly + extra;
  const annualDeduction = Math.round(Math.min(savingMonthly * 12, 6_000_000) * 0.165);
  const totalMonthly = PENSIONS.reduce((a, p) => a + p.monthly, 0) + extra;

  return (
    <View style={{ gap: 14 }}>
      <View>
        <Text style={{ fontSize: 13, color: colors.sub, fontWeight: '700' }}>매달 납입 중인 연금</Text>
        <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: -1, color: colors.ink, marginTop: 4, fontVariant: ['tabular-nums'] }}>₩{totalMonthly.toLocaleString('en-US')}<Text style={{ fontSize: 15, fontWeight: '700', color: colors.sub2 }}> /월</Text></Text>
      </View>

      {/* 납입 중 연금 목록 */}
      <Card p={0} style={{ paddingHorizontal: 16, borderRadius: 16 }}>
        {PENSIONS.map((p, i) => {
          const monthly = p.name === '연금저축펀드' ? p.monthly + extra : p.monthly;
          return (
            <View key={p.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 15, borderBottomWidth: i < PENSIONS.length - 1 ? 1 : 0, borderBottomColor: colors.line2 }}>
              <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: p.tint, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="coin" size={21} color={p.color} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{p.name}</Text>
                <Text style={{ fontSize: 12, fontWeight: '500', color: colors.sub2, marginTop: 2 }}>{p.sub}</Text>
              </View>
              <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>₩{monthly.toLocaleString('en-US')}</Text>
            </View>
          );
        })}
      </Card>

      {/* 조언 + 조절 — 은퇴곡선에 맞춘 연금저축 조정 */}
      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.green, backgroundColor: colors.greenTint, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 8, overflow: 'hidden' }}>피기 조언</Text>
          <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.ink }}>연금저축 납입 조정</Text>
        </View>
        <Text style={{ fontSize: 12.5, fontWeight: '500', color: colors.sub, lineHeight: 19 }}>
          연금저축을 조금 늘리면 세액공제도 커지고 은퇴 넘버 도달도 앞당겨져요. 슬라이더로 조정해 보세요.
        </Text>

        {/* 조절 스테퍼 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Stepper label="−" disabled={extra <= 0} onPress={() => setExtra((e) => Math.max(0, e - STEP))} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.sub2 }}>월 추가 납입</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: extra > 0 ? colors.green : colors.sub3, fontVariant: ['tabular-nums'] }}>{extra > 0 ? `+₩${extra.toLocaleString('en-US')}` : '₩0'}</Text>
          </View>
          <Stepper label="+" disabled={extra >= STEP * 6} onPress={() => setExtra((e) => Math.min(STEP * 6, e + STEP))} />
        </View>

        {/* 효과 요약 */}
        <View style={{ backgroundColor: colors.greenTint, borderRadius: 14, padding: 15, gap: 8 }}>
          <EffectLine label="은퇴 넘버 도달" value={`${Math.floor(projectedYear)}년`} accent />
          {yearsEarlier > 0 && <EffectLine label="현재보다" value={`${yearsEarlier.toFixed(1)}년 앞당김`} />}
          <EffectLine label="연 세액공제" value={`+₩${annualDeduction.toLocaleString('en-US')}`} />
        </View>

        <Pressable style={{ backgroundColor: extra > 0 ? colors.green : colors.dash, borderRadius: 15, paddingVertical: 16, alignItems: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>{extra > 0 ? `월 +₩${extra.toLocaleString('en-US')} 납입 신청하기` : '납입액을 조정해 주세요'}</Text>
        </Pressable>
      </Card>
    </View>
  );
}

function EffectLine({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.greenInk }}>{label}</Text>
      <Text style={{ fontSize: accent ? 15 : 13, fontWeight: '800', color: accent ? colors.green : colors.greenInk, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

function Stepper({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} style={{ width: 52, height: 52, borderRadius: 15, borderWidth: 1.4, borderColor: disabled ? colors.line : colors.green, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: disabled ? colors.sub3 : colors.green }}>{label}</Text>
    </Pressable>
  );
}

// ── 차트 로직 ──────────────────────────────────────────────────────
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
