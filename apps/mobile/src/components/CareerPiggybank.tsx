import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { getPersonalizationV2, type CareerVerification, type PersonalizationV2 } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card, Mascot, T } from '@/components/ui';

type Piggybank = CareerVerification['piggybank'];

const SKINS = {
  default: { label: '기본 저금통', tint: colors.pinkTint, ink: colors.pinkInk },
  sturdy: { label: '든든 저금통', tint: colors.greenTint, ink: colors.green },
  growing: { label: '무럭 저금통', tint: '#FFF6DD', ink: '#B7791F' },
  wave: { label: '물결 저금통', tint: colors.bufferTint, ink: colors.buffer },
  sparkle: { label: '반짝 저금통', tint: colors.indigoTint, ink: colors.indigo },
} as const;

function skinFor(v2: PersonalizationV2 | null) {
  if (!v2) return SKINS.default;
  const safety = v2.financial_response.find((decision) => decision.key === 'safety_fund_strategy');
  if (!safety || safety.decision_status !== 'confirmed') return SKINS.default;
  if (safety.level === '확보 우선') return SKINS.sturdy;
  if (safety.level === '활용 우선') return v2.effective_management === '자율' ? SKINS.sparkle : SKINS.growing;
  return SKINS.wave;
}

export function CareerPiggybank({ piggybank, compact = false }: { piggybank: Piggybank; compact?: boolean }) {
  const [v2, setV2] = useState<PersonalizationV2 | null>(null);
  useEffect(() => {
    if (compact) return;
    getPersonalizationV2().then(setV2).catch(() => {});
  }, [compact]);
  const skin = skinFor(v2);
  const next = piggybank.levels.find((level) => level.level === piggybank.level + 1) ?? null;

  return (
    <Card p={compact ? 16 : 18} style={{ backgroundColor: '#FCFEFD', borderColor: colors.greenLine }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <PiggyHero skin={skin} level={piggybank.level} compact={compact} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.green }}>커리어 저금통</Text>
            <Text style={{ fontSize: 9.5, fontWeight: '700', color: skin.ink, backgroundColor: skin.tint, paddingVertical: 3, paddingHorizontal: 6, borderRadius: 7, overflow: 'hidden' }}>
              Lv.{piggybank.level}
            </Text>
          </View>
          <Text style={{ fontSize: compact ? 18 : 21, fontWeight: '800', letterSpacing: -0.5, color: colors.ink, marginTop: 3 }}>
            {piggybank.level_title}
          </Text>
          <Text style={{ fontSize: 11, fontWeight: '400', color: colors.sub2, marginTop: 3 }}>
            검증된 일감과 미션으로 동전을 모아요
          </Text>
          <View style={{ height: 9, borderRadius: 5, backgroundColor: '#E9ECEF', overflow: 'hidden', marginTop: 11 }}>
            <View style={{ width: `${piggybank.progress * 100}%`, height: 9, borderRadius: 5, backgroundColor: skin.ink }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: skin.ink, ...T.num }}>{piggybank.xp.toLocaleString()} XP</Text>
            <Text style={{ fontSize: 10.5, fontWeight: '400', color: colors.sub2 }}>
              {next ? `다음 성장까지 ${piggybank.xp_to_next} XP` : '최고 레벨 달성'}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', marginTop: 15, borderRadius: 12, backgroundColor: colors.greenTint2, paddingVertical: 9 }}>
        <XpStat value={`+${piggybank.work_xp}`} label="검증 일감 XP" />
        <XpStat value={`+${piggybank.mission_xp}`} label="미션 XP" borderLeft />
        <XpStat value={`${piggybank.completed_missions}`} label="완료 미션" borderLeft />
      </View>

      {!compact && (
        <>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink, marginTop: 20 }}>성장 로드맵</Text>
          <Text style={{ fontSize: 10.5, fontWeight: '400', color: colors.sub2, marginTop: 3 }}>
            발판 체크가 아니라, 쌓인 경험치가 레벨을 열어요
          </Text>
          <Roadmap piggybank={piggybank} skin={skin} />
          {next && (
            <View style={{ backgroundColor: skin.tint, borderRadius: 13, padding: 12, marginTop: 14 }}>
              <Text style={{ fontSize: 10.5, fontWeight: '600', color: skin.ink }}>Lv.{next.level}에서 열리는 혜택 예시</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 3 }}>{next.reward}</Text>
              <Text style={{ fontSize: 10, fontWeight: '400', color: colors.sub3, marginTop: 5 }}>
                실제 제공은 하나금융 프로모션 조건 확인 후 확정돼요
              </Text>
            </View>
          )}
          <MissionList missions={piggybank.missions} />
        </>
      )}
    </Card>
  );
}

