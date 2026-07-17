import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { DEMO_DEPOSIT, getClarify, getTransactions, tagTransaction, type Clarify, type Txn } from '@/api';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card, Mascot, T } from '@/components/ui';
import { useApp } from '@/store';

export function Ledger() {
  const { actions, lastAlloc } = useApp();
  // 라이브 원장 (백엔드 SQLite) — 서버 다운이면 null → 정적 폴백 UI (데모 불사)
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [transactionsReady, setTransactionsReady] = useState(false);
  const load = useCallback(() => {
    getTransactions()
      .then((next) => { setTxns(next); setTransactionsReady(true); })
      .catch(() => { setTxns(null); setTransactionsReady(true); });
  }, []);
  useEffect(load, [load]);

  const month = txns?.[0]?.date.slice(0, 7) ?? '2025-05';
  const monthTxns = (txns ?? []).filter((t) => t.date.startsWith(month));
  const revenue = monthTxns.filter((t) => t.direction === 'in' && t.kind === 'income').reduce((a, t) => a + t.amount, 0);
  const spent = monthTxns.filter((t) => t.direction === 'out').reduce((a, t) => a + t.amount, 0);
  // 데모 입금은 원장 기록을 SSOT로 삼아 새로고침 뒤에도 다시 생성하지 않는다.
  const demoDepositRecorded = !!txns?.some((t) =>
    t.date === DEMO_DEPOSIT.date
    && t.amount === DEMO_DEPOSIT.amount
    && t.counterparty === DEMO_DEPOSIT.counterparty,
  );
  const depositHandled = !!lastAlloc || demoDepositRecorded;
  const depositConfirmed = lastAlloc?.confirmed ?? demoDepositRecorded;
  const depositAmount = lastAlloc?.deposit ?? DEMO_DEPOSIT.amount;

  return (
    <View style={{ gap: 14 }}>
      {/* 새 입금 도착 — 배분 제안 데모 트리거 (백엔드 파이프라인 라이브) */}
      {!transactionsReady ? (
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sub2 }}>새 입금 내역을 확인하고 있어요…</Text>
        </View>
      ) : !depositHandled ? <Pressable onPress={() => actions.openSheet('allocation')}>
        <View style={{ backgroundColor: colors.green, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: colors.green, shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="coin" size={22} color="#fff" sw={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: 'rgba(255,255,255,.85)' }}>방금 · △△플랫폼 정산</Text>
            <Text style={{ fontSize: 15.5, fontWeight: '800', color: '#fff', marginTop: 2, letterSpacing: -0.3 }}>+₩3,000,000 도착 — 나눠볼까요?</Text>
          </View>
          <Icon name="chevronRight" size={20} color="rgba(255,255,255,.8)" sw={2.2} />
        </View>
      </Pressable> : (
        <Pressable onPress={() => depositConfirmed ? actions.pushScr('tax') : actions.pushScr('chat')}>
          <View style={{ backgroundColor: depositConfirmed ? colors.greenTint2 : colors.bufferTint, borderWidth: 1, borderColor: depositConfirmed ? colors.greenLine : colors.line, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: depositConfirmed ? colors.green : colors.buffer, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={depositConfirmed ? 'check' : 'coin'} size={22} color="#fff" sw={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.sub2 }}>△△플랫폼 정산 · ₩{depositAmount.toLocaleString('en-US')}</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink, marginTop: 2, letterSpacing: -0.3 }}>
                {lastAlloc
                  ? depositConfirmed ? '4개 봉투에 나눠 담았어요' : '배분 제안이 준비됐어요 — 확인해 주세요'
                  : '이미 처리된 입금이에요 — 자동 봉투에서 확인하세요'}
              </Text>
            </View>
            <Icon name="chevronRight" size={20} color="#9AA1A9" sw={2.2} />
          </View>
        </Pressable>
      )}

      {/* 월 요약 — 라이브 원장 합산 (폴백: 데모 수치) */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.sub }}>{month.replace('-', '년 ')}월</Text>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.buffer, backgroundColor: colors.bufferTint, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, overflow: 'hidden' }}>자동 분류 켜짐</Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '600' }}>일감 매출</Text>
            <Text style={{ fontSize: 19, fontWeight: '800', letterSpacing: -0.4, marginTop: 3, color: colors.ink, ...T.num }}>₩{(txns ? revenue : 1_700_000).toLocaleString('en-US')}</Text>
          </View>
          <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: colors.line, paddingLeft: 14 }}>
            <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '600' }}>지출</Text>
            <Text style={{ fontSize: 19, fontWeight: '800', letterSpacing: -0.4, marginTop: 3, color: colors.ink, ...T.num }}>₩{(txns ? spent : 1_240_000).toLocaleString('en-US')}</Text>
          </View>
        </View>
      </Card>

      {/* 자동 봉투 진입 */}
      <Pressable onPress={() => actions.pushScr('tax')}>
        <Card style={{ gap: 13 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>자동 봉투</Text>
              <Text style={{ fontSize: 12, color: colors.sub2, fontWeight: '500', marginTop: 2 }}>입금마다 세금·경비·여윳돈으로 자동 적립</Text>
            </View>
            <Icon name="chevronRight" size={20} color="#C2C7CE" sw={2.2} />
          </View>
          <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
            <View style={{ width: '4%', backgroundColor: colors.tax }} />
            <View style={{ width: '30%', backgroundColor: colors.expense }} />
            <View style={{ width: '20%', backgroundColor: colors.buffer }} />
            <View style={{ flex: 1, backgroundColor: colors.spendable }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.taxBg, borderRadius: 12, padding: 12, paddingHorizontal: 14 }}>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.taxInk }}>5월 종소세 예상</Text>
              <Text style={{ fontSize: 11, color: '#D98A8C', fontWeight: '600', marginTop: 1 }}>미리 준비 ₩320,000 · 부족 ₩770,000</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.tax, letterSpacing: -0.4, ...T.num }}>₩1,090,000</Text>
          </View>
        </Card>
      </Pressable>

      {/* 여윳돈 진입 (피기 코치는 상시 플로팅 FAB로 대체) */}
      <Pressable onPress={() => actions.openSheet('invest')}>
        <Card p={16} style={{ borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bufferTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="trending" size={20} color={colors.buffer} sw={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>여윳돈 굴리기</Text>
            <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '500', marginTop: 1 }}>₩99,555 · 버퍼 초과분 보수적 운용</Text>
          </View>
          <Icon name="chevronRight" size={20} color="#C2C7CE" sw={2.2} />
        </Card>
      </Pressable>

      <View style={{ marginHorizontal: 4, marginTop: 2, marginBottom: -2 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sub }}>입금 · 자동 분류</Text>
        <Text style={{ fontSize: 11, color: colors.sub2, fontWeight: '500', marginTop: 2 }}>AI가 1차로 분류 · 애매한 건 직접 태그해요</Text>
      </View>

      <Card p={0} style={{ paddingHorizontal: 16, borderRadius: 16 }}>
        {txns ? (
          monthTxns.slice(0, 6).map((t, i, arr) => (
            t.needs_review
              ? <LiveTagRow key={t.id} txn={t} onTagged={load} last={i === arr.length - 1} />
              : <TxRow key={t.id} {...rowProps(t)} last={i === arr.length - 1} onPress={pressFor(t, actions)} />
          ))
        ) : (
          <>
            {/* 오프라인 폴백 — 백엔드 없이도 데모 유지 */}
            <TxRow badge="토스" bg={colors.bufferTint} color={colors.buffer} title="토스페이 정산" tag="AI 미분류 · 직접 분류하기" tagColor={colors.orange} amount="+₩250,000" />
            <TxRow badge="커" bg={colors.greenTint} color={colors.green} title="○○커머스" tag="일감 매출 · 자동분류" tagColor={colors.spendable} amount="+₩500,000" onPress={() => actions.openJob('commerce')} />
            <TxRow badge="스" bg={colors.orangeTint} color={colors.orange} title="△△스튜디오" tag="일감 매출 · 자동분류" tagColor={colors.spendable} amount="+₩1,200,000" onPress={() => actions.openJob('studio')} />
            <TxRow badge="구독" bg={colors.line} color={colors.sub} title="Figma 구독" tag="경비 · 소프트웨어" tagColor={colors.sub2} amount="−₩18,000" amountColor={colors.sub2} last small onPress={() => actions.pushScr('txDetail')} />
          </>
        )}
      </Card>
    </View>
  );
}

