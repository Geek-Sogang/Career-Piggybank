import { useRef, useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { coachChat, decideAllocation, DEMO_COACH_CONTEXT, fetchProductMatch, prefetchProductMatch, type ProductMatchResponse } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Mascot } from '@/components/ui';
import { useApp } from '@/store';
import { PRODUCTS, type ProductKey } from '@/products';

// 백엔드(로컬 LLM) 미가동 시 오프라인 폴백 — 데모가 죽지 않는 원칙
const OFFLINE_REPLIES = [
  '네, 확인했어요! 세금봉투에 자동으로 반영해둘게요. 👍',
  '좋은 질문이에요. 여윳돈은 버퍼를 채운 뒤 보수적으로만 굴릴게요.',
  '알겠어요! 다음 정산 들어오면 바로 알려드릴게요.',
];

const won = (v: number) => `₩${v.toLocaleString('en-US')}`;
const NAME = '조대흠';

type ProductCard = { key: ProductKey; line: string; matched: boolean };
type ChatMessage = { from: 'bot' | 'me'; text: string; products?: ProductCard[] };

function productAnswer(message: string, result: ProductMatchResponse): ChatMessage {
  const asksEmergency = /비상금|대출/.test(message);
  if (asksEmergency) {
    const matched = result.matches.find((pick) => pick.product_id === 'emergency');
    const verifiedCount = result.verification?.verified?.count ?? 0;
    if (matched) {
      return {
        from: 'bot',
        text: `${NAME}님에게는 ${matched.name}이 현재 적격 후보예요. ${matched.line} 신청 전 한도·금리·상환 조건은 하나원큐 실제 심사에서 확인해 주세요.`,
        products: [{ key: 'emergency', line: matched.line, matched: true }],
      };
    }
    const veto = result.vetoed?.emergency ?? '현재 원장만으로는 상환 여력을 확인하기 어려워 대출 권유를 보류했어요';
    return {
      from: 'bot',
      text: `${NAME}님이 비상금대출을 찾고 있군요. 다만 지금은 ${veto} 연결된 검증 일감 ${verifiedCount}건은 심사자료로 가져갈 수 있어요. 한도와 금리는 하나원큐 실제 심사에서만 확인할 수 있습니다.`,
      products: [{ key: 'emergency', line: veto, matched: false }],
    };
  }

  const picks = result.matches.slice(0, 2);
  if (!picks.length) {
    return { from: 'bot', text: '현재 확인된 돈 흐름만으로는 억지로 상품을 권하지 않을게요. 원하는 상품 종류가 있으면 적격 조건부터 함께 확인해 드릴게요.' };
  }
  const names = picks.map((pick) => pick.name).join('과 ');
  return {
    from: 'bot',
    text: `${NAME}님의 긱 소득 구조와 금융 페르소나를 EXAONE이 함께 분석했을 때, 지금은 ${names}을 먼저 살펴보는 것이 맞아요. 구체적으로 원하는 상품이 있을까요?`,
    products: picks.map((pick) => ({ key: pick.product_id, line: pick.line, matched: true })),
  };
}

