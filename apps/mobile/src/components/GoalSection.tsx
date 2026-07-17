import { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { createGoal, recommendEnvelopes, type EnvelopeIdea, type Goal, type PeerIdea } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card, T } from '@/components/ui';
import { useApp } from '@/store';

// 목표 봉투 섹션 — 목록·AI 추천 칩·개설 폼·페이싱 진입. 돈 층이라 정산 탭이 담당한다.
// 개설·확정은 사람, AI(⑤a 추천·⑤b 페이싱)는 판정까지만.
const wonFmt = (n: number) => '₩' + Math.round(n).toLocaleString('en-US');

export function GoalSection({ goals, onCreated, onPace }: {
  goals: Goal[]; onCreated: (g: Goal) => void; onPace: () => void;
}) {
  const { pacingApplied } = useApp();   // ⑤b 페이싱으로 방금 담은 금액 오버레이
  const [ideas, setIdeas] = useState<EnvelopeIdea[]>([]);
  const [peers, setPeers] = useState<PeerIdea[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(true);   // 추천 로딩 중(7.8B라 몇 초) 표시용
  const [recommendationUnavailable, setRecommendationUnavailable] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  useEffect(() => {
    // 추천 2소스 — ⑤a(내 팩트, LLM)·또래(유사 페르소나 관찰, 결정론).
    // 실패·판단 보류를 개인화된 정적 문구로 위장하지 않는다. 빈 결과는 그대로 빈 결과다.
    let alive = true;
    recommendEnvelopes()
      .then((r) => {
        if (!alive) return;
        setIdeas(r.recommendations ?? []);
        setPeers(r.peers ?? []);
        setLoadingRecs(false);
      })
      .catch(() => {
        if (!alive) return;
        setRecommendationUnavailable(true);
        setLoadingRecs(false);
      });
    return () => { alive = false; };
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

  // AI 추천(⑤a)은 이름·근거만 주고 금액이 없어, 개설 폼 금액을 또래 제안액 중앙값으로 프리필한다(사람이 조정).
  const defaultManwon = (): string => {
    const vals = peers.map((p) => p.suggested_amount).filter((v) => v > 0).sort((a, b) => a - b);
    const m = vals.length ? vals[Math.floor(vals.length / 2)] : 1_000_000;
    return String(Math.round(m / 10_000)) + '만';
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
            {loadingRecs && ideas.length === 0 && peers.length === 0
              ? '피기가 내 상황·또래를 보고 맞는 봉투를 찾고 있어요…'
              : recommendationUnavailable
                ? '추천을 불러오지 못했어요 — 개인화 문구를 지어내지 않고 직접 만들기만 열어둘게요'
                : ideas.length === 0 && peers.length === 0
                  ? '현재 근거로 추천할 봉투가 없어요 — 직접 목표를 만들어 보세요'
                  : '아직 목표 봉투가 없어요 — 아래 피기 추천을 탭하거나 직접 만들어 보세요'}
          </Text>
        )}
        {goals.map((g) => {
          const added = pacingApplied[g.id] ?? 0;      // 방금 페이싱으로 담은 금액(오버레이)
          const bal = g.balance + added;
          const pct = Math.min(1, bal / Math.max(1, g.target_amount));
          return (
            <View key={g.id} style={{ gap: 5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.ink }}>
                  {g.name} {g.target_date ? <Text style={{ fontSize: 11, color: colors.sub3, fontWeight: '600' }}>~{g.target_date.slice(5).replace('-', '/')}</Text> : null}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.sub, ...T.num }}>
                  {wonFmt(bal)} <Text style={{ color: colors.sub3 }}>/ {wonFmt(g.target_amount)}</Text>
                </Text>
              </View>
              <View style={{ height: 7, borderRadius: 4, backgroundColor: '#EDEFF2', overflow: 'hidden' }}>
                <View style={{ width: `${pct * 100}%`, height: 7, borderRadius: 4, backgroundColor: colors.buffer }} />
              </View>
              {added > 0 ? (
                <Text style={{ fontSize: 11, color: colors.green, fontWeight: '700', marginTop: 1 }}>방금 여윳돈에서 +{wonFmt(added)} 담았어요 ✓</Text>
              ) : null}
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
              onPress={() => { setCreating(true); setName(i.name); setAmount(defaultManwon()); }}
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
                // 도달이 너무 길면 형편 기준 낮춘 금액으로, 아니면 또래 중앙값으로 프리필
                setAmount(String(Math.round((p.affordable_amount ?? p.suggested_amount) / 10_000)) + '만');
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
