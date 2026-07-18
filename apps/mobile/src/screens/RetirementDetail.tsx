import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { getForecast, type Forecast } from '@/api';
import { colors } from '@/theme/colors';
import { Icon, type IconName } from '@/components/Icon';
import { Card } from '@/components/ui';
import { useApp, type Scenario } from '@/store';

// 영상 [12] 은퇴 상세 — 세그먼트 2탭: 내 은퇴곡선(실 forecast) / 내 연금(페이싱 v1).
// 연금 문법 = ⑤b 금액 페이싱의 6번째 적용: 사람이 밴드를 1회 승인 → AI가 이번 달
// 페이스만 판정(근거 접지) → 실행은 항상 사람의 승인(HITL). 도달 연도 공식은 두지 않는다.
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
        {/* 방향만 말한다 — 효과 연수는 검증된 산출이 없어 수치로 약속하지 않는다 */}
        <SolutionRow icon="trending" tint={colors.greenTint} color={colors.green} title="일을 더 수주하기" effect="수주 간격이 좁아질수록 소득 유지 구간이 길어져요" />
        <SolutionRow icon="coin" tint={colors.bufferTint} color={colors.buffer} title="지출 줄이기" effect="생활비 기준선이 낮아지면 은퇴 구간이 뒤로 밀려요" />
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

// ── 내 연금 — 연동 연금 목록 + 연금 페이싱 v1(프론트 시뮬, 백엔드 ⑤b 확장 후속) ──
// 납입 내역은 데모 시나리오 시드(마이데이터 연금 연동 가정). 하나 상품명 준수.
export const PENSIONS: { name: string; sub: string; monthly: number; color: string; tint: string }[] = [
  { name: '국민연금', sub: '의무 가입', monthly: 189_000, color: colors.buffer, tint: colors.bufferTint },
  { name: '하나 연금저축펀드', sub: '세액공제 대상', monthly: 250_000, color: colors.green, tint: colors.greenTint },
  { name: '하나 IRP', sub: '개인형 퇴직연금', monthly: 100_000, color: colors.indigo, tint: colors.indigoTint },
];
export const PENSION_MONTHLY_TOTAL = PENSIONS.reduce((a, p) => a + p.monthly, 0);

// 사전 승인 밴드(사람이 정한 원칙)와 이번 달 기본 페이스 — 판정 시뮬 상수.
// 효과 연수(도달 앞당김)는 검증된 산출이 없어 표시하지 않는다. 세액공제만 산수로 보여준다.
const PACE_BAND = { min: 0, max: 400_000 };
const PACE_AMOUNT = 300_000;
// 세액공제 산수 — 표준 인용(16.5%, 개인 조건에 따라 13.2~16.5%): products.ts와 동일 표기 체계
const ANNUAL_DEDUCTION = Math.round(PACE_AMOUNT * 12 * 0.165);

type PaceState = 'idle' | 'judging' | 'proposed' | 'approved' | 'skipped';

