import { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { createGoal, type Goal } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card, T } from '@/components/ui';
import { useApp } from '@/store';

// 목표 봉투 섹션 — 내 목표 진행 + 개설 폼 + 페이싱 진입만 담당한다(돈 층).
// AI 추천·또래 픽은 별도 '봉투 추천' 화면(EnvelopeSuggest)이 담당한다 — 여기선 중복 제거.
const wonFmt = (n: number) => '₩' + Math.round(n).toLocaleString('en-US');

export function GoalSection({ goals, onCreated, onPace }: {
  goals: Goal[]; onCreated: (g: Goal) => void; onPace: () => void;
}) {
  const { pacingApplied, actions } = useApp();   // ⑤b 페이싱으로 방금 담은 금액 오버레이
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');

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
          <Pressable onPress={() => actions.pushScr('envelopeSuggest')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ flex: 1, fontSize: 12.5, color: colors.sub2, fontWeight: '500', lineHeight: 18 }}>
              아직 목표 봉투가 없어요 — <Text style={{ color: colors.green, fontWeight: '700' }}>봉투 추천</Text>에서 맞는 봉투를 찾아보세요
            </Text>
            <Icon name="chevronRight" size={16} color={colors.green} sw={2.2} />
          </Pressable>
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
              <View style={{ height: 7, borderRadius: 4, backgroundColor: colors.line3, overflow: 'hidden' }}>
                <View style={{ width: `${pct * 100}%`, height: 7, borderRadius: 4, backgroundColor: colors.buffer }} />
              </View>
              {added > 0 ? (
                <Text style={{ fontSize: 11, color: colors.green, fontWeight: '700', marginTop: 1 }}>방금 여윳돈에서 +{wonFmt(added)} 담았어요 ✓</Text>
              ) : null}
            </View>
          );
        })}
      </View>

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
