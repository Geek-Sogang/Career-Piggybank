import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { getClarify, getTransactions, tagTransaction, type Clarify, type Txn } from '@/api';
import { colors } from '@/theme/colors';
import { Card, Mascot, T } from '@/components/ui';
import { useApp } from '@/store';

// 거래 내역 — 입금·자동 분류 전용 화면. 가계부 허브에서 진입한다.
// AI 1차 분류 + 애매한 건 수기 태그(코치 해소 질문 → 탭 한 번 = 사전 학습).
export function Transactions() {
  const { actions } = useApp();
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [ready, setReady] = useState(false);
  const load = useCallback(() => {
    getTransactions()
      .then((next) => { setTxns(next); setReady(true); })
      .catch(() => { setTxns(null); setReady(true); });
  }, []);
  useEffect(load, [load]);

  const month = txns?.[0]?.date.slice(0, 7) ?? '2025-05';
  const monthTxns = (txns ?? []).filter((t) => t.date.startsWith(month));

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.sub }}>{month.replace('-', '년 ')}월</Text>
        {ready && <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.sub2 }}>{txns ? `${monthTxns.length}건` : '데모 내역'}</Text>}
      </View>

      <Card p={0} style={{ paddingHorizontal: 16, borderRadius: 16 }}>
        {!ready ? (
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.sub2, paddingVertical: 18 }}>내역을 불러오고 있어요…</Text>
        ) : txns ? (
          monthTxns.map((t, i, arr) => (
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
    const tag = t.subtype === 'advance'
      ? '계약금 의심 · 확인 필요'
      : t.verified_career_job
        ? '검증 일감 · 자동분류'
        : t.signals.some((signal) => signal.includes('수기 태그'))
          ? '직접 확인 · 다음부터 자동학습'
          : '일감 매출 · 검증자료 미연결';
    const verified = t.verified_career_job;
    return { badge, bg: verified ? colors.greenTint : colors.bufferTint, color: verified ? colors.green : colors.buffer, title: t.counterparty, tag, tagColor: verified ? colors.spendable : colors.buffer, amount: `+₩${t.amount.toLocaleString('en-US')}` };
  }
  if (t.kind === 'expense') {
    return { badge, bg: colors.line, color: colors.sub, title: t.counterparty, tag: t.subtype === 'subscription' ? '경비 · 구독' : '경비 · 운영', tagColor: colors.sub2, amount: `−₩${t.amount.toLocaleString('en-US')}`, amountColor: colors.sub2, small: true };
  }
  return { badge, bg: colors.orangeTint, color: colors.orange, title: t.counterparty, tag: '개인 · 생활', tagColor: colors.sub2, amount: `${isIn ? '+' : '−'}₩${t.amount.toLocaleString('en-US')}`, amountColor: colors.sub2, small: true };
}

function pressFor(t: Txn, actions: ReturnType<typeof useApp>['actions']) {
  if (t.counterparty.includes('커머스')) return () => actions.openJob('commerce');
  if (t.counterparty.includes('스튜디오')) return () => actions.openJob('studio');
  if (t.counterparty.includes('플랫폼') && t.direction === 'in') return () => actions.openJob('platform');
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
