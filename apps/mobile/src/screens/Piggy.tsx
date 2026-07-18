import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { fetchStrength } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card, Mascot, Stat, T } from '@/components/ui';
import { useApp } from '@/store';

// 서버/LLM 미가동 시 오프라인 폴백 문구
const OFFLINE_STRENGTH = '"꾸준한 React 커밋과 정시 정산 — 신뢰도 높은 프론트엔드 개발자"';

// 커리어 탭 — 신뢰 층 전용: 검증된 일감이 쌓인 것을 보여주는 화면.
// 게임 층(저금통·미션·XP)은 미션 탭이, 돈(목표 봉투·페이싱)은 정산 탭이 담당한다.
export function Piggy() {
  const { actions, vals } = useApp();
  const [strength, setStrength] = useState(OFFLINE_STRENGTH);
  useEffect(() => {
    fetchStrength({
      verified_count: vals.verified.count,
      months_active: vals.verified.streak_months,
      repeat_client_rate: 0,
      settlement_growth: 0,
      top_skill: vals.verified.recent[0]?.memo || '개발',
    })
      .then((s) => setStrength(`"${s.line}"`)) // 결정론 후보 원문 — AI는 선택만 했음
      .catch(() => {});
  }, [vals.verified.count, vals.verified.streak_months, vals.verified.recent]);

  return (
    <View style={{ gap: 14 }}>
      {/* AI 강점 — 검증 이력에서 AI가 고른 한 줄. 이 탭의 첫인상 = "AI가 요약한 나" */}
      <View style={{ backgroundColor: colors.greenTint2, borderWidth: 1, borderColor: colors.greenLine, borderRadius: 18, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Mascot head size={40} radius={12} style={{ backgroundColor: '#fff' }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.green, letterSpacing: 0.2 }}>AI가 본 내 강점</Text>
          <Text style={{ fontSize: 14.5, fontWeight: '700', lineHeight: 21, marginTop: 5, color: colors.ink }}>{strength}</Text>
          <Text style={{ fontSize: 11, color: '#7C9594', marginTop: 6, fontWeight: '600' }}>자기보고 아님 · 검증 이력에서 AI가 선택</Text>
        </View>
      </View>

      {/* 검증된 이력 — 점수·단계·통계 요약 */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>검증된 이력</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.greenInk, backgroundColor: colors.greenTint, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 9, overflow: 'hidden', ...T.num }}>{vals.score}점</Text>
            <Text style={{ fontSize: 11.5, fontWeight: '600', color: vals.stageColor, backgroundColor: vals.stageBg, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 9, overflow: 'hidden' }}>{vals.stage}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          <Stat value={`${vals.verified.count}`} unit="건" label="검증 완료" />
          <Stat value={`${vals.verified.streak_months}`} unit="개월" label="연속 확인" borderLeft />
          <Stat value={`${vals.verified.span_months}`} unit="개월" label="활동 범위" flex={1.2} borderLeft />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 }}>
          {[0, 1, 2].map((i) => <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= ['잠정', '준검증', '확정'].indexOf(vals.stage) ? colors.green : colors.line }} />)}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.faint2 }}>잠정</Text>
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.faint2 }}>준검증</Text>
          <Text style={{ fontSize: 11, fontWeight: '500', color: vals.stage === '확정' ? colors.green : colors.faint2 }}>확정</Text>
        </View>
      </Card>

      {/* 쌓인 검증 일감 — 이 화면의 주인공 */}
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sub, marginHorizontal: 4, marginTop: 2, marginBottom: -2 }}>
        최근 검증 일감 {vals.verified.recent.length}건 · 전체 {vals.verified.count}건
      </Text>

      {vals.verified.recent.map((job, index) => {
        const key = job.counterparty.includes('커머스') ? 'commerce' : job.counterparty.includes('스튜디오') ? 'studio' : null;
        const row = <JobRow
          badge={job.counterparty.replace(/[△○㈜]/g, '').slice(0, 1) || '일'}
          badgeBg={index % 2 ? colors.orangeTint : colors.indigoTint}
          badgeColor={index % 2 ? colors.orange : colors.indigo}
          title={`${job.counterparty} · ${job.memo}`}
          sub={`${job.date.slice(0, 7).replace('-', '.')} 정산 · 연결 자료 확인`}
          amount={`₩${Math.round(job.amount).toLocaleString('en-US')}`}
          verified
        />;
        return key ? <Pressable key={job.id} onPress={() => actions.openJob(key)}>{row}</Pressable> : <View key={job.id}>{row}</View>;
      })}
      <Pressable onPress={() => actions.openJob('personal')}>
        <JobRow badge="개" badgeBg={colors.line} badgeColor={colors.sub2} title="개인 프로젝트 · 오픈소스" sub="2024.11~ 진행중" right="미정산" rightSub="자기보고" />
      </Pressable>

      {/* CTA */}
      <Pressable onPress={() => actions.pushScr('careerSync')} style={{ backgroundColor: colors.green, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: colors.green, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } }}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>흩어진 이력 모으기</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,.82)', fontWeight: '400' }}>입금·세금·인증서를 한 번에 연동하고 상품까지</Text>
        </View>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,.18)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={20} color="#fff" sw={2.2} />
        </View>
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