// 라이브 거래 → 행 표시 속성 (분류 결과가 색·태그를 결정)
function rowProps(t: Txn) {
  const isIn = t.direction === 'in';
  const badge = t.counterparty.replace(/[^가-힣A-Za-z]/g, '').slice(0, 1) || '?';
  if (t.kind === 'income') {
    const tag = t.subtype === 'advance' ? '계약금 의심 · 확인 필요' : '일감 매출 · 자동분류';
    return { badge, bg: colors.greenTint, color: colors.green, title: t.counterparty, tag, tagColor: colors.spendable, amount: `+₩${t.amount.toLocaleString('en-US')}` };
  }
  if (t.kind === 'expense') {
    return { badge, bg: colors.line, color: colors.sub, title: t.counterparty, tag: t.subtype === 'subscription' ? '경비 · 구독' : '경비 · 운영', tagColor: colors.sub2, amount: `−₩${t.amount.toLocaleString('en-US')}`, amountColor: colors.sub2, small: true };
  }
  return { badge, bg: colors.orangeTint, color: colors.orange, title: t.counterparty, tag: '개인 · 생활', tagColor: colors.sub2, amount: `${isIn ? '+' : '−'}₩${t.amount.toLocaleString('en-US')}`, amountColor: colors.sub2, small: true };
}

