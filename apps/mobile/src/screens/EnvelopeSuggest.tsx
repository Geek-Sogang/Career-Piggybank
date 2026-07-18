import { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { Icon, type IconName } from '@/components/Icon';
import { Mascot } from '@/components/ui';
import { useApp } from '@/store';

// 영상 [11] 완숙기2 · 봉투 추천.
// 앞선 배분 조정 패턴 + 페르소나로 새 봉투를 AI가 추천하고(피기 픽),
// 비슷한 긱워커들이 자주 쓰는 봉투(또래 픽)를 제안한다. 맨 아래엔 직접 만들기.

const NAME = '조대흠';

type Suggestion = { id: string; name: string; sub: string; amount: number; icon: IconName; color: string; tint: string };

// 피기 픽 — 페르소나(정산형 긱워커)·조정 패턴 기반 AI 추천
const PIGGY_PICKS: Suggestion[] = [
  { id: 'vat', name: '부가세 예비 봉투', sub: '분기 부가세 신고 대비 · 사업소득 구조', amount: 200_000, icon: 'building', color: colors.tax, tint: colors.taxBg },
  { id: 'gear', name: '장비 교체 봉투', sub: '노트북·모니터 감가 주기 대비', amount: 150_000, icon: 'cardPig', color: colors.indigo, tint: colors.indigoTint },
  { id: 'skill', name: '구독·학습 봉투', sub: 'Figma·AWS·강의 등 기술 유지비', amount: 100_000, icon: 'trending', color: colors.green, tint: colors.greenTint },
];

// 또래 픽 — 비슷한 긱워커들이 자주 쓰는 봉투
const PEER_PICKS: Suggestion[] = [
  { id: 'gap', name: '비수기 6개월 봉투', sub: '긱워커 78%가 만든 봉투', amount: 300_000, icon: 'coin', color: colors.buffer, tint: colors.bufferTint },
  { id: 'refresh', name: '리프레시 여행 봉투', sub: '번아웃 방지 · 또래 61%', amount: 120_000, icon: 'send', color: colors.pinkStrong, tint: colors.pinkTint },
];

const SWATCHES = [colors.green, colors.buffer, colors.indigo, colors.pinkStrong, colors.expense, colors.tax];

export function EnvelopeSuggest() {
  const { actions } = useApp();
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [custom, setCustom] = useState<{ name: string; amount: string; color: string }[]>([]);

  const add = (id: string) => setAdded((a) => ({ ...a, [id]: true }));
  const totalAdded = Object.values(added).filter(Boolean).length + custom.length;

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

        {/* 피기 픽 */}
        <SectionLabel badge="피기 픽" badgeColor={colors.green} badgeBg={colors.greenTint} title="AI가 골라봤어요" sub="조대흠님의 소득 구조와 조정 습관에 맞춰서" />
        <View style={{ gap: 10, marginBottom: 22 }}>
          {PIGGY_PICKS.map((s) => <SuggestRow key={s.id} s={s} added={!!added[s.id]} onAdd={() => add(s.id)} />)}
        </View>

        {/* 또래 픽 */}
        <SectionLabel badge="또래 픽" badgeColor={colors.indigo} badgeBg={colors.indigoTint} title="비슷한 긱워커들이 자주 써요" sub="같은 정산형 프리랜서들의 인기 봉투" />
        <View style={{ gap: 10, marginBottom: 22 }}>
          {PEER_PICKS.map((s) => <SuggestRow key={s.id} s={s} added={!!added[s.id]} onAdd={() => add(s.id)} />)}
        </View>

        {/* 내가 만든 봉투 */}
        {custom.length > 0 && (
          <View style={{ gap: 10, marginBottom: 22 }}>
            <SectionLabel badge="내 봉투" badgeColor={colors.pinkInk} badgeBg={colors.pinkTint} title="직접 만든 봉투" />
            {custom.map((c, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 15 }}>
                <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: c.color, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="coin" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{c.name || '내 봉투'}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '500', color: colors.sub2, marginTop: 2 }}>월 ₩{(Number(c.amount) || 0).toLocaleString('en-US')} 목표</Text>
                </View>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={15} color="#fff" sw={2.6} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 나만의 봉투 만들기 */}
        <Pressable onPress={() => setCreating(true)} style={{ borderWidth: 1.6, borderColor: colors.dash, borderStyle: 'dashed', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name="plus" size={20} color={colors.sub} sw={2.2} />
          <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.sub }}>나만의 봉투 만들기</Text>
        </Pressable>
      </ScrollView>

      {/* 하단 완료 바 */}
      {totalAdded > 0 && (
        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, borderTopWidth: 1, borderTopColor: colors.line3 }}>
          <Pressable onPress={actions.back} style={{ backgroundColor: colors.green, borderRadius: 16, paddingVertical: 17, alignItems: 'center', shadowColor: colors.green, shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>봉투 {totalAdded}개 추가 완료</Text>
          </Pressable>
        </View>
      )}

      {/* 봉투 만들기 모달 */}
      {creating && <CreateSheet onClose={() => setCreating(false)} onCreate={(c) => { setCustom((cs) => [...cs, c]); setCreating(false); }} />}
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

function SuggestRow({ s, added, onAdd }: { s: Suggestion; added: boolean; onAdd: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: added ? colors.greenLine : colors.line, backgroundColor: added ? colors.greenTint2 : '#fff', borderRadius: 16, padding: 15 }}>
      <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: s.tint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={s.icon} size={22} color={s.color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{s.name}</Text>
        <Text style={{ fontSize: 12, fontWeight: '500', color: colors.sub2, marginTop: 2 }}>{s.sub}</Text>
        <Text style={{ fontSize: 11.5, fontWeight: '700', color: s.color, marginTop: 4 }}>월 ₩{s.amount.toLocaleString('en-US')} 추천</Text>
      </View>
      {added ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 }}>
          <Icon name="check" size={17} color={colors.green} sw={2.6} />
          <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.green }}>추가됨</Text>
        </View>
      ) : (
        <Pressable onPress={onAdd} style={{ backgroundColor: colors.ink, paddingVertical: 9, paddingHorizontal: 15, borderRadius: 11 }}>
          <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#fff' }}>추가하기</Text>
        </Pressable>
      )}
    </View>
  );
}

