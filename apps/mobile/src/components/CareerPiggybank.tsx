import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type ViewStyle } from 'react-native';
import {
  getCareerScraps, getPersonalizationV2, saveCareerScrap,
  type CareerScrap, type CareerVerification, type PersonalizationV2,
} from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { CharacterImage, characterRender, type CharacterJob } from '@/components/CharacterImage';
import { Card, Mascot, T } from '@/components/ui';

type Piggybank = CareerVerification['piggybank'];

const SKINS = {
  default: { label: '기본 저금통', tint: colors.pinkTint, ink: colors.pinkInk },
  sturdy: { label: '든든 저금통', tint: colors.greenTint, ink: colors.green },
  growing: { label: '무럭 저금통', tint: '#FFF6DD', ink: '#B7791F' },
  wave: { label: '물결 저금통', tint: colors.bufferTint, ink: colors.buffer },
  sparkle: { label: '반짝 저금통', tint: colors.indigoTint, ink: colors.indigo },
} as const;

// 데모 시드(조대흠) = 프리랜스 개발자. career.job 실연동은 후속 — 렌더 선택 구조는 3직군 지원.
const MY_JOB: CharacterJob = 'developer';

function skinKeyFor(v2: PersonalizationV2 | null): keyof typeof SKINS {
  if (!v2) return 'default';
  const safety = v2.financial_response.find((decision) => decision.key === 'safety_fund_strategy');
  if (!safety || safety.decision_status !== 'confirmed') return 'default';
  if (safety.level === '확보 우선') return 'sturdy';
  if (safety.level === '활용 우선') return v2.effective_management === '자율' ? 'sparkle' : 'growing';
  return 'wave';
}

// 또래 저금통 — 합성 또래 풀(백엔드 peer 시드와 같은 세계관)의 구경 목록. 실명 아님.
const PEER_BANKS: { skin: string; job: CharacterJob; name: string; line: string }[] = [
  { skin: 'growing', job: 'designer', name: '일러스트레이터 · 무럭 저금통', line: 'Lv.5 · 목표 봉투 2개 진행 중' },
  { skin: 'sturdy', job: 'developer', name: '백엔드 개발자 · 든든 저금통', line: 'Lv.7 · 방어선 3개월 달성' },
  { skin: 'sparkle', job: 'creator', name: '유튜버 · 반짝 저금통', line: 'Lv.4 · 시즌 미션 진행 중' },
];

