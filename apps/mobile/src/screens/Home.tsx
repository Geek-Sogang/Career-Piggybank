import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { getEnvelopeBalances } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { AutoEnvelopeSummary } from '@/components/AutoEnvelopeSummary';
import { CareerPiggybank } from '@/components/CareerPiggybank';
import { Card, Mascot } from '@/components/ui';
import { useApp } from '@/store';

// 홈 = 4블록: 저금통(브랜드) → 내 봉투(돈) → 4갈래 진입 → 오늘의 미션(행동).
// 미래 소득 차트는 홈에서 빼고 퀵액션 → Retirement 화면이 담당한다.
export function Home() {
  const { vals, actions, sheet } = useApp();
  // 봉투 잔액 — 홈의 첫 질문 "내 돈 지금 어때"의 답. 시트가 닫힐 때 재조회(배분·페이싱이 잔액을 움직인 직후)
  const [env, setEnv] = useState<Awaited<ReturnType<typeof getEnvelopeBalances>> | null>(null);
  useEffect(() => {
    if (!sheet) getEnvelopeBalances().then(setEnv).catch(() => {});
  }, [sheet]);

  // 오늘의 미션 요약 — 카드 탭 = 미션창. (배분 풀플로우는 가계부 입금 카드·온보딩이 담당)
  const waiting = vals.piggybank.daily_missions.filter((m) => m.available && !m.completed);
  const nextTask = waiting.length > 0
    ? {
      title: waiting[0].title,
      sub: `${vals.piggybank.phase.label} · 대기 미션 ${waiting.length}개`,
      onPress: () => actions.nav('missions'),
    }
    : {
      title: '오늘 미션을 모두 마쳤어요',
      sub: '미션 탭에서 성장 로드맵을 확인해 보세요',
      onPress: () => actions.nav('missions'),
    };

  return (
    <View style={{ gap: 14 }}>
      {/* 저금통 히어로 — 하나 초록(브랜드 첫 카드의 색), 상세는 미션 탭 */}
      <Pressable onPress={() => actions.nav('missions')}>
        <CareerPiggybank
          piggybank={vals.piggybank}
          compact
          trust={{ score: vals.score, stage: vals.stage, onPress: () => actions.openCareerSync() }}
        />
      </Pressable>

      {/* 머니 히어로 — 홈의 첫 질문 "지금 쓸 수 있는 돈". 봉투 상태 요약, 탭 = 정산 */}
      {env && (
        <Pressable onPress={() => actions.nav('ledger')}>
          <AutoEnvelopeSummary data={env} />
        </Pressable>
      )}

      {/* 4갈래 진입 — 미래 소득은 카드 대신 여기서 분리 진입 */}
      <Card p={6} style={{ flexDirection: 'row' }}>
        <Quick icon="download" tint={colors.greenTint} color={colors.green} title="이력 연동" sub="입금·세금·인증" onPress={() => actions.openCareerSync()} />
        <Divider />
        <Quick icon="trending" tint={colors.bufferTint} color={colors.buffer} title="정산 관리" sub="세금·경비" onPress={() => actions.nav('ledger')} />
        <Divider />
        <Quick icon="cardPig" tint={colors.pinkTint} color={colors.pinkStrong} title="금융 연결" sub="검증 상품" onPress={() => actions.pushScr('products')} />
        <Divider />
        <Quick icon="houseSmall" tint={colors.indigoTint} color={colors.indigo} title="미래 소득" sub="은퇴 예측" onPress={() => actions.nav('future')} />
      </Card>

      {/* 오늘의 미션 — 홈은 최우선 1개만 (전체는 미션 탭) */}
      <Pressable onPress={nextTask.onPress}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }} p={16}>
          <Mascot head size={44} radius={13} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.green, letterSpacing: 0.2 }}>오늘의 미션</Text>
            <Text style={{ fontSize: 14.5, fontWeight: '700', marginTop: 3, color: colors.ink }}>{nextTask.title}</Text>
            <Text style={{ fontSize: 12, color: colors.sub2, marginTop: 2, fontWeight: '400' }}>{nextTask.sub}</Text>
          </View>
          <Icon name="chevronRight" size={20} color={colors.chev} sw={2.2} />
        </Card>
      </Pressable>
    </View>
  );
}

function Quick({ icon, tint, color, title, sub, onPress }: { icon: 'download' | 'trending' | 'cardPig' | 'houseSmall'; tint: string; color: string; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center', gap: 7, paddingVertical: 14, paddingHorizontal: 2 }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={21} color={color} />
      </View>
      <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.ink }}>{title}</Text>
      <Text style={{ fontSize: 10, color: colors.sub2, fontWeight: '400' }}>{sub}</Text>
    </Pressable>
  );
}
const Divider = () => <View style={{ width: 1, backgroundColor: colors.line, marginVertical: 14 }} />;