function PensionTab() {
  const [pace, setPace] = useState<PaceState>('idle');
  const [fc, setFc] = useState<Forecast | null>(null);
  useEffect(() => {
    let live = true;
    getForecast().then((n) => { if (live) setFc(n); }).catch(() => {});
    return () => { live = false; };
  }, []);
  // 판정 연출(⑤b 프론트 시뮬 전례) — 3초 뒤 제안. 근거는 실 forecast로 접지.
  useEffect(() => {
    if (pace !== 'judging') return;
    const t = setTimeout(() => setPace('proposed'), 3000);
    return () => clearTimeout(t);
  }, [pace]);

  const reasons = fc
    ? [
      `다음 수입 ${fc.income_gap.expected_next_date.slice(5).replace('-', '/')}쯤 예상 — 입금 간격 중앙값 ${Math.round(fc.income_gap.median_gap_days)}일`,
      `소득 변동계수 ${fc.income_cv.toFixed(2)} — 무리하지 않는 기본 페이스로 제안해요`,
    ]
    : ['소득 리듬 데이터를 불러오는 중이에요 — 기본 페이스 기준으로 제안해요'];

  return (
    <View style={{ gap: 14 }}>
      <View>
        <Text style={{ fontSize: 13, color: colors.sub, fontWeight: '700' }}>매달 납입 중인 연금</Text>
        <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: -1, color: colors.ink, marginTop: 4, fontVariant: ['tabular-nums'] }}>
          ₩{PENSION_MONTHLY_TOTAL.toLocaleString('en-US')}<Text style={{ fontSize: 15, fontWeight: '700', color: colors.sub2 }}> /월</Text>
        </Text>
      </View>

      {/* 납입 중 연금 목록 */}
      <Card p={0} style={{ paddingHorizontal: 16, borderRadius: 16 }}>
        {PENSIONS.map((p, i) => (
          <View key={p.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 15, borderBottomWidth: i < PENSIONS.length - 1 ? 1 : 0, borderBottomColor: colors.line2 }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: p.tint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="coin" size={21} color={p.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{p.name}</Text>
              <Text style={{ fontSize: 12, fontWeight: '500', color: colors.sub2, marginTop: 2 }}>{p.sub}</Text>
            </View>
            <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>₩{p.monthly.toLocaleString('en-US')}</Text>
          </View>
        ))}
      </Card>

      {/* 연금 페이싱 — 정액 자동이체는 보릿고개 달에 깨진다. 리듬에 맞춰 이번 달 페이스만 판정 */}
      <Card style={{ gap: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#7C5CBF', backgroundColor: '#F5F1FB', paddingVertical: 4, paddingHorizontal: 9, borderRadius: 8, overflow: 'hidden' }}>AI 페이싱</Text>
          <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '800', color: colors.ink }}>이번 달 연금 페이스</Text>
        </View>
        <Text style={{ fontSize: 12.5, fontWeight: '500', color: colors.sub, lineHeight: 19 }}>
          내가 정한 원칙(월 ₩{PACE_BAND.min.toLocaleString('en-US')}~{PACE_BAND.max.toLocaleString('en-US')} · 여윳돈이 기준 이상인 달만) 안에서, 이번 달 얼마가 무리 없는지만 판정해요. 납입은 항상 내 승인으로 실행돼요.
        </Text>

        {pace === 'idle' && (
          <Pressable onPress={() => setPace('judging')} style={{ backgroundColor: colors.green, borderRadius: 15, paddingVertical: 15, alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>이번 달 페이스 판정받기</Text>
          </Pressable>
        )}

        {pace === 'judging' && (
          <View style={{ alignItems: 'center', paddingVertical: 14, gap: 10 }}>
            <ActivityIndicator size="small" color={colors.green} />
            <Text style={{ fontSize: 12.5, fontWeight: '500', color: colors.sub2 }}>이번 달 소득 리듬과 여윳돈을 보고 있어요…</Text>
          </View>
        )}

        {pace === 'proposed' && (
          <View style={{ gap: 12 }}>
            <View style={{ backgroundColor: colors.greenTint, borderRadius: 14, padding: 15, gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: colors.green }}>기본 페이스</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink }}>이번 달 하나 연금저축펀드에{'\n'}₩{PACE_AMOUNT.toLocaleString('en-US')} 어떠세요?</Text>
              <View style={{ gap: 4, marginTop: 4 }}>
                {reasons.map((r) => (
                  <Text key={r} style={{ fontSize: 11.5, fontWeight: '500', color: colors.greenInk, lineHeight: 17 }}>· {r}</Text>
                ))}
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bg, borderRadius: 12, padding: 13 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.sub }}>이 페이스로 1년이면 세액공제 예상</Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.green, fontVariant: ['tabular-nums'] }}>약 ₩{ANNUAL_DEDUCTION.toLocaleString('en-US')}</Text>
            </View>
            <Text style={{ fontSize: 10.5, fontWeight: '500', color: colors.sub3, lineHeight: 15 }}>
              세액공제율 16.5% 기준 산수 — 개인 조건에 따라 13.2~16.5% · 5월 추가납부가 그만큼 가벼워져요
            </Text>
            <Pressable onPress={() => setPace('approved')} style={{ backgroundColor: colors.green, borderRadius: 15, paddingVertical: 15, alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>이번 달 ₩{PACE_AMOUNT.toLocaleString('en-US')} 납입 승인</Text>
            </Pressable>
            <Pressable onPress={() => setPace('skipped')} style={{ paddingVertical: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.sub3 }}>이번 달은 쉬어갈게요</Text>
            </Pressable>
          </View>
        )}

        {pace === 'approved' && (
          <View style={{ backgroundColor: colors.greenTint2, borderWidth: 1, borderColor: colors.greenLine, borderRadius: 14, padding: 15, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="check" size={13} color="#fff" sw={2.6} />
              </View>
              <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.greenInk }}>이번 달 ₩{PACE_AMOUNT.toLocaleString('en-US')} 납입을 승인했어요</Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.greenInk, lineHeight: 17 }}>
              연 세액공제 예상 약 ₩{ANNUAL_DEDUCTION.toLocaleString('en-US')} — 노후와 5월 세금을 같이 챙겼어요. 다음 달 리듬으로 다시 판정해 드릴게요.
            </Text>
          </View>
        )}

        {pace === 'skipped' && (
          <View style={{ backgroundColor: colors.bg, borderRadius: 14, padding: 15 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.sub, lineHeight: 18 }}>
              이번 달은 쉬어가요 — 소득 공백 달에 무리하지 않는 것도 페이스예요. 다음 달 리듬으로 다시 판정해 드릴게요.
            </Text>
          </View>
        )}
      </Card>

      {/* 하나원큐 포지셔닝 — 무엇에(포트폴리오)는 하나원큐, 언제·얼마(페이스)는 우리 */}
      <Text style={{ fontSize: 11, fontWeight: '500', color: colors.sub3, lineHeight: 16, marginHorizontal: 4 }}>
        어떤 상품에 넣을지는 하나원큐 연금 솔루션이, 언제·얼마 넣을지는 내 소득 리듬을 아는 피기가 함께해요.
      </Text>
    </View>
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