export function CareerPiggybank({ piggybank, compact = false, trust, onMissionUpdated, onOpenLedger }: {
  piggybank: Piggybank;
  compact?: boolean;
  /** 신뢰 층 요약 칩 — 홈에서 검증 점수·단계를 1줄로. 게임 층(XP)과 어휘·색을 섞지 않는다. */
  trust?: { score: number; stage: string; onPress: () => void };
  onMissionUpdated?: () => void | Promise<unknown>;
  onOpenLedger?: () => void;
}) {
  const [v2, setV2] = useState<PersonalizationV2 | null>(null);
  const [scraps, setScraps] = useState<CareerScrap[]>([]);
  useEffect(() => {
    getPersonalizationV2().then(setV2).catch(() => {});   // compact(홈 배너)도 스킨 렌더에 필요
    if (!compact) getCareerScraps().then(setScraps).catch(() => {});
  }, [compact]);
  const skinKey = skinKeyFor(v2);
  const skin = SKINS[skinKey];
  const myRender = characterRender(skinKey, MY_JOB);   // 기본 스킨은 null → 2D 마스코트 폴백
  const next = piggybank.levels.find((level) => level.level === piggybank.level + 1) ?? null;
  const [open, setOpen] = useState<'roadmap' | 'missions' | 'peers' | 'scraps' | null>(null);
  const toggle = (key: 'roadmap' | 'missions' | 'peers' | 'scraps') => setOpen((cur) => (cur === key ? null : key));

  if (compact) {
    // 홈 메인 배너 — 브랜드의 하나 초록(티일). 홈의 주인공이라 크게 잡는다.
    return (
      <Card p={20} style={{ backgroundColor: colors.green, borderColor: 'transparent', shadowColor: colors.green, shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 13 } }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          {myRender ? (
            <CharacterImage skin={skinKey} job={MY_JOB} width={88} height={88} radius={22} />
          ) : (
            <PiggyHero skin={skin} level={piggybank.level} size={88} />
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: 'rgba(255,255,255,.88)' }}>커리어 저금통</Text>
              <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.green, backgroundColor: '#fff', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden' }}>
                Lv.{piggybank.level}
              </Text>
            </View>
            <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: -0.6, color: '#fff', marginTop: 4 }}>
              {piggybank.level_title}
            </Text>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,.3)', overflow: 'hidden', marginTop: 13 }}>
              <View style={{ width: `${piggybank.progress * 100}%`, height: 10, borderRadius: 5, backgroundColor: '#fff' }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 }}>
              <Text style={{ fontSize: 11.5, fontWeight: '600', color: 'rgba(255,255,255,.88)' }}>
                {next ? `다음 성장까지 ${piggybank.xp_to_next} XP` : '최고 레벨 달성'}
              </Text>
            </View>
          </View>
        </View>
        {trust && (
          <Pressable
            onPress={trust.onPress}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 12, backgroundColor: '#fff', borderRadius: 9, paddingVertical: 6, paddingHorizontal: 10 }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.greenInk }}>검증 {trust.score}점 · {trust.stage}</Text>
            <Icon name="chevronRight" size={12} color={colors.greenInk} sw={2.4} />
          </Pressable>
        )}
      </Card>
    );
  }

  // 풀 모드 — 무대(주인공 1) + 오늘의 미션 + 다음 혜택. 나머지 상세는 전부 접힘으로.
  const doneMissions = piggybank.missions.filter((mission) => mission.completed).length;
  return (
    <View style={{ gap: 14 }}>
      {/* Zone 1 · 저금통 무대 — 번 것이 동전이 되어 슬롯으로 들어가고, 레벨만큼 바닥에 쌓인다 */}
      <View style={{ borderRadius: 22, backgroundColor: skin.tint, paddingVertical: 22, paddingHorizontal: 20, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: skin.ink }}>커리어 저금통</Text>
          <Text style={{ fontSize: 10, fontWeight: '800', color: skin.ink, backgroundColor: '#fff', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden' }}>
            Lv.{piggybank.level}
          </Text>
        </View>
        {myRender ? (
          /* 3D 렌더 무대 — 토스 키워봐요의 캐릭터 카드 문법. 렌더 배경(연회색)이 곧 무대다 */
          <View style={{ alignSelf: 'stretch', marginTop: 14, alignItems: 'center' }}>
            <View style={{ position: 'absolute', top: -6, zIndex: 2 }}>
              <Coin size={24} style={{ transform: [{ rotate: '-14deg' }] }} />
            </View>
            <CharacterImage skin={skinKey} job={MY_JOB} width={9999} height={225} radius={20} style={{ width: '100%' }} />
          </View>
        ) : (
          /* 판독 전(기본 스킨) — 2D 마스코트 + 동전 연출 폴백 */
          <View style={{ alignItems: 'center', marginTop: 12 }}>
            <Coin size={24} style={{ marginBottom: -7, zIndex: 2, transform: [{ rotate: '-14deg' }] }} />
            <PiggyHero skin={skin} level={piggybank.level} size={128} />
            <View style={{ flexDirection: 'row', marginTop: -9, zIndex: 2 }}>
              {Array.from({ length: Math.min(piggybank.level, 5) }).map((_, i) => (
                <Coin key={i} size={17} style={i === 0 ? undefined : { marginLeft: -5 }} />
              ))}
            </View>
          </View>
        )}
        <Text style={{ fontSize: 25, fontWeight: '800', letterSpacing: -0.6, color: colors.ink, marginTop: 12 }}>
          {piggybank.level_title}
        </Text>
        <View style={{ alignSelf: 'stretch', height: 9, borderRadius: 5, backgroundColor: 'rgba(255,255,255,.75)', overflow: 'hidden', marginTop: 14 }}>
          <View style={{ width: `${piggybank.progress * 100}%`, height: 9, borderRadius: 5, backgroundColor: skin.ink }} />
        </View>
        <View style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Coin size={13} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: skin.ink, ...T.num }}>모은 동전 {piggybank.xp.toLocaleString()} XP</Text>
          </View>
          <Text style={{ fontSize: 12, fontWeight: '600', color: skin.ink }}>
            {next ? `다음 성장까지 ${piggybank.xp_to_next} XP` : '최고 레벨 달성'}
          </Text>
        </View>
        <Text style={{ fontSize: 11.5, fontWeight: '500', color: skin.ink, opacity: 0.75, marginTop: 10 }}>
          정산을 승인할 때마다 저금통이 새로운 모습으로 자라요
        </Text>
      </View>

      {/* Zone 2 · 오늘의 미션 — 국면 적응형, 최대 3개 */}
      <Card>
        <TodayQuests
          piggybank={piggybank}
          onMissionUpdated={onMissionUpdated}
          onOpenLedger={onOpenLedger}
          onScrapSaved={(scrap) => setScraps((current) => [scrap, ...current])}
        />
      </Card>

      {/* Zone 3 · 다음 성장 혜택 */}
      {next && (
        <Card style={{ backgroundColor: skin.tint, borderColor: 'transparent' }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: skin.ink }}>Lv.{next.level}에서 열리는 혜택 예시</Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink, marginTop: 4 }}>{next.reward}</Text>
          <Text style={{ fontSize: 11, fontWeight: '400', color: colors.sub2, marginTop: 6 }}>
            실제 제공은 하나금융 프로모션 조건 확인 후 확정돼요
          </Text>
        </Card>
      )}

      {/* 상세 접힘 — 로드맵·첫 달성·조각 모음 (검증 기록은 화면의 '검증된 이력' 카드가 담당) */}
      <Card p={0} style={{ paddingHorizontal: 16 }}>
        <FoldRow title="성장 로드맵" meta={`Lv.${piggybank.level} / ${piggybank.levels.length}`} open={open === 'roadmap'} onPress={() => toggle('roadmap')} first>
          <View style={{ flexDirection: 'row', borderRadius: 12, backgroundColor: colors.greenTint2, paddingVertical: 9 }}>
            <XpStat value={`+${piggybank.work_xp}`} label="검증 일감 XP" />
            <XpStat value={`+${piggybank.loop_xp + piggybank.daily_xp}`} label="반복·오늘 XP" borderLeft />
            <XpStat value={`+${piggybank.mission_xp}`} label="첫 달성 XP" borderLeft />
          </View>
          <Roadmap piggybank={piggybank} skin={skin} />
        </FoldRow>
        <FoldRow title="첫 달성 미션" meta={`${doneMissions}/${piggybank.missions.length}`} open={open === 'missions'} onPress={() => toggle('missions')}>
          <MissionList missions={piggybank.missions} />
        </FoldRow>
        <FoldRow title="또래 저금통 구경" meta={`${PEER_BANKS.length}명`} open={open === 'peers'} onPress={() => toggle('peers')}>
          <Text style={{ fontSize: 11, fontWeight: '500', color: colors.sub2, marginTop: -4 }}>
            나와 직군·성향이 비슷한 또래의 저금통이에요 (또래 풀 기준)
          </Text>
          {PEER_BANKS.map((peer) => (
            <View key={peer.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 12, backgroundColor: '#F7F8FA', padding: 10 }}>
              <CharacterImage skin={peer.skin} job={peer.job} width={46} height={46} radius={13} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.ink }}>{peer.name}</Text>
                <Text style={{ fontSize: 11, fontWeight: '500', color: colors.sub2, marginTop: 2 }}>{peer.line}</Text>
              </View>
            </View>
          ))}
        </FoldRow>
        <FoldRow title="커리어 조각 모음" meta={`${scraps.length}개`} open={open === 'scraps'} onPress={() => toggle('scraps')}>
          {scraps.length === 0 ? (
            <View style={{ borderRadius: 10, backgroundColor: '#F7F8FA', padding: 12 }}>
              <Text style={{ fontSize: 11.5, fontWeight: '400', color: colors.sub2 }}>
                아직 모은 조각이 없어요 — 오늘의 미션에서 한 줄 저금해 보세요
              </Text>
            </View>
          ) : (
            scraps.map((scrap) => (
              <View key={scrap.id} style={{ borderRadius: 10, backgroundColor: '#F7F8FA', padding: 11 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.green }}>{formatScrapDate(scrap.created_at)}</Text>
                <Text style={{ fontSize: 12, fontWeight: '500', color: colors.ink, lineHeight: 17, marginTop: 4 }}>{scrap.content}</Text>
              </View>
            ))
          )}
        </FoldRow>
      </Card>
    </View>
  );
}

