import { useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Mascot } from '@/components/ui';
import { useApp } from '@/store';

const REPLIES = [
  '네, 확인했어요! 세금봉투에 자동으로 반영해둘게요. 👍',
  '좋은 질문이에요. 여윳돈은 버퍼를 채운 뒤 보수적으로만 굴릴게요.',
  '알겠어요! 다음 정산 들어오면 바로 알려드릴게요.',
];

export function Chat() {
  const { actions } = useApp();
  const [text, setText] = useState('');
  const [extra, setExtra] = useState<{ from: 'bot' | 'me'; text: string }[]>([]);
  const scroll = useRef<ScrollView>(null);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    const reply = REPLIES[extra.length % REPLIES.length];
    setExtra((e) => [...e, { from: 'me', text: t }, { from: 'bot', text: reply }]);
    setText('');
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
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

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 11 }} keyboardShouldPersistTaps="handled">
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
        {extra.map((m, i) => (m.from === 'bot' ? <Bot key={i}>{m.text}</Bot> : <Me key={i}>{m.text}</Me>))}
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
      <View style={{ backgroundColor: '#fff', borderRadius: 16, borderTopLeftRadius: 4, padding: 12, paddingHorizontal: 14, shadowColor: '#111827', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }}>
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