export function Chat() {
  const { lastAlloc, actions } = useApp();
  const [text, setText] = useState('');
  const [extra, setExtra] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [approving, setApproving] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const toEnd = () => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  // 진입 시 최신(방금 배분 제안 + 근거 + 승인 버튼)이 바로 보이게 맨 아래로
  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 150);
    prefetchProductMatch();
    return () => clearTimeout(t);
  }, []);

  const send = async () => {
    const t = text.trim();
    if (!t || thinking) return;
    setExtra((e) => [...e, { from: 'me', text: t }]);
    setText('');
    setThinking(true);
    toEnd();
    let response: ChatMessage;
    try {
      if (/상품|비상금|대출|통장|ISA|IRP|연금/.test(t)) {
        // 적합성 veto(결정론) 뒤 EXAONE이 후보를 선택한 실 매칭 결과를 카드로 번역한다.
        response = productAnswer(t, await fetchProductMatch());
      } else {
        // 로컬 LLM(EXAONE) — 최근 배분 사건까지 컨텍스트 주입, 숫자는 결정론 검증기 통과분만
        const context = lastAlloc ? { ...DEMO_COACH_CONTEXT, latest_allocation: lastAlloc } : DEMO_COACH_CONTEXT;
        response = { from: 'bot', text: (await coachChat(t, context)).reply };
      }
    } catch {
      response = { from: 'bot', text: OFFLINE_REPLIES[extra.length % OFFLINE_REPLIES.length] };
    }
    setThinking(false);
    setExtra((e) => [...e, response]);
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
    setExtra((e) => [...e, { from: 'bot', text: '봉투에 담아뒀어요! ✓ 정산 내역에서 보여드릴게요.' }]);
    toEnd();
    setTimeout(() => actions.nav('ledger'), 1600);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.line2 }} edges={['top', 'bottom']}>
      <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.line3 }}>
        <Pressable onPress={actions.back} hitSlop={8}><Icon name="chevronLeft" size={24} color={colors.ink} sw={2} /></Pressable>
        <Mascot head size={32} radius={16} />
        <View>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>피기 코치</Text>
          <Text style={{ fontSize: 10.5, color: colors.spendable, fontWeight: '600' }}>● 항상 함께</Text>
        </View>
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 11 }} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
        <Text style={{ alignSelf: 'center', fontSize: 11, fontWeight: '600', color: colors.sub3, backgroundColor: colors.line4, paddingVertical: 4, paddingHorizontal: 11, borderRadius: 8, overflow: 'hidden' }}>오늘 오후 2:14</Text>
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
            <Text style={{ alignSelf: 'center', fontSize: 11, fontWeight: '600', color: colors.sub3, backgroundColor: colors.line4, paddingVertical: 4, paddingHorizontal: 11, borderRadius: 8, overflow: 'hidden' }}>방금</Text>
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
        {extra.map((m, i) => (
          m.from === 'bot' ? (
            <View key={i} style={{ gap: 8 }}>
              <Bot>{m.text}</Bot>
              {m.products?.map((product) => (
                <ProductTicket key={product.key} product={product} onOpen={() => actions.pushScr('products')} />
              ))}
            </View>
          ) : <Me key={i}>{m.text}</Me>
        ))}
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
          style={{ flex: 1, height: 38, backgroundColor: colors.line2, borderRadius: 19, paddingHorizontal: 16, fontSize: 13, color: colors.ink }}
        />
        <Pressable onPress={send} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: text.trim() ? colors.green : '#C7D0CF', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="send" size={18} color="#fff" sw={2} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ProductTicket({ product, onOpen }: { product: ProductCard; onOpen: () => void }) {
  const p = PRODUCTS[product.key];
  return (
    <View style={{ marginLeft: 36, maxWidth: '86%', backgroundColor: '#fff', borderRadius: 17, overflow: 'hidden', borderWidth: 1, borderColor: product.matched ? colors.ai : colors.line, shadowColor: colors.ai, shadowOpacity: product.matched ? 0.12 : 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
      <View style={{ padding: 14, gap: 9 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: p.badgeBg, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: p.badgeColor }}>{p.badge}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10.5, fontWeight: '800', color: product.matched ? colors.ai : colors.sub2 }}>
              {product.matched ? 'EXAONE 맞춤 분석' : '요청 상품 · 권유 보류'}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink, marginTop: 2 }}>{p.name}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 11.5, fontWeight: '400', lineHeight: 17, color: colors.sub }}>{product.line}</Text>
        <Text style={{ fontSize: 10.5, fontWeight: '500', color: colors.sub3 }}>자격·한도·금리는 하나원큐 실제 심사에서 결정돼요</Text>
      </View>
      <Pressable onPress={onOpen} style={{ backgroundColor: product.matched ? colors.aiTint : colors.greenTint2, borderTopWidth: 1, borderTopColor: colors.line2, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 12.5, fontWeight: '800', color: product.matched ? colors.ai : colors.green }}>금융상품에서 더 보기</Text>
        <Icon name="arrowRight" size={17} color={product.matched ? colors.ai : colors.green} sw={2} />
      </Pressable>
    </View>
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