function TodayQuests({ piggybank, onMissionUpdated, onOpenLedger, onScrapSaved }: {
  piggybank: Piggybank;
  onMissionUpdated?: () => void | Promise<unknown>;
  onOpenLedger?: () => void;
  onScrapSaved?: (scrap: CareerScrap) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [cared, setCared] = useState(false);
  const [scrapText, setScrapText] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const missions = piggybank.daily_missions.filter((mission) => mission.available).slice(0, 3);
  const saveScrap = async () => {
    const content = scrapText.trim();
    if (saving || !content) return;
    setSaving(true);
    try {
      const result = await saveCareerScrap(content);
      onScrapSaved?.(result.scrap);
      setScrapText('');
      setComposerOpen(false);
      await onMissionUpdated?.();
    } catch {} finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink }}>오늘의 미션</Text>
        <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.buffer, backgroundColor: colors.bufferTint, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden' }}>
          {piggybank.phase.label}
        </Text>
      </View>
      <Text style={{ fontSize: 11.5, fontWeight: '400', color: colors.sub2, marginTop: 4 }}>{piggybank.phase.message}</Text>
      <View style={{ marginTop: 10, gap: 8 }}>
        {missions.map((mission) => {
          const done = mission.completed || (mission.id === 'care_piggy' && cared);
          const actionable = mission.id === 'career_scrap' || mission.id === 'today_transactions' || mission.id === 'care_piggy';
          const onPress = mission.id === 'career_scrap'
            ? () => setComposerOpen((current) => !current)
            : mission.id === 'today_transactions'
              ? onOpenLedger
              : () => setCared(true);
          return (
            <Pressable
              key={mission.id}
              disabled={(done && mission.id !== 'career_scrap') || saving || !actionable}
              onPress={onPress}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: done ? colors.greenLine : colors.line, backgroundColor: done ? colors.greenTint2 : '#F8F9FA', paddingVertical: 10, paddingHorizontal: 11 }}
            >
              <View style={{ width: 27, height: 27, borderRadius: 14, backgroundColor: done ? colors.green : '#E6E9EC', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={done ? 'check' : mission.id === 'career_scrap' ? 'ledgerDoc' : 'coin'} size={15} color={done ? '#fff' : colors.sub2} sw={2.1} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 12, fontWeight: done ? '500' : '700', color: done ? colors.sub2 : colors.ink }}>{mission.title}</Text>
                <Text style={{ fontSize: 11, fontWeight: '400', color: colors.sub3, marginTop: 2 }}>{mission.description}</Text>
              </View>
              <Text style={{ fontSize: 10.5, fontWeight: '800', color: done ? colors.sub3 : mission.xp > 0 ? colors.green : colors.sub2 }}>
                {mission.id === 'career_scrap' && done ? '또 저금' : done ? '완료' : mission.xp > 0 ? `+${mission.xp} XP` : '반응 보기'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 조각 저금 입력 — 상시 노출 대신 스크랩 미션을 탭했을 때만 */}
      {composerOpen && (
        <View style={{ marginTop: 10, gap: 7 }}>
          <TextInput
            value={scrapText}
            onChangeText={setScrapText}
            placeholder="예: 결제 화면의 빈 상태를 개선하고 배운 점을 기록했어요"
            placeholderTextColor={colors.sub3}
            multiline
            maxLength={500}
            autoFocus
            style={{ minHeight: 72, borderWidth: 1, borderColor: colors.greenLine, borderRadius: 11, backgroundColor: '#fff', padding: 11, fontSize: 12, fontWeight: '400', lineHeight: 17, color: colors.ink, textAlignVertical: 'top' }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 7 }}>
            <Pressable onPress={() => { setComposerOpen(false); setScrapText(''); }} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.sub2 }}>취소</Text>
            </Pressable>
            <Pressable disabled={scrapText.trim().length < 2 || saving} onPress={saveScrap} style={{ paddingVertical: 8, paddingHorizontal: 13, borderRadius: 9, backgroundColor: scrapText.trim().length >= 2 ? colors.green : colors.line }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>{saving ? '저금 중…' : '저금하기'}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function formatScrapDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

// 접힘 행 — 상세 정보는 요청했을 때만 펼친다 (평평한 적층 대신 위계)
function FoldRow({ title, meta, open, onPress, first, children }: {
  title: string; meta: string; open: boolean; onPress: () => void; first?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={{ borderTopWidth: first ? 0 : 1, borderTopColor: colors.line2 }}>
      <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 15 }}>
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink }}>{title}</Text>
        <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.sub2, ...T.num }}>{meta}</Text>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <Icon name="chevronRight" size={16} color="#C2C7CE" sw={2.2} />
        </View>
      </Pressable>
      {open && <View style={{ paddingBottom: 16, gap: 12 }}>{children}</View>}
    </View>
  );
}

