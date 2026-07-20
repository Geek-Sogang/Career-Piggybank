import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { fetchStrength } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card, Mascot, Stat, T } from '@/components/ui';
import { CharacterImage, characterRender } from '@/components/CharacterImage';
import { CareerSourceIcon } from '@/components/CareerSourceIcon';
import { MY_JOB, skinKeyFor } from '@/components/CareerPiggybank';
import { usePersonalizationV2 } from '@/lib/personalization';
import { useApp } from '@/store';

// 서버/LLM 미가동 시 오프라인 폴백 문구
const OFFLINE_STRENGTH = '"꾸준한 React 커밋과 정시 정산 — 신뢰도 높은 프론트엔드 개발자"';

// 커리어 탭 — 신뢰 층 전용: 검증된 일감이 쌓인 것을 보여주는 화면.
// 게임 층(저금통·미션·XP)은 미션 탭이, 돈(목표 봉투·페이싱)은 정산 탭이 담당한다.
export function Piggy() {
  const { actions, vals, careerReviewPending } = useApp();
  const [strength, setStrength] = useState(OFFLINE_STRENGTH);
  const [vaultOpen, setVaultOpen] = useState(false);
  const v2 = usePersonalizationV2();
  const vaultSkin = skinKeyFor(v2);
  const vaultRender = characterRender(vaultSkin, MY_JOB, true) != null;
  useEffect(() => {
    if (careerReviewPending) return;
    fetchStrength({
      verified_count: vals.verified.count,
      months_active: vals.verified.streak_months,
      repeat_client_rate: 0,
      settlement_growth: 0,
      top_skill: vals.verified.recent[0]?.memo || '개발',
    })
      .then((s) => setStrength(`"${s.line}"`)) // 결정론 후보 원문 — AI는 선택만 했음
      .catch(() => {});
  }, [careerReviewPending, vals.verified.count, vals.verified.streak_months, vals.verified.recent]);
  useEffect(() => {
    if (careerReviewPending) setVaultOpen(false);
  }, [careerReviewPending]);
  return (
    <View style={{ gap: 14 }}>
      {careerReviewPending && (
        <View style={{ borderWidth: 1.5, borderColor: colors.greenLine, backgroundColor: colors.greenTint2, borderRadius: 18, padding: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.green }}>이력 확인</Text>
          <Text style={{ fontSize: 19, fontWeight: '800', letterSpacing: -0.5, lineHeight: 26, color: colors.ink, marginTop: 4 }}>
            방금 모은 기록들이 맞나요?
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '400', lineHeight: 18, color: colors.sub2, marginTop: 5 }}>
            아래 저금통을 열어 정산처와 작업 내용을 확인해 주세요. 확인하기 전에는 페르소나를 만들지 않아요.
          </Text>
        </View>
      )}

      {/* AI 강점 — 검증 이력에서 AI가 고른 한 줄. 이 탭의 첫인상 = "AI가 요약한 나" */}
      {!careerReviewPending && (
        <View style={{ backgroundColor: colors.greenTint2, borderWidth: 1, borderColor: colors.greenLine, borderRadius: 18, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <Mascot head size={40} radius={12} style={{ backgroundColor: '#fff' }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.green, letterSpacing: 0.2 }}>AI가 본 내 강점</Text>
            <Text style={{ fontSize: 14.5, fontWeight: '700', lineHeight: 21, marginTop: 5, color: colors.ink }}>{strength}</Text>
            <Text style={{ fontSize: 11, color: '#7C9594', marginTop: 6, fontWeight: '600' }}>자기보고 아님 · 검증 이력에서 AI가 선택</Text>
          </View>
        </View>
      )}

      {/* 검증 저금통 — 검증된 일감이 담기는 금고. 탭하면 담긴 일감이 펼쳐진다 (PiggybankRedesign) */}
      <View style={{ borderRadius: 20, backgroundColor: colors.green, overflow: 'hidden', shadowColor: colors.green, shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }}>
        <Pressable onPress={() => setVaultOpen((o) => !o)}>
          <View style={{ paddingTop: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.3 }}>검증 저금통</Text>
              <Text style={{ fontSize: 10.5, fontWeight: '600', color: 'rgba(255,255,255,.82)', marginTop: 1 }}>검증된 일감이 차곡차곡 담겨요</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.green, backgroundColor: '#fff', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 9, overflow: 'hidden', ...T.num }}>{vals.score}점</Text>
              <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#fff', backgroundColor: 'rgba(255,255,255,.2)', paddingVertical: 3, paddingHorizontal: 9, borderRadius: 8, overflow: 'hidden' }}>{vals.stage}</Text>
            </View>
          </View>
          <View style={{ height: 172, alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 }}>
            {/* 밝은 원형 무대 — 컷아웃 에셋의 흰 잔영을 진한 그린 위에서 흡수한다 */}
            <View style={{ position: 'absolute', bottom: 2, width: 200, height: 168, borderRadius: 100, backgroundColor: 'rgba(255,255,255,.18)' }} />
            <View style={{ position: 'absolute', bottom: 14, width: 150, height: 18, borderRadius: 999, backgroundColor: 'rgba(0,0,0,.18)' }} />
            {vaultRender ? (
              <CharacterImage cutout skin={vaultSkin} job={MY_JOB} width={168} height={168} />
            ) : (
              <Mascot head size={120} radius={34} style={{ marginBottom: 10 }} />
            )}
          </View>
        </Pressable>
        <View style={{ backgroundColor: '#fff', padding: 18 }}>
          <View style={{ flexDirection: 'row' }}>
            <Stat value={`${vals.verified.count}`} unit="건" label="담긴 검증" />
            <Stat value={`${vals.verified.streak_months}`} unit="개월" label="연속 확인" borderLeft />
            <Stat value={`${vals.verified.span_months}`} unit="개월" label="활동 범위" flex={1.2} borderLeft />
          </View>
          <Pressable onPress={() => setVaultOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, backgroundColor: colors.greenTint2, borderWidth: 1, borderColor: colors.greenLine, borderRadius: 12, paddingVertical: 11 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.greenInk }}>{vaultOpen ? '담긴 일감 접기' : '저금통 열어 담긴 일감 보기'}</Text>
            <View style={{ transform: [{ rotate: vaultOpen ? '270deg' : '90deg' }] }}>
              <Icon name="chevronRight" size={15} color={colors.greenInk} sw={2.4} />
            </View>
          </Pressable>
          {vaultOpen && (
            <View style={{ marginTop: 10, gap: 8 }}>
              {vals.verified.recent.map((job) => {
                const key = job.counterparty.includes('커머스') ? 'commerce' : job.counterparty.includes('스튜디오') ? 'studio' : null;
                const row = <JobRow
                  counterparty={job.counterparty}
                  title={`${job.counterparty} · ${job.memo}`}
                  sub={`${job.date.slice(0, 7).replace('-', '.')} 정산 · 연결 자료 확인`}
                  amount={`₩${Math.round(job.amount).toLocaleString('en-US')}`}
                  verified
                />;
                return key ? <Pressable key={job.id} onPress={() => actions.openJob(key)}>{row}</Pressable> : <View key={job.id}>{row}</View>;
              })}
              <Pressable onPress={() => actions.openJob('personal')}>
                <JobRow counterparty="개인 프로젝트" title="개인 프로젝트 · 오픈소스" sub="2024.11~ 진행중" right="미정산" rightSub="자기보고" />
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {careerReviewPending && (
        <Pressable
          onPress={actions.confirmCareerHistory}
          style={{ borderRadius: 16, backgroundColor: colors.green, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', shadowColor: colors.green, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 7 } }}
        >
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>네, 이 기록들이 맞아요</Text>
        </Pressable>
      )}

      {/* CTA */}
      {!careerReviewPending && <Pressable onPress={() => actions.openCareerSync()} style={{ backgroundColor: colors.green, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: colors.green, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } }}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>흩어진 이력 모으기</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,.82)', fontWeight: '400' }}>입금·세금·인증서를 한 번에 연동하고 상품까지</Text>
        </View>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,.18)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={20} color="#fff" sw={2.2} />
        </View>
      </Pressable>}
    </View>
  );
}

function JobRow({ counterparty, title, sub, amount, verified, right, rightSub }: { counterparty: string; title: string; sub: string; amount?: string; verified?: boolean; right?: string; rightSub?: string }) {
  return (
    <Card p={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16 }}>
      <CareerSourceIcon counterparty={counterparty} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{title}</Text>
        <Text style={{ fontSize: 12, color: colors.sub2, marginTop: 2, fontWeight: '500' }}>{sub}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: amount ? 14.5 : 13, fontWeight: amount ? '800' : '700', color: amount ? colors.ink : colors.sub3, ...T.num }}>{amount || right}</Text>
        <Text style={{ fontSize: 11, fontWeight: '700', color: verified ? colors.green : colors.faint, marginTop: 3 }}>{verified ? '검증 ✓' : rightSub}</Text>
      </View>
    </Card>
  );
}