function pressFor(t: Txn, actions: ReturnType<typeof useApp>['actions']) {
  if (t.counterparty.includes('커머스')) return () => actions.openJob('commerce');
  if (t.counterparty.includes('스튜디오')) return () => actions.openJob('studio');
  if (t.direction === 'out') return () => actions.pushScr('txDetail');
  return undefined;
}

function TxRow({ badge, bg, color, title, tag, tagColor, amount, amountColor, last, small, onPress }: { badge: string; bg: string; color: string; title: string; tag: string; tagColor: string; amount: string; amountColor?: string; last?: boolean; small?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line2 }}>
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: small ? 13 : 14, fontWeight: '800', color }}>{badge}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{title}</Text>
        <Text style={{ fontSize: 11.5, color: tagColor, fontWeight: tagColor === colors.sub2 ? '600' : '700', marginTop: 2 }}>{tag}</Text>
      </View>
      <Text style={{ fontSize: 14.5, fontWeight: '800', color: amountColor || colors.ink, ...T.num }}>{amount}</Text>
    </Pressable>
  );
}

// 미분류 거래 수기 태그 — 코치가 해소 질문을 던지고(§6-2⑥), 탭 한 번이 곧 수기 태그.
// 태그하면 백엔드 사전이 학습, 같은 상대는 다음부터 자동 분류
const KIND_COLOR: Record<'income' | 'expense' | 'living', string> = {
  income: colors.spendable, expense: colors.expense, living: colors.sub2,
};

function LiveTagRow({ txn, onTagged, last }: { txn: Txn; onTagged: () => void; last?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clarify, setClarify] = useState<Clarify | null>(null);
  const toggle = () => {
    setOpen((o) => !o);
    if (!clarify) getClarify(txn.id).then(setClarify).catch(() => {}); // 실패 시 칩만 (폴백)
  };
  const OPTS: { label: string; kind: 'income' | 'expense' | 'living' }[] = clarify?.options ?? [
    { label: '일감 매출', kind: 'income' },
    { label: '경비', kind: 'expense' },
    { label: '개인', kind: 'living' },
  ];
  const doTag = async (kind: 'income' | 'expense' | 'living') => {
    setBusy(true);
    try {
      await tagTransaction(txn.id, kind); // 사전 학습 — 피드백 루프
      onTagged();
    } catch {
      setBusy(false);
      setOpen(false);
    }
  };
  return (
    <View style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line2 }}>
      <Pressable onPress={toggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
        <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: colors.bufferTint, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.buffer }}>{txn.counterparty.slice(0, 2)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{txn.counterparty}</Text>
          <Text style={{ fontSize: 11.5, color: colors.orange, fontWeight: '700', marginTop: 2 }}>{busy ? '반영 중…' : 'AI 미분류 · 직접 분류하기'}</Text>
        </View>
        <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.ink, ...T.num }}>+₩{txn.amount.toLocaleString('en-US')}</Text>
      </Pressable>
      {open && !busy && (
        <View style={{ paddingBottom: 14, paddingLeft: 50, gap: 9 }}>
          {/* 코치의 해소 질문 — "확인해주세요"가 아니라 답하기 쉬운 구체 질문 */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingRight: 8 }}>
            <Mascot head size={26} radius={8} />
            <View style={{ flexShrink: 1, backgroundColor: colors.greenTint2, borderWidth: 1, borderColor: colors.greenLine, borderRadius: 11, borderTopLeftRadius: 3, paddingVertical: 8, paddingHorizontal: 11 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.ink, lineHeight: 17 }}>
                {clarify ? clarify.question : '피기가 질문을 만드는 중…'}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {OPTS.map((o) => (
              <Pressable key={o.kind} onPress={() => doTag(o.kind)} style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: 9, borderWidth: 1.4, borderColor: KIND_COLOR[o.kind], backgroundColor: '#fff' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: KIND_COLOR[o.kind] }}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
