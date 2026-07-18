import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createGoal, getGoals, recommendEnvelopes, type EnvelopeIdea, type Goal, type PeerIdea } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Mascot } from '@/components/ui';
import { useApp } from '@/store';

// 영상 [11] 완숙기 · 봉투 추천 — ⑤a 실배선.
// 피기 픽 = 내 팩트 근거 LLM 추천(이름·근거만 — 금액은 판정하지 않는다),
// 또래 픽 = 유사 페르소나 관찰(결정론 통계). 개설은 언제나 사람: 어떤 픽이든
// 탭하면 개설 폼이 열리고, '봉투 만들기'가 실제 목표 봉투를 만든다(createGoal).

const NAME = '조대흠';

// 추천 행 표시용 팔레트 — 데이터가 아니라 표현. 행 순서대로 순환한다.
const ROW_TINTS: { color: string; tint: string }[] = [
  { color: colors.tax, tint: colors.taxBg },
  { color: colors.indigo, tint: colors.indigoTint },
  { color: colors.green, tint: colors.greenTint },
  { color: colors.buffer, tint: colors.bufferTint },
  { color: colors.pinkStrong, tint: colors.pinkTint },
];
const SWATCHES = [colors.green, colors.buffer, colors.indigo, colors.pinkStrong, colors.expense, colors.tax];

type Prefill = { name: string; amount: number | null };

