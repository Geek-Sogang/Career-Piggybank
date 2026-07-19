import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { getEnvelopeBalances } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { CareerPiggybank } from '@/components/CareerPiggybank';
import { Card, Mascot, T } from '@/components/ui';
import { CAREER_SCORE_VALUES, useApp } from '@/store';

// 홈 = 4블록: 저금통(브랜드) → 내 봉투(돈) → 4갈래 진입 → 오늘의 미션(행동).
// 미래 소득 차트는 홈에서 빼고 퀵액션 → Retirement 화면이 담당한다.
export function Home() {
  const { vals, actions, sheet } = useApp();
  // 봉투 잔액 — 홈의 첫 질문 "내 돈 지금 어때"의 답. 시트가 닫힐 때 재조회(배분·페이싱이 잔액을 움직인 직후)
  const [env, setEnv] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!sheet) getEnvelopeBalances().then((r) => setEnv(r.balances)).catch(() => {});
  }, [sheet]);

  const nextTask = !vals.conn.hometax
    ? {
      title: `흩어진 이력 모으고 +${CAREER_SCORE_VALUES.hometax}점 받기`,
      sub: '입금·세금·인증서 연동 · 미션 경험치 +30 XP',
      onPress: () => actions.openCareerSync(),
    }
    : {
      title: '이번 달 입금 봉투에 나눠 담기',
      sub: '페르소나 맞춤 배분 · +25 XP',
      onPress: () => actions.openAllocFlow('connect'),   // 시나리오 [10] 풀플로우(연결→페르소나→배분)
    };

  const envTotal = env ? Object.values(env).reduce((a, b) => a + Math.max(0, b), 0) : 0;
  const ENV_META: { key: string; label: string; color: string }[] = [
    { key: 'tax', label: '세금', color: colors.tax },
    { key: 'expense', label: '경비', color: colors.expense },
    { key: 'spendable', label: '즉시가용', color: colors.spendable },
    { key: 'buffer', label: '여윳돈', color: colors.buffer },
  ];

  return (
    <View style={{ gap: 14 }}>
      {/* 저금통 히어로 — 하나 초록(브랜드 첫 카드의 색), 상세는 미션 탭 */}
      <Pressable onPress={() => actions.pushScr('missions')}>
        <CareerPiggybank
          piggybank={vals.piggybank}
          compact
          trust={{ score: vals.score, stage: vals.stage, onPress: () => actions.openCareerSync() }}
        />
      </Pressable>

      {/* 머니 히어로 — 홈의 첫 질문 "지금 쓸 수 있는 돈". 봉투 상태 요약, 탭 = 정산 */}
      {env && (
        <Pressable onPress={() => actions.nav('ledger')}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sub }}>내 봉투</Text>
              <Icon name="chevronRight" size={18} color={colors.chev} sw={2.2} />
            </View>
            <Text style={{ fontSize: 12, color: colors.sub2, fontWeight: '600', marginTop: 10 }}>지금 쓸 수 있는 돈</Text>
            <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: -0.8, color: colors.ink, marginTop: 2, ...T.num }}>
              ₩{Math.round(env.spendable ?? 0).toLocaleString('en-US')}
            </Text>
            {envTotal > 0 && (
              <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2, marginTop: 12 }}>
                {ENV_META.map((m) => {
                  const w = Math.max(0, env[m.key] ?? 0) / envTotal;
                  return w > 0.005 ? <View key={m.key} style={{ flex: w, backgroundColor: m.color }} /> : null;
                })}
              </View>
            )}
            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              {ENV_META.filter((m) => m.key !== 'spendable').map((m, i) => (
                <View key={m.key} style={{ flex: 1, borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.line, paddingLeft: i ? 14 : 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: m.color }} />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.sub2 }}>{m.label}</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink, marginTop: 3, ...T.num }}>
                    ₩{Math.round(env[m.key] ?? 0).toLocaleString('en-US')}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
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