// 동전 — 저금통 시각 문법의 최소 단위 (금화 원판 + 안쪽 링)
function Coin({ size, style }: { size: number; style?: ViewStyle }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFD85A', borderWidth: Math.max(1.5, size * 0.09), borderColor: '#E8B93B', alignItems: 'center', justifyContent: 'center' }, style]}>
      <View style={{ width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18, borderWidth: Math.max(1.2, size * 0.07), borderColor: '#E8B93B' }} />
    </View>
  );
}

function PiggyHero({ skin, level, size }: {
  skin: (typeof SKINS)[keyof typeof SKINS]; level: number; size: number;
}) {
  const inner = Math.round(size * 0.85);
  return (
    <View style={{ width: size, height: size, borderRadius: Math.round(size * 0.32), backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <Mascot head size={inner} radius={Math.round(inner * 0.33)} />
      <View style={{ position: 'absolute', top: Math.round(size * 0.09), width: Math.round(size * 0.34), height: Math.max(6, Math.round(size * 0.085)), borderRadius: 4, backgroundColor: skin.ink }} />
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
    <View style={{ marginTop: 3, gap: 19 }}>
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
    <View style={{ gap: 7 }}>
      {ordered.slice(0, 5).map((mission) => (
        <View key={mission.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 11, backgroundColor: mission.completed ? colors.greenTint2 : '#F7F8FA', paddingVertical: 9, paddingHorizontal: 10 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: mission.completed ? colors.green : '#E2E5E9', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={mission.completed ? 'check' : 'coin'} size={14} color={mission.completed ? '#fff' : colors.sub3} sw={2.2} />
          </View>
          <Text style={{ flex: 1, fontSize: 12, fontWeight: mission.completed ? '500' : '700', color: mission.completed ? colors.sub2 : colors.ink }}>{mission.title}</Text>
          <Text style={{ fontSize: 10.5, fontWeight: '800', color: mission.completed ? colors.sub3 : colors.green }}>+{mission.xp} XP</Text>
        </View>
      ))}
    </View>
  );
}