export function EnvelopeSuggest() {
  const { actions } = useApp();
  const [ideas, setIdeas] = useState<EnvelopeIdea[]>([]);
  const [peers, setPeers] = useState<PeerIdea[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [creating, setCreating] = useState<Prefill | null>(null);
  const [added, setAdded] = useState<Goal[]>([]);   // 이 화면에서 실제로 개설한 봉투들

  useEffect(() => {
    // 추천 2소스 — ⑤a(내 팩트, LLM 7.8B라 몇 초)·또래(결정론). 실패를 개인화 문구로
    // 위장하지 않는다: 빈 결과는 빈 결과, 실패는 실패로 말하고 직접 만들기만 열어둔다.
    let alive = true;
    Promise.all([recommendEnvelopes(), getGoals().catch(() => [] as Goal[])])
      .then(([r, g]) => {
        if (!alive) return;
        setIdeas(r.recommendations ?? []);
        setPeers(r.peers ?? []);
        setGoals(g);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setUnavailable(true);
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  // 이미 있는 목표(기존 + 방금 개설)와 겹치는 추천은 감춘다
  const taken = new Set([...goals, ...added].map((g) => g.name));
  const visibleIdeas = ideas.filter((i) => !taken.has(i.name));
  const visiblePeers = peers.filter((p) => !taken.has(p.name));

  // ⑤a는 금액을 판정하지 않으므로 개설 폼 프리필은 또래 제안액 중앙값(사람이 조정)
  const peerMedian = (): number | null => {
    const vals = peers.map((p) => p.suggested_amount).filter((v) => v > 0).sort((a, b) => a - b);
    return vals.length ? vals[Math.floor(vals.length / 2)] : null;
  };

  const onCreated = (g: Goal) => {
    setAdded((prev) => [...prev, g]);
    setCreating(null);
    actions.refreshCareer();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View style={{ height: 52, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={actions.back} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="chevronLeft" size={24} color={colors.ink} sw={2} />
        </Pressable>
        <Text style={{ fontSize: 16.5, fontWeight: '700', color: colors.ink }}>봉투 추천</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* 인사 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 20 }}>
          <Mascot head size={56} radius={17} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 19, fontWeight: '800', letterSpacing: -0.5, lineHeight: 26, color: colors.ink }}>{NAME}님,{'\n'}이런 봉투는 어떠세요?</Text>
          </View>
        </View>

        {loading && (
          <View style={{ alignItems: 'center', paddingVertical: 28, gap: 12 }}>
            <ActivityIndicator size="small" color={colors.green} />
            <Text style={{ fontSize: 12.5, fontWeight: '500', color: colors.sub2, textAlign: 'center' }}>
              피기가 내 상황·또래를 보고 맞는 봉투를 찾고 있어요…
            </Text>
          </View>
        )}
        {!loading && unavailable && (
          <View style={{ backgroundColor: colors.bg, borderRadius: 14, padding: 15, marginBottom: 20 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '500', color: colors.sub2, lineHeight: 18 }}>
              추천을 불러오지 못했어요 — 개인화 문구를 지어내지 않고 직접 만들기만 열어둘게요.
            </Text>
          </View>
        )}

        {/* 피기 픽 — ⑤a LLM 추천(이름·근거). 금액은 개설 폼에서 사람이 정한다 */}
        {visibleIdeas.length > 0 && (
          <>
            <SectionLabel badge="피기 픽" badgeColor={colors.green} badgeBg={colors.greenTint} title="AI가 골라봤어요" sub={`${NAME}님의 소득 구조와 습관 근거로`} />
            <View style={{ gap: 10, marginBottom: 22 }}>
              {visibleIdeas.map((s, i) => (
                <SuggestRow
                  key={s.name}
                  name={s.name}
                  sub={s.why}
                  amountLine={s.evidence.length ? `근거 ${s.evidence.join(' · ')}` : null}
                  {...ROW_TINTS[i % ROW_TINTS.length]}
                  onAdd={() => setCreating({ name: s.name, amount: peerMedian() })}
                />
              ))}
            </View>
          </>
        )}

        {/* 또래 픽 — 유사 페르소나 관찰(결정론). 제안액까지 실측 */}
        {visiblePeers.length > 0 && (
          <>
            <SectionLabel badge="또래 픽" badgeColor={colors.indigo} badgeBg={colors.indigoTint} title="비슷한 긱워커들이 자주 써요" sub="같은 직군·유사 성향의 개설 관찰" />
            <View style={{ gap: 10, marginBottom: 22 }}>
              {visiblePeers.map((p, i) => (
                <SuggestRow
                  key={p.name}
                  name={p.name}
                  sub={p.basis}
                  amountLine={`또래 목표 ₩${p.suggested_amount.toLocaleString('en-US')}${p.months_to_reach ? ` · 약 ${p.months_to_reach}개월` : ''}`}
                  {...ROW_TINTS[(i + 3) % ROW_TINTS.length]}
                  onAdd={() => setCreating({ name: p.name, amount: p.affordable_amount ?? p.suggested_amount })}
                />
              ))}
            </View>
          </>
        )}

        {/* 이 화면에서 개설한 봉투 */}
        {added.length > 0 && (
          <View style={{ gap: 10, marginBottom: 22 }}>
            <SectionLabel badge="내 봉투" badgeColor={colors.pinkInk} badgeBg={colors.pinkTint} title="방금 만든 봉투" />
            {added.map((g) => (
              <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: colors.greenLine, backgroundColor: colors.greenTint2, borderRadius: 16, padding: 15 }}>
                <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="coin" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{g.name}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '500', color: colors.sub2, marginTop: 2 }}>목표 ₩{g.target_amount.toLocaleString('en-US')}</Text>
                </View>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={15} color="#fff" sw={2.6} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 나만의 봉투 만들기 */}
        {!loading && (
          <Pressable onPress={() => setCreating({ name: '', amount: null })} style={{ borderWidth: 1.6, borderColor: colors.dash, borderStyle: 'dashed', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="plus" size={20} color={colors.sub} sw={2.2} />
            <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.sub }}>나만의 봉투 만들기</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* 하단 완료 바 */}
      {added.length > 0 && (
        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, borderTopWidth: 1, borderTopColor: colors.line3 }}>
          <Pressable onPress={actions.back} style={{ backgroundColor: colors.green, borderRadius: 16, paddingVertical: 17, alignItems: 'center', shadowColor: colors.green, shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>봉투 {added.length}개 만들기 완료</Text>
          </Pressable>
        </View>
      )}

      {/* 봉투 만들기 모달 — 개설은 사람의 결정, 저장은 실 createGoal */}
      {creating && <CreateSheet prefill={creating} onClose={() => setCreating(null)} onCreated={onCreated} />}
    </SafeAreaView>
  );
}

function SectionLabel({ badge, badgeColor, badgeBg, title, sub }: { badge: string; badgeColor: string; badgeBg: string; title: string; sub?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: badgeColor, backgroundColor: badgeBg, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 8, overflow: 'hidden' }}>{badge}</Text>
        <Text style={{ fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>{title}</Text>
      </View>
      {sub ? <Text style={{ fontSize: 12, fontWeight: '500', color: colors.sub2, marginTop: 6 }}>{sub}</Text> : null}
    </View>
  );
}

function SuggestRow({ name, sub, amountLine, color, tint, onAdd }: {
  name: string; sub: string; amountLine: string | null; color: string; tint: string; onAdd: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', borderRadius: 16, padding: 15 }}>
      <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="coin" size={22} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{name}</Text>
        <Text style={{ fontSize: 12, fontWeight: '500', color: colors.sub2, marginTop: 2, lineHeight: 17 }}>{sub}</Text>
        {amountLine ? <Text style={{ fontSize: 11.5, fontWeight: '700', color, marginTop: 4 }}>{amountLine}</Text> : null}
      </View>
      <Pressable onPress={onAdd} style={{ backgroundColor: colors.ink, paddingVertical: 9, paddingHorizontal: 15, borderRadius: 11 }}>
        <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#fff' }}>만들기</Text>
      </Pressable>
    </View>
  );
}

function CreateSheet({ prefill, onClose, onCreated }: {
  prefill: Prefill; onClose: () => void; onCreated: (g: Goal) => void;
}) {
  const [name, setName] = useState(prefill.name);
  const [amount, setAmount] = useState(prefill.amount ? String(prefill.amount) : '');
  const [color, setColor] = useState(SWATCHES[0]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const amt = Number(amount) || 0;
  const valid = name.trim().length > 0 && amt > 0;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const g = await createGoal(name.trim(), amt, null);
      onCreated(g);
    } catch {
      setBusy(false);
      setFailed(true);   // 실패를 성공처럼 꾸미지 않는다
    }
  };

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,18,23,.5)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30 }}>
        <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: '#E2E5E9', alignSelf: 'center', marginBottom: 18 }} />
        <Text style={{ fontSize: 19, fontWeight: '800', letterSpacing: -0.4, color: colors.ink }}>봉투 만들기</Text>

        <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.sub, marginTop: 18, marginBottom: 8 }}>봉투 이름</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="예: 세미나 참가 봉투"
          placeholderTextColor={colors.faint}
          style={{ borderWidth: 1.4, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 14, fontSize: 15, fontWeight: '600', color: colors.ink }}
        />

        <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.sub, marginTop: 16, marginBottom: 8 }}>목표 금액</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.4, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 15 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.sub2 }}>₩</Text>
          <TextInput
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
            placeholder="1,000,000"
            placeholderTextColor={colors.faint}
            keyboardType="number-pad"
            style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 8, fontSize: 15, fontWeight: '600', color: colors.ink }}
          />
        </View>

        <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.sub, marginTop: 16, marginBottom: 10 }}>색상</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {SWATCHES.map((sw) => (
            <Pressable key={sw} onPress={() => setColor(sw)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: sw, alignItems: 'center', justifyContent: 'center', borderWidth: color === sw ? 3 : 0, borderColor: '#fff', ...(color === sw ? { shadowColor: sw, shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } } : {}) }}>
              {color === sw ? <Icon name="check" size={16} color="#fff" sw={2.8} /> : null}
            </Pressable>
          ))}
        </View>

        {failed && (
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.orange, marginTop: 14 }}>
            봉투를 만들지 못했어요 — 잠시 뒤 다시 시도해 주세요.
          </Text>
        )}

        <Pressable
          onPress={submit}
          style={{ backgroundColor: valid && !busy ? colors.green : colors.dash, borderRadius: 15, paddingVertical: 16, alignItems: 'center', marginTop: 24 }}
        >
          {busy
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={{ fontSize: 15.5, fontWeight: '800', color: '#fff' }}>봉투 만들기</Text>}
        </Pressable>
      </View>
    </View>
  );
}