function CreateSheet({ onClose, onCreate }: { onClose: () => void; onCreate: (c: { name: string; amount: string; color: string }) => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [color, setColor] = useState(SWATCHES[0]);
  const valid = name.trim().length > 0;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,18,23,.5)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30 }}>
        <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: '#E2E5E9', alignSelf: 'center', marginBottom: 18 }} />
        <Text style={{ fontSize: 19, fontWeight: '800', letterSpacing: -0.4, color: colors.ink }}>나만의 봉투 만들기</Text>

        <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.sub, marginTop: 18, marginBottom: 8 }}>봉투 이름</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="예: 세미나 참가 봉투"
          placeholderTextColor={colors.faint}
          style={{ borderWidth: 1.4, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 14, fontSize: 15, fontWeight: '600', color: colors.ink }}
        />

        <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.sub, marginTop: 16, marginBottom: 8 }}>월 목표 금액</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.4, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 15 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.sub2 }}>₩</Text>
          <TextInput
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
            placeholder="100,000"
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

        <Pressable
          onPress={() => valid && onCreate({ name, amount, color })}
          style={{ backgroundColor: valid ? colors.green : colors.dash, borderRadius: 15, paddingVertical: 16, alignItems: 'center', marginTop: 24 }}
        >
          <Text style={{ fontSize: 15.5, fontWeight: '800', color: '#fff' }}>봉투 만들기</Text>
        </Pressable>
      </View>
    </View>
  );
}
