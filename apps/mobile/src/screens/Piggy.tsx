import { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { createGoal, fetchStrength, getGoals, recommendEnvelopes, type EnvelopeIdea, type Goal, type PeerIdea } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card, Mascot, Stat, T } from '@/components/ui';
import { useApp } from '@/store';

// 서버/LLM 미가동 시 오프라인 폴백 문구
const OFFLINE_STRENGTH = '"꾸준한 React 커밋과 정시 정산 — 신뢰도 높은 프론트엔드 개발자"';

export function Piggy() {
  const { actions, sheet } = useApp();
  const [strength, setStrength] = useState(OFFLINE_STRENGTH);
  const [goals, setGoals] = useState<Goal[]>([]);
  useEffect(() => {
    fetchStrength()
      .then((s) => setStrength(`"${s.line}"`)) // 결정론 후보 원문 — AI는 선택만 했음
      .catch(() => {});
  }, []);
  // 목표 봉투 — 페이싱 시트가 닫힐 때 재조회(confirm이 잔액을 움직인 직후)
  useEffect(() => {
    if (!sheet) getGoals().then(setGoals).catch(() => {});
  }, [sheet]);

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

      {/* 목표 봉투 — 개설은 사람, 추천(⑤a)·페이싱(⑤b)은 AI 판정까지만 */}
      <GoalSection goals={goals} onCreated={(g) => setGoals((prev) => [...prev, g])} onPace={() => actions.openSheet('pacing')} />

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

// ── 목표 봉투 섹션 — 목록·AI 추천 칩·개설 폼·페이싱 진입 ──
const wonFmt = (n: number) => '₩' + Math.round(n).toLocaleString('en-US');

function GoalSection({ goals, onCreated, onPace }: {
  goals: Goal[]; onCreated: (g: Goal) => void; onPace: () => void;
}) {
  const [ideas, setIdeas] = useState<EnvelopeIdea[]>([]);
  const [peers, setPeers] = useState<PeerIdea[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  useEffect(() => {
    // 추천 2소스 — ⑤a(내 팩트, LLM)·또래(유사 페르소나 관찰, 결정론). 실패하면 조용히 없음
    recommendEnvelopes()
      .then((r) => { setIdeas(r.recommendations); setPeers(r.peers ?? []); })
      .catch(() => {});
  }, []);

  const submit = async () => {
    const amt = Number(amount.replace(/[,\s만]/g, '')) * (amount.includes('만') ? 10_000 : 1);
    if (!name.trim() || !amt || amt <= 0) return;
    const target = /^\d{4}-\d{2}-\d{2}$/.test(date.trim()) ? date.trim() : null;
    try {
      const g = await createGoal(name.trim(), amt, target);
      onCreated(g);
      setCreating(false); setName(''); setAmount(''); setDate('');
    } catch {}
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>목표 봉투</Text>
        <Pressable onPress={() => setCreating((v) => !v)}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.green, backgroundColor: colors.greenTint, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 9, overflow: 'hidden' }}>
            {creating ? '닫기' : '+ 만들기'}
          </Text>
        </Pressable>
      </View>

      {/* 내 목표들 — 잔액/목표 게이지 */}
      <View style={{ marginTop: 12, gap: 10 }}>
        {goals.length === 0 && !creating && (
          <Text style={{ fontSize: 12.5, color: colors.sub2, fontWeight: '500', lineHeight: 18 }}>
            아직 목표 봉투가 없어요 — 아래 피기 추천을 탭하거나 직접 만들어 보세요
          </Text>
        )}
        {goals.map((g) => {
          const pct = Math.min(1, g.balance / Math.max(1, g.target_amount));
          return (
            <View key={g.id} style={{ gap: 5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.ink }}>
                  {g.name} {g.target_date ? <Text style={{ fontSize: 11, color: colors.sub3, fontWeight: '600' }}>~{g.target_date.slice(5).replace('-', '/')}</Text> : null}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.sub, ...T.num }}>
                  {wonFmt(g.balance)} <Text style={{ color: colors.sub3 }}>/ {wonFmt(g.target_amount)}</Text>
                </Text>
              </View>
              <View style={{ height: 7, borderRadius: 4, backgroundColor: '#EDEFF2', overflow: 'hidden' }}>
                <View style={{ width: `${pct * 100}%`, height: 7, borderRadius: 4, backgroundColor: colors.buffer }} />
              </View>
            </View>
          );
        })}
      </View>

      {/* 추천 칩 2소스 — 탭 = 개설 폼 프리필 (개설은 사람의 결정).
          AI(⑤a, 내 팩트 근거) = 보라 / 또래(유사 페르소나 관찰, 결정론 통계) = 파랑 */}
      {(ideas.length > 0 || peers.length > 0) && (
        <View style={{ marginTop: 12, gap: 6 }}>
          {ideas.filter((i) => !goals.some((g) => g.name === i.name)).slice(0, 2).map((i) => (
            <Pressable
              key={i.name}
              onPress={() => { setCreating(true); setName(i.name); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F1FB', borderWidth: 1, borderColor: '#E2D8F3', borderRadius: 11, padding: 10 }}
            >
              <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#7C5CBF', backgroundColor: '#fff', paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7, overflow: 'hidden' }}>AI 추천</Text>
              <Text style={{ flex: 1, fontSize: 11.5, fontWeight: '600', color: colors.ink, lineHeight: 16 }}>
                <Text style={{ fontWeight: '800' }}>{i.name}</Text> — {i.why}
              </Text>
            </Pressable>
          ))}
          {peers.filter((p) => !goals.some((g) => g.name === p.name)).slice(0, 2).map((p) => (
            <Pressable
              key={p.name}
              onPress={() => {
                setCreating(true); setName(p.name);
                setAmount(String(Math.round(p.suggested_amount / 10_000)) + '만'); // 또래 중앙값 프리필
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bufferTint, borderWidth: 1, borderColor: '#CBE7F5', borderRadius: 11, padding: 10 }}
            >
              <Text style={{ fontSize: 9.5, fontWeight: '800', color: colors.buffer, backgroundColor: '#fff', paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7, overflow: 'hidden' }}>또래 픽</Text>
              <Text style={{ flex: 1, fontSize: 11.5, fontWeight: '600', color: colors.ink, lineHeight: 16 }}>
                <Text style={{ fontWeight: '800' }}>{p.name}</Text> — {p.basis}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* 개설 폼 — 개설은 언제나 사람 */}
      {creating && (
        <View style={{ marginTop: 12, gap: 8 }}>
          <TextInput value={name} onChangeText={setName} placeholder="봉투 이름 (예: 새 맥북)" placeholderTextColor={colors.sub3}
            style={{ borderWidth: 1.4, borderColor: colors.line, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 12, fontSize: 13.5, fontWeight: '600', color: colors.ink }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={amount} onChangeText={setAmount} placeholder="목표 금액 (예: 240만)" placeholderTextColor={colors.sub3} keyboardType="numbers-and-punctuation"
              style={{ flex: 1.2, borderWidth: 1.4, borderColor: colors.line, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 12, fontSize: 13.5, fontWeight: '600', color: colors.ink }} />
            <TextInput value={date} onChangeText={setDate} placeholder="기한 YYYY-MM-DD (선택)" placeholderTextColor={colors.sub3}
              style={{ flex: 1.4, borderWidth: 1.4, borderColor: colors.line, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 12, fontSize: 12.5, fontWeight: '600', color: colors.ink }} />
          </View>
          <Pressable onPress={submit} style={{ backgroundColor: colors.green, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 13.5, fontWeight: '800' }}>봉투 만들기</Text>
          </Pressable>
        </View>
      )}

      {/* ⑤b 페이싱 진입 — 여윳돈에서 목표로 (판단 AI·원화 산수·실행 사람) */}
      {goals.length > 0 && (
        <Pressable onPress={onPace} style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1.4, borderColor: colors.buffer, borderRadius: 13, paddingVertical: 12 }}>
          <Icon name="coin" size={16} color={colors.buffer} sw={2.2} />
          <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.buffer }}>여윳돈에서 목표에 나눠 담기</Text>
        </Pressable>
      )}
    </Card>
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
