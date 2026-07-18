import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { getForecast, type Forecast } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/ui';
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
            <Icon name="chevronRight" size={20} color="#C2C7CE" sw={2.2} />
          </View>

          {/* 미니 은퇴곡선 */}
          <View style={{ position: 'relative' }}>
            <Svg viewBox="0 0 320 120" width="100%" height={70} preserveAspectRatio="none">
              <Path d="M10 100 C 110 88 205 50 310 28 L 310 62 C 205 82 110 104 10 108 Z" fill="rgba(0,132,133,.10)" />
              <Line x1="10" y1="44" x2="310" y2="44" stroke="#D7DBE0" strokeWidth={1.2} strokeDasharray="4 4" />
              <Path d="M10 102 C 110 92 205 54 310 36" fill="none" stroke={colors.green} strokeWidth={2.4} strokeLinecap="round" />
            </Svg>
            <View style={{ position: 'absolute', top: 2, bottom: 12, left: `${vals.scLeft * 100}%`, width: `${vals.scWidth * 100}%`, backgroundColor: 'rgba(0,132,133,.13)', borderLeftWidth: 1.5, borderRightWidth: 1.5, borderColor: colors.green, borderStyle: 'dashed', borderRadius: 2 }} />
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

      {/* 노후 준비 상품 CTA — 연금 현황·조정은 연금 페이싱 설계 확정 후 실배선 */}
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
