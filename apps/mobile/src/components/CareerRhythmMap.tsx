import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { getPersonalizationV2, type PersonalizationV2, type CareerVerification } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card, Mascot } from '@/components/ui';

type Journey = CareerVerification['journey'];

const SKINS = {
  default: { label: '기본 저금통', tint: colors.pinkTint, ink: colors.pinkInk },
  sturdy: { label: '든든 저금통', tint: colors.greenTint, ink: colors.green },
  growing: { label: '무럭 저금통', tint: '#FFF6DD', ink: '#B7791F' },
  wave: { label: '물결 저금통', tint: colors.bufferTint, ink: colors.buffer },
  sparkle: { label: '반짝 저금통', tint: colors.indigoTint, ink: colors.indigo },
} as const;

function skinFor(v2: PersonalizationV2 | null) {
  if (!v2) return SKINS.default;
  const safety = v2.financial_response.find((d) => d.key === 'safety_fund_strategy');
  if (!safety || safety.decision_status !== 'confirmed') return SKINS.default;
  if (safety.level === '확보 우선') return SKINS.sturdy;
  if (safety.level === '활용 우선') return v2.effective_management === '자율' ? SKINS.sparkle : SKINS.growing;
  return SKINS.wave;
}

/**
 * 검증 신뢰와 정산 습관을 같은 여정에서 보되, 노드 색과 라벨로 출처를 분리한다.
 * 캐릭터 스킨은 표시만 바꾸며 점수·보상·상품 조건에는 영향을 주지 않는다.
 */
export function CareerRhythmMap({ journey, compact = false }: { journey: Journey; compact?: boolean }) {
  const [v2, setV2] = useState<PersonalizationV2 | null>(null);
  useEffect(() => {
    if (compact) return;
    getPersonalizationV2().then(setV2).catch(() => {});
  }, [compact]);
  const skin = skinFor(v2);
  const nodes = Array.from({ length: journey.total_steps }, (_, i) => i);

  return (
    <Card p={compact ? 15 : 18} style={{ backgroundColor: '#FCFEFD', borderColor: colors.greenLine }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.green }}>소득리듬 맵</Text>
          <Text style={{ fontSize: compact ? 16 : 18, fontWeight: '800', letterSpacing: -0.4, color: colors.ink, marginTop: 3 }}>
            내 정산 리듬으로 {journey.step}번째 발판
          </Text>
          <Text style={{ fontSize: 11.5, fontWeight: '400', lineHeight: 17, color: colors.sub2, marginTop: 3 }}>
            달력 출석이 아니라 확인된 일과 입금 사건으로만 전진해요
          </Text>
        </View>
        {!compact ? (
          <View style={{ alignItems: 'center', gap: 3 }}>
            <View style={{ width: 50, height: 50, borderRadius: 17, backgroundColor: skin.tint, alignItems: 'center', justifyContent: 'center' }}>
              <Mascot head size={42} radius={14} />
              <View style={{ position: 'absolute', top: -4, width: 17, height: 6, borderRadius: 3, backgroundColor: skin.ink }} />
            </View>
            <Text style={{ fontSize: 9.5, fontWeight: '600', color: skin.ink }}>{skin.label}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: compact ? 17 : 21 }}>
        {nodes.map((i) => {
          const reached = i < journey.step;
          const isCurrent = i === journey.step - 1;
          const kind = i === 0 ? 'trust' : journey.completed_kinds[i - 1];
          const color = kind === 'income_rhythm' ? colors.buffer : colors.green;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ height: compact ? 0 : 27, justifyContent: 'flex-end' }}>
                {!compact && isCurrent ? <Mascot head size={26} radius={9} /> : null}
              </View>
              <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center' }}>
                {i > 0 ? <View style={{ flex: 1, height: 3, backgroundColor: reached ? color : colors.line }} /> : <View style={{ flex: 1 }} />}
                <View style={{
                  width: isCurrent ? 30 : 24, height: isCurrent ? 30 : 24, borderRadius: 15,
                  backgroundColor: reached ? color : '#fff', borderWidth: reached ? 0 : 2,
                  borderColor: colors.dash, alignItems: 'center', justifyContent: 'center',
                  shadowColor: isCurrent ? colors.pinkStrong : '#000', shadowOpacity: isCurrent ? 0.24 : 0,
                  shadowRadius: 7, shadowOffset: { width: 0, height: 3 },
                }}>
                  {reached ? <Icon name={i === 0 ? 'shieldCheck' : 'coin'} size={isCurrent ? 16 : 13} color="#fff" sw={2.2} /> : <Text style={{ fontSize: 10, fontWeight: '600', color: colors.faint }}>{i + 1}</Text>}
                </View>
                {i < nodes.length - 1 ? <View style={{ flex: 1, height: 3, backgroundColor: i < journey.step - 1 ? color : colors.line }} /> : <View style={{ flex: 1 }} />}
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 13 }}>
        <Text style={{ fontSize: 10.5, fontWeight: '500', color: colors.green, backgroundColor: colors.greenTint, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden' }}>
          검증 연결 {journey.trust_events}곳
        </Text>
        <Text style={{ fontSize: 10.5, fontWeight: '500', color: colors.buffer, backgroundColor: colors.bufferTint, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden' }}>
          정산 확인 {journey.confirmed_income_events}회
        </Text>
      </View>

      {!compact ? (
        <View style={{ backgroundColor: skin.tint, borderRadius: 13, padding: 12, marginTop: 13 }}>
          <Text style={{ fontSize: 10.5, fontWeight: '600', color: skin.ink }}>다음 발판 · 혜택 예시</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 3 }}>{journey.next_reward ?? '이번 여정 완성'}</Text>
          <Text style={{ fontSize: 11.5, fontWeight: '400', lineHeight: 17, color: colors.sub, marginTop: 3 }}>
            {journey.next_requirement ?? '새 소득 사건이 오면 다음 여정을 이어갈 수 있어요'}
          </Text>
          <Text style={{ fontSize: 10, fontWeight: '400', color: colors.sub3, marginTop: 6 }}>
            보상은 실제 하나금융 프로모션 조건 확인 후 제공돼요
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
