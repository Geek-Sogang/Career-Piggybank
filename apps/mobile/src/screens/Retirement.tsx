import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { getForecast, type Forecast } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/ui';
import { PENSIONS, PENSION_MONTHLY_TOTAL, X0, X1, buildChart } from '@/screens/RetirementDetail';
import { useApp } from '@/store';

// 미래 탭 = 은퇴 전망 요약(박스). 박스를 누르면 상세(내 은퇴곡선 · 내 연금)로 전환한다.
export function Retirement() {
  const { vals, scenario, actions } = useApp();
  const [fc, setFc] = useState<Forecast | null>(null);
  const [unavail, setUnavail] = useState(false);
  useEffect(() => {
    let live = true;
    getForecast().then((n) => { if (live) setFc(n); }).catch(() => { if (live) setUnavail(true); });
    return () => { live = false; };
  }, []);
  const liveBand = fc?.retirement.find((b) => b.scenario === scenario)?.label;
  const chart = fc ? buildChart(fc.path, fc.retirement, scenario) : null;   // 상세와 동일한 실 곡선

  return (
    <View style={{ gap: 14 }}>
      {/* 은퇴곡선 박스 (히어로) — 탭 = 상세 화면 */}
      <Pressable onPress={() => actions.pushScr('retirementDetail')}>
        <Card style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12.5, color: colors.sub, fontWeight: '700' }}>일감 소득 유지 전망 · 생활비 기준</Text>
              <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: -1, color: colors.green, marginTop: 4 }}>{liveBand ?? (unavail ? vals.scLabel : '계산 중…')}</Text>
              <Text style={{ fontSize: 12, color: colors.sub2, fontWeight: '600', marginTop: 3 }}>내 입금 시계열로 예측한 은퇴 구간이에요</Text>
            </View>
            <Icon name="chevronRight" size={20} color={colors.chev} sw={2.2} />
          </View>

          {/* 미니 은퇴곡선 — 상세(buildChart)와 동일한 실 forecast. 오프라인일 때만 자리표시 곡선 */}
          <View style={{ position: 'relative' }}>
            <Svg viewBox="0 0 320 200" width="100%" height={96} preserveAspectRatio="none">
              {chart ? (
                <>
                  <Path d={chart.band} fill="rgba(0,132,133,.10)" />
                  <Line x1={X0} y1={chart.targetY} x2={X1} y2={chart.targetY} stroke={colors.dash} strokeWidth={1.4} strokeDasharray="4 4" />
                  <Path d={chart.curve} fill="none" stroke={colors.green} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                </>
              ) : (
                <>
                  <Path d="M10 170 C 110 150 205 86 310 50 L 310 104 C 205 134 110 168 10 176 Z" fill="rgba(0,132,133,.10)" />
                  <Line x1="10" y1="74" x2="310" y2="74" stroke={colors.dash} strokeWidth={1.4} strokeDasharray="4 4" />
                  <Path d="M10 173 C 110 158 205 92 310 62" fill="none" stroke={colors.green} strokeWidth={2.6} strokeLinecap="round" />
                </>
              )}
            </Svg>
            <View style={{ position: 'absolute', top: 2, bottom: 12, left: `${(chart ? chart.bandLeft : vals.scLeft) * 100}%`, width: `${(chart ? chart.bandWidth : vals.scWidth) * 100}%`, backgroundColor: 'rgba(0,132,133,.13)', borderLeftWidth: 1.5, borderRightWidth: 1.5, borderColor: colors.green, borderStyle: 'dashed', borderRadius: 2 }} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: colors.line2, paddingTop: 12 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.green }}>내 은퇴곡선 · 내 연금 자세히 보기</Text>
            <Icon name="arrowRight" size={15} color={colors.green} sw={2.2} />
          </View>
        </Card>
      </Pressable>

      {/* 다음 수입 예측 — 스트림 분해 합성(플랫폼 주기·재수주 리듬·진행 중 계약) */}
      {fc && (
        <View style={{ backgroundColor: colors.greenTint2, borderWidth: 1, borderColor: colors.greenLine, borderRadius: 14, padding: 13, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="trending" size={18} color={colors.green} sw={2.2} />
            <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '600', color: colors.ink, lineHeight: 18 }}>
              다음 수입 예상: <Text style={{ fontWeight: '800' }}>보통 {(fc.streams.composite_next?.expected_date ?? fc.income_gap.expected_next_date).slice(5).replace('-', '/')}쯤</Text>
              {!fc.streams.composite_next && fc.income_gap.window?.[0]
                ? <Text style={{ color: colors.sub2, fontWeight: '600' }}> · 빠르면 {fc.income_gap.window[0].slice(5).replace('-', '/')}</Text>
                : null}
            </Text>
          </View>
          {/* 예측 근거 — 백엔드가 계산에 실제로 쓴 신호(스트림 basis 또는 입금 간격 통계) */}
          {(() => {
            const basis = fc.streams.composite_next?.basis ?? fc.income_gap.reasons?.[0];
            return basis ? (
              <Text style={{ fontSize: 11, fontWeight: '500', color: colors.sub2, lineHeight: 15, marginLeft: 28 }}>· {basis}</Text>
            ) : null;
          })()}
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

      {/* 내 연금 요약 — 탭 = 상세의 '내 연금'(페이싱)으로 바로 */}
      <Pressable onPress={() => actions.openRetire('pension')}>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>내 연금</Text>
            <Icon name="chevronRight" size={20} color={colors.chev} sw={2.2} />
          </View>
          <View>
            <Text style={{ fontSize: 12, color: colors.sub2, fontWeight: '600' }}>매달 납입 중</Text>
            <Text style={{ fontSize: 26, fontWeight: '800', letterSpacing: -0.6, color: colors.ink, marginTop: 2, fontVariant: ['tabular-nums'] }}>
              ₩{PENSION_MONTHLY_TOTAL.toLocaleString('en-US')}<Text style={{ fontSize: 14, fontWeight: '700', color: colors.sub2 }}> /월</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {PENSIONS.map((p) => (
              <Text key={p.name} style={{ fontSize: 11, fontWeight: '700', color: p.color, backgroundColor: p.tint, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 9, overflow: 'hidden' }}>{p.name}</Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: colors.line2, paddingTop: 11 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.green }}>이번 달 연금 페이스를 판정받아 보세요</Text>
          </View>
        </Card>
      </Pressable>

      {/* 노후 준비 상품 CTA */}
      <Pressable onPress={() => actions.pushScr('nestEgg')}>
        <View style={{ backgroundColor: colors.green, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: colors.green, shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }}>
          <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="houseSmall" size={22} color="#fff" sw={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: 'rgba(255,255,255,.85)' }}>노후 준비</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff', marginTop: 2, letterSpacing: -0.3 }}>연금저축·IRP로 세액공제 받기</Text>
          </View>
          <Icon name="arrowRight" size={20} color="#fff" sw={2.2} />
        </View>
      </Pressable>
    </View>
  );
}
