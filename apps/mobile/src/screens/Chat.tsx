import { useRef, useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { coachChat, decideAllocation, DEMO_COACH_CONTEXT } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Mascot } from '@/components/ui';
import { useApp } from '@/store';

// 백엔드(로컬 LLM) 미가동 시 오프라인 폴백 — 데모가 죽지 않는 원칙
const OFFLINE_REPLIES = [
  '네, 확인했어요! 세금봉투에 자동으로 반영해둘게요. 👍',
  '좋은 질문이에요. 여윳돈은 버퍼를 채운 뒤 보수적으로만 굴릴게요.',
  '알겠어요! 다음 정산 들어오면 바로 알려드릴게요.',
];

const won = (v: number) => `₩${v.toLocaleString('en-US')}`;

export function Chat() {
  const { lastAlloc, actions } = useApp();
  const [text, setText] = useState('');
  const [extra, setExtra] = useState<{ from: 'bot' | 'me'; text: string }[]>([]);
  const [thinking, setThinking] = useState(false);
  const [approving, setApproving] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const toEnd = () => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  // 진입 시 최신(방금 배분 제안 + 근거 + 승인 버튼)이 바로 보이게 맨 아래로
  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 150);
    return () => clearTimeout(t);
  }, []);

  const send = async () => {
    const t = text.trim();
    if (!t || thinking) return;
    setExtra((e) => [...e, { from: 'me', text: t }]);
    setText('');
    setThinking(true);
    toEnd();
    let reply: string;
    try {
      // 로컬 LLM(EXAONE) — 최근 배분 사건까지 컨텍스트 주입, 숫자는 결정론 검증기 통과분만
      const context = lastAlloc ? { ...DEMO_COACH_CONTEXT, latest_allocation: lastAlloc } : DEMO_COACH_CONTEXT;
      reply = (await coachChat(t, context)).reply;
    } catch {
      reply = OFFLINE_REPLIES[extra.length % OFFLINE_REPLIES.length];
    }
    setThinking(false);
    setExtra((e) => [...e, { from: 'bot', text: reply }]);
    toEnd();
  };

  // 챗에서 바로 승인 — 배분 확정(결정론 실행) 후 '담았어요' → 가계부로 이동
  const approve = async () => {
    if (!lastAlloc || lastAlloc.confirmed || approving) return;
    setApproving(true);
    try {
      if (lastAlloc.id) await decideAllocation(lastAlloc.id, 'confirm');
    } catch {}
    actions.markAllocConfirmed();
    setExtra((e) => [...e, { from: 'bot', text: '봉투에 담아뒀어요! ✓ 가계부에서 보여드릴게요.' }]);
    toEnd();
    setTimeout(() => actions.nav('ledger'), 1600);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F4F6' }} edges={['top', 'bottom']}>
      <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.line3 }}>
        <Pressable onPress={actions.back} hitSlop={8}><Icon name="chevronLeft" size={24} color={colors.ink} sw={2} /></Pressable>
        <Mascot head size={32} radius={16} />
        <View>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>피기 코치</Text>
          <Text style={{ fontSize: 10.5, color: colors.spendable, fontWeight: '600' }}>● 항상 함께</Text>
        </View>
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 11 }} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
        <Text style={{ alignSelf: 'center', fontSize: 11, fontWeight: '600', color: colors.sub3, backgroundColor: '#E5E8EB', paddingVertical: 4, paddingHorizontal: 11, borderRadius: 8, overflow: 'hidden' }}>오늘 오후 2:14</Text>
        <Bot>큰 돈이 들어왔네요! 🎉{'\n'}혹시 새 계약 하셨어요?</Bot>
        <Me>네, ○○커머스 신규 프로젝트요</Me>
        <Bot>
          축하해요! 그럼 50만원 중 세금 <Text style={{ fontWeight: '800' }}>18,150원</Text>은 세금봉투에 미리 담아둘게요.
        </Bot>
        <View style={{ flexDirection: 'row', gap: 8, maxWidth: '90%' }}>
          <View style={{ width: 28 }} />
          <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, paddingHorizontal: 14, shadowColor: '#111827', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.taxInk }}>세금봉투 +18,150</Text>
              <Text style={{ fontSize: 11, color: colors.sub2, fontWeight: '600' }}>자동 적립</Text>
            </View>
            <View style={{ height: 7, borderRadius: 4, backgroundColor: colors.taxBg, marginTop: 8, overflow: 'hidden' }}>
              <View style={{ width: '36%', height: '100%', backgroundColor: colors.tax, borderRadius: 4 }} />
            </View>
          </View>
        </View>
        <Me>좋아요 👍</Me>
        {/* 입금 이벤트 — 코치가 먼저 말 걸기 (숫자는 결정론 엔진 출력 그대로, 코치는 전달만) */}
        {lastAlloc && (
          <>
            <Text style={{ alignSelf: 'center', fontSize: 11, fontWeight: '600', color: colors.sub3, backgroundColor: '#E5E8EB', paddingVertical: 4, paddingHorizontal: 11, borderRadius: 8, overflow: 'hidden' }}>방금</Text>
            <Bot>
              💰 {won(lastAlloc.deposit)} 입금이 들어왔어요! 평소의 {lastAlloc.windfall.toFixed(1)}배 큰 금액이라 제가 배분을 제안드렸어요.
            </Bot>
            <Bot>
              세금 {won(lastAlloc.split.tax)} · 경비 {won(lastAlloc.split.expense)} · 생활비 {won(lastAlloc.split.spendable)} · 여윳돈 {won(lastAlloc.split.buffer)}
            </Bot>
            {lastAlloc.reasons && lastAlloc.reasons.length > 0 && (
              <Bot>
                <Text style={{ fontWeight: '800' }}>왜 이렇게 나눴냐면요 👇{'\n'}</Text>
                {lastAlloc.reasons.slice(0, 5).map((r, i) => `· ${r}${i < Math.min(lastAlloc.reasons!.length, 5) - 1 ? '\n' : ''}`).join('')}
              </Bot>
            )}
            <Bot>
              {lastAlloc.confirmed ? '승인해 주신 그대로 봉투에 담아뒀어요 ✓' : '이대로 봉투에 담을까요? 아래에서 승인해 주세요.'}
            </Bot>
            {!lastAlloc.confirmed && (
              <View style={{ flexDirection: 'row', gap: 8, maxWidth: '86%' }}>
                <View style={{ width: 28 }} />
                <Pressable onPress={approve} disabled={approving} style={{ flex: 1, backgroundColor: approving ? '#C7D0CF' : colors.green, borderRadius: 14, paddingVertical: 13, alignItems: 'center', shadowColor: colors.green, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>{approving ? '봉투에 담는 중…' : '이대로 봉투에 담기'}</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
        {extra.map((m, i) => (m.from === 'bot' ? <Bot key={i}>{m.text}</Bot> : <Me key={i}>{m.text}</Me>))}
        {thinking && <Bot>피기가 생각 중이에요 …</Bot>}
      </ScrollView>

      <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 6, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line3 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          placeholder="메시지 입력…"
          placeholderTextColor={colors.sub3}
          returnKeyType="send"
          style={{ flex: 1, height: 38, backgroundColor: '#F2F4F6', borderRadius: 19, paddingHorizontal: 16, fontSize: 13, color: colors.ink }}
        />
        <Pressable onPress={send} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: text.trim() ? colors.green : '#C7D0CF', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="send" size={18} color="#fff" sw={2} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Bot({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', maxWidth: '86%' }}>
      <Mascot head size={28} radius={14} style={{ backgroundColor: '#fff' }} />
      <View style={{ flexShrink: 1, backgroundColor: '#fff', borderRadius: 16, borderTopLeftRadius: 4, padding: 12, paddingHorizontal: 14, shadowColor: '#111827', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }}>
        <Text style={{ fontSize: 13.5, lineHeight: 20, color: colors.ink }}>{children}</Text>
      </View>
    </View>
  );
}
function Me({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ alignSelf: 'flex-end', backgroundColor: colors.green, borderRadius: 16, borderTopRightRadius: 4, padding: 12, paddingHorizontal: 14, maxWidth: '80%' }}>
      <Text style={{ fontSize: 13.5, lineHeight: 20, color: '#fff' }}>{children}</Text>
    </View>
  );
}
