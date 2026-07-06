import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { fetchStrength } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card, Mascot, Stat, T } from '@/components/ui';
import { useApp } from '@/store';

// 서버/LLM 미가동 시 오프라인 폴백 문구
const OFFLINE_STRENGTH = '"꾸준한 React 커밋과 정시 정산 — 신뢰도 높은 프론트엔드 개발자"';

export function Piggy() {
  const { actions } = useApp();
  const [strength, setStrength] = useState(OFFLINE_STRENGTH);
  useEffect(() => {
    fetchStrength()
      .then((s) => setStrength(`"${s.line}"`)) // 결정론 후보 원문 — AI는 선택만 했음
      .catch(() => {});
  }, []);

  return (
    <View style={{ gap: 14 }}>
      {/* 검증된 이력 */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>검증된 이력</Text>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.green, backgroundColor: colors.greenTint, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 9, overflow: 'hidden' }}>확정 ✓</Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          <Stat value="12" unit="건" label="검증 완료" />
          <Stat value="8" unit="개월" label="연속 활동" borderLeft />
          <Stat value="30" unit="개월" label="거래 기간" flex={1.2} borderLeft />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 }}>
          {[0, 1, 2].map((i) => <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.green }} />)}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.faint2 }}>잠정</Text>
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.faint2 }}>준검증</Text>
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.green }}>확정</Text>
        </View>
      </Card>

      {/* AI 강점 */}
      <View style={{ backgroundColor: colors.greenTint2, borderWidth: 1, borderColor: colors.greenLine, borderRadius: 18, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Mascot head size={40} radius={12} style={{ backgroundColor: '#fff' }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.green, letterSpacing: 0.2 }}>AI가 본 내 강점</Text>
          <Text style={{ fontSize: 14.5, fontWeight: '700', lineHeight: 21, marginTop: 5, color: colors.ink }}>{strength}</Text>
          <Text style={{ fontSize: 11, color: '#7C9594', marginTop: 6, fontWeight: '600' }}>자기보고 아님 · 검증 이력에서 AI가 선택</Text>
        </View>
      </View>

      {/* CTA */}
      <Pressable onPress={() => actions.pushScr('connect')} style={{ backgroundColor: colors.green, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: colors.green, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } }}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>커리어 연결하고 한도 늘리기</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,.82)', fontWeight: '500' }}>연결할수록 검증 한도가 커져요</Text>
        </View>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,.18)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={20} color="#fff" sw={2.2} />
        </View>
      </Pressable>

      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sub, marginHorizontal: 4, marginTop: 2, marginBottom: -2 }}>검증된 일감</Text>

      <Pressable onPress={() => actions.openJob('commerce')}>
        <JobRow badge="커" badgeBg={colors.indigoTint} badgeColor={colors.indigo} title="○○커머스 · 웹 프론트엔드" sub="2025.05 정산 · 3자 교차검증" amount="₩500,000" verified />
      </Pressable>
      <Pressable onPress={() => actions.openJob('studio')}>
        <JobRow badge="스" badgeBg={colors.orangeTint} badgeColor={colors.orange} title="△△스튜디오 · 랜딩 개발" sub="2025.03 정산" amount="₩1,200,000" verified />
      </Pressable>
      <Pressable onPress={() => actions.openJob('personal')}>
        <JobRow badge="개" badgeBg={colors.line} badgeColor={colors.sub2} title="개인 프로젝트 · 오픈소스" sub="2024.11~ 진행중" right="미정산" rightSub="자기보고" />
      </Pressable>
    </View>
  );
}

function JobRow({ badge, badgeBg, badgeColor, title, sub, amount, verified, right, rightSub }: { badge: string; badgeBg: string; badgeColor: string; title: string; sub: string; amount?: string; verified?: boolean; right?: string; rightSub?: string }) {
  return (
    <Card p={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16 }}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: badgeBg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: badgeColor }}>{badge}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{title}</Text>
        <Text style={{ fontSize: 12, color: colors.sub2, marginTop: 2, fontWeight: '500' }}>{sub}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: amount ? 14.5 : 13, fontWeight: amount ? '800' : '700', color: amount ? colors.ink : colors.sub3, ...T.num }}>{amount || right}</Text>
        <Text style={{ fontSize: 11, fontWeight: '700', color: verified ? colors.green : '#A8AEB6', marginTop: 3 }}>{verified ? '검증 ✓' : rightSub}</Text>
      </View>
    </Card>
  );
}