function PiggyHero({ skin, level, compact }: {
  skin: (typeof SKINS)[keyof typeof SKINS]; level: number; compact: boolean;
}) {
  const size = compact ? 68 : 82;
  return (
    <View style={{ width: size, height: size, borderRadius: compact ? 22 : 26, backgroundColor: skin.tint, alignItems: 'center', justifyContent: 'center' }}>
      <Mascot head size={compact ? 58 : 70} radius={compact ? 19 : 23} />
      <View style={{ position: 'absolute', top: 7, width: 27, height: 7, borderRadius: 4, backgroundColor: skin.ink }} />
      <View style={{ position: 'absolute', top: -7, right: -6, width: 25, height: 25, borderRadius: 13, backgroundColor: '#FFD85A', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 9, fontWeight: '800', color: '#8A6500' }}>{level}</Text>
      </View>
    </View>
  );
}

function XpStat({ value, label, borderLeft }: { value: string; label: string; borderLeft?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: borderLeft ? 1 : 0, borderLeftColor: colors.greenLine }}>
      <Text style={{ fontSize: 14, fontWeight: '800', color: colors.green, ...T.num }}>{value}</Text>
      <Text style={{ fontSize: 9.5, fontWeight: '400', color: colors.sub2, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Roadmap({ piggybank, skin }: {
  piggybank: Piggybank; skin: (typeof SKINS)[keyof typeof SKINS];
}) {
  const rows = [
    piggybank.levels.slice(0, 3),
    [...piggybank.levels.slice(3, 6)].reverse(),
    piggybank.levels.slice(6, 9),
    piggybank.levels.slice(9, 10),
  ];
  return (
    <View style={{ marginTop: 15, gap: 19 }}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={{ position: 'relative', flexDirection: 'row', justifyContent: row.length === 1 ? 'flex-end' : 'space-between', paddingHorizontal: 4 }}>
          {row.map((level, itemIndex) => {
            const reached = level.level <= piggybank.level;
            const current = level.level === piggybank.level;
            return (
              <View key={level.level} style={{ width: '29%', alignItems: 'center' }}>
                <View style={{
                  width: current ? 61 : 52, height: current ? 61 : 52, borderRadius: 31,
                  backgroundColor: reached ? (current ? skin.tint : colors.greenTint) : '#F4F5F7',
                  borderWidth: current ? 3 : 1.5,
                  borderColor: current ? skin.ink : reached ? colors.greenLine : '#E2E5E9',
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: current ? skin.ink : '#000', shadowOpacity: current ? 0.18 : 0,
                  shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
                }}>
                  {current ? (
                    <Mascot head size={48} radius={24} />
                  ) : reached ? (
                    <Icon name={level.node_type === 'reward' ? 'coin' : 'check'} size={22} color={colors.green} sw={2.3} />
                  ) : (
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.faint }}>Lv.{level.level}</Text>
                  )}
                  {current && <View style={{ position: 'absolute', top: 3, width: 19, height: 5, borderRadius: 3, backgroundColor: skin.ink }} />}
                </View>
                <Text style={{ fontSize: 10.5, fontWeight: current ? '800' : '600', color: current ? colors.ink : reached ? colors.greenInk : colors.sub3, textAlign: 'center', marginTop: 6, lineHeight: 14 }}>
                  {level.title}
                </Text>
                <Text style={{ fontSize: 9, fontWeight: '400', color: colors.sub3, marginTop: 1, ...T.num }}>{level.threshold} XP</Text>
                {itemIndex < row.length - 1 && (
                  <View style={{ position: 'absolute', left: '80%', top: current ? 29 : 25, width: '62%', height: 3, borderRadius: 2, backgroundColor: level.level < piggybank.level ? colors.greenLine : colors.line }} />
                )}
              </View>
            );
          })}
          {rowIndex < rows.length - 1 && (
            <View style={{
              position: 'absolute', bottom: -21, width: 3, height: 24, borderRadius: 2,
              right: rowIndex % 2 === 0 ? 30 : undefined,
              left: rowIndex % 2 === 1 ? 30 : undefined,
              backgroundColor: colors.line,
            }} />
          )}
        </View>
      ))}
    </View>
  );
}

function MissionList({ missions }: { missions: Piggybank['missions'] }) {
  const ordered = [...missions].sort((a, b) => Number(a.completed) - Number(b.completed));
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>XP 미션</Text>
      <View style={{ marginTop: 8, gap: 7 }}>
        {ordered.slice(0, 5).map((mission) => (
          <View key={mission.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 11, backgroundColor: mission.completed ? colors.greenTint2 : '#F7F8FA', paddingVertical: 9, paddingHorizontal: 10 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: mission.completed ? colors.green : '#E2E5E9', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={mission.completed ? 'check' : 'coin'} size={14} color={mission.completed ? '#fff' : colors.sub3} sw={2.2} />
            </View>
            <Text style={{ flex: 1, fontSize: 11.5, fontWeight: mission.completed ? '500' : '700', color: mission.completed ? colors.sub2 : colors.ink }}>{mission.title}</Text>
            <Text style={{ fontSize: 10.5, fontWeight: '800', color: mission.completed ? colors.sub3 : colors.green }}>+{mission.xp} XP</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
