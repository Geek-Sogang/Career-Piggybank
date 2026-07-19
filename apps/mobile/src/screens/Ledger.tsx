import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { DEMO_DEPOSIT, getEnvelopeBalances, getTransactions, type Txn } from '@/api';
import { colors } from '@/theme/colors';
import { Icon, type IconName } from '@/components/Icon';
import { Card, T } from '@/components/ui';
import { useApp } from '@/store';

// 가계부 = 허브. 봉투 현황(히어로)만 펼쳐 보이고, 나머지는 메뉴 → 전용 화면으로 전환한다.
// (거래 내역·목표 봉투·봉투 추천·여윳돈 굴리기는 각자의 화면이 담당)
export function Ledger() {
  const { actions, lastAlloc } = useApp();
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [ready, setReady] = useState(false);
  const [env, setEnv] = useState<Awaited<ReturnType<typeof getEnvelopeBalances>> | null>(null);
  useEffect(() => {
    getTransactions()
      .then((next) => { setTxns(next); setReady(true); })
      .catch(() => { setTxns(null); setReady(true); });
  }, []);
  // 봉투 잔액·세금 준비 현황 — 배분(lastAlloc) 뒤 재조회해 방금 담은 몫을 반영
  useEffect(() => {
    getEnvelopeBalances().then(setEnv).catch(() => {});
  }, [lastAlloc]);

  const taxExpected = env?.annual_tax_expected ?? null;
  const taxPrepared = env?.tax_prepared ?? null;
  const taxReady = taxExpected != null && taxPrepared != null && taxPrepared >= taxExpected;

  const month = txns?.[0]?.date.slice(0, 7) ?? '2025-05';
  const monthTxns = (txns ?? []).filter((t) => t.date.startsWith(month));
  const revenue = monthTxns.filter((t) => t.direction === 'in' && t.kind === 'income').reduce((a, t) => a + t.amount, 0);
  const spent = monthTxns.filter((t) => t.direction === 'out').reduce((a, t) => a + t.amount, 0);
  const txnCount = txns ? monthTxns.length : 4;

  // 입금 처리 상태 — 이번 세션의 배분 결정(lastAlloc) 기준. 원장에 입금이 있어도
  // 아직 나눠 담기 전이면 트리거 카드를 보여준다(항상 재연 가능한 배분 동선).
  const latestIncome = (txns ?? []).find((t) => t.direction === 'in' && t.kind === 'income') ?? null;
  const depositHandled = !!lastAlloc;
  const depositConfirmed = lastAlloc?.confirmed ?? false;
  const depositAmount = lastAlloc?.deposit ?? latestIncome?.amount ?? DEMO_DEPOSIT.amount;
  const depositParty = latestIncome?.counterparty ?? DEMO_DEPOSIT.counterparty;
  const depositDate = latestIncome?.date ?? DEMO_DEPOSIT.date;
  const depositDay = `${Number(depositDate.slice(5, 7))}월 ${Number(depositDate.slice(8, 10))}일`;

  return (
    <View style={{ gap: 14 }}>
      {/* 입금 상태 — 미처리면 배분 트리거, 처리됐으면 결과로 안내 */}
      {!ready ? (
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sub2 }}>새 입금 내역을 확인하고 있어요…</Text>
        </View>
      ) : !depositHandled ? (
        <Pressable onPress={() => actions.openAllocFlow('deposit')}>
          <View style={{ backgroundColor: colors.green, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: colors.green, shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.18)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="coin" size={22} color="#fff" sw={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: 'rgba(255,255,255,.85)' }}>{depositDay} · {depositParty}</Text>
              <Text style={{ fontSize: 15.5, fontWeight: '800', color: '#fff', marginTop: 2, letterSpacing: -0.3 }}>+₩{depositAmount.toLocaleString('en-US')} — 봉투에 나눠 담기</Text>
            </View>
            <Icon name="chevronRight" size={20} color="rgba(255,255,255,.8)" sw={2.2} />
          </View>
        </Pressable>
      ) : (
        // 확정된 배분 탭 = 근거·조정 리뷰("언제든 다시 조정" 약속의 실현) — 자동봉투 현황은 아래 카드가 담당
        <Pressable onPress={() => depositConfirmed ? actions.openAllocFlow('review') : actions.pushScr('chat')}>
          <View style={{ backgroundColor: depositConfirmed ? colors.greenTint2 : colors.bufferTint, borderWidth: 1, borderColor: depositConfirmed ? colors.greenLine : colors.line, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: depositConfirmed ? colors.green : colors.buffer, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={depositConfirmed ? 'check' : 'coin'} size={22} color="#fff" sw={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.sub2 }}>{depositParty} · ₩{depositAmount.toLocaleString('en-US')}</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink, marginTop: 2, letterSpacing: -0.3 }}>
                {depositConfirmed ? '4개 봉투에 나눠 담았어요' : '배분 제안이 준비됐어요 — 확인해 주세요'}
              </Text>
            </View>
            <Icon name="chevronRight" size={20} color={colors.sub3} sw={2.2} />
          </View>
        </Pressable>
      )}

      {/* 봉투 현황 히어로 — 가계부의 첫 질문 "내 돈, 지금 어떻게 나뉘어 있나" → 자동 봉투 상세 */}
      <Pressable onPress={() => actions.pushScr('tax')}>
        <Card style={{ gap: 13 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>자동 봉투</Text>
              <Text style={{ fontSize: 12, color: colors.sub2, fontWeight: '500', marginTop: 2 }}>입금마다 세금·경비·여윳돈으로 자동 적립</Text>
            </View>
            <Icon name="chevronRight" size={20} color={colors.chev} sw={2.2} />
          </View>
          {/* 봉투 비중 바 — 실 잔액 비율(조회 전엔 대표 비율) */}
          <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
            {([['tax', 4], ['expense', 30], ['buffer', 20], ['spendable', 46]] as const).map(([k, fallback]) => {
              const v = env?.balances?.[k] ?? fallback;
              return v > 0 ? <View key={k} style={{ flex: v, backgroundColor: colors[k] }} /> : null;
            })}
          </View>
          {/* 세금 준비 현황 — 백엔드 결정론 계산. 긍정 프레임은 유지하되 상태는 정직하게 */}
          {taxExpected != null && taxPrepared != null && (
            <View style={{ backgroundColor: colors.greenTint, borderRadius: 12, padding: 14, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: taxReady ? colors.green : colors.buffer, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={taxReady ? 'check' : 'coin'} size={13} color="#fff" sw={2.6} />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.greenInk }}>
                  {taxReady ? '5월 종소세, 넉넉히 준비됐어요' : '5월 종소세, 모아가는 중이에요'}
                </Text>
              </View>
              <View style={{ gap: 6 }}>
                <TaxLine label="예상 세금" value={`₩${taxExpected.toLocaleString('en-US')}`} />
                <TaxLine label="모은 금액" value={`₩${taxPrepared.toLocaleString('en-US')}`} strong />
                {taxReady ? (
                  <TaxLine label="여유분" value={`+₩${(taxPrepared - taxExpected).toLocaleString('en-US')}`} accent />
                ) : (
                  <TaxLine label="앞으로 모을 금액" value={`₩${(taxExpected - taxPrepared).toLocaleString('en-US')}`} />
                )}
              </View>
            </View>
          )}
        </Card>
      </Pressable>

      {/* 이번 달 요약 */}
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

      {/* 메뉴 — 누르면 전용 화면으로 전환 */}
      <Card p={0} style={{ paddingHorizontal: 16, borderRadius: 16 }}>
        <MenuRow icon="ledgerDoc" tint={colors.bufferTint} color={colors.buffer} title="거래 내역" sub={`이번 달 ${txnCount}건 · AI 자동 분류`} onPress={() => actions.pushScr('transactions')} />
        <MenuRow icon="coin" tint={colors.greenTint} color={colors.green} title="목표 봉투" sub="여윳돈에서 목표로 나눠 담기" onPress={() => actions.pushScr('goals')} />
        <MenuRow icon="cardPig" tint={colors.pinkTint} color={colors.pinkStrong} title="봉투 추천" sub="피기 픽 · 또래 픽 · 나만의 봉투" onPress={() => actions.pushScr('envelopeSuggest')} />
        <MenuRow icon="trending" tint={colors.indigoTint} color={colors.indigo} title="여윳돈 굴리기" sub="₩99,555 · 버퍼 초과분 보수적 운용" onPress={() => actions.openSheet('invest')} last />
      </Card>
    </View>
  );
}

function TaxLine({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.greenInk }}>{label}</Text>
      <Text style={{ fontSize: strong ? 14 : 12.5, fontWeight: strong ? '800' : '700', color: accent ? colors.green : colors.greenInk, ...T.num }}>{value}</Text>
    </View>
  );
}

function MenuRow({ icon, tint, color, title, sub, onPress, last }: { icon: IconName; tint: string; color: string; title: string; sub: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 15, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line2 }}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={21} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{title}</Text>
        <Text style={{ fontSize: 12, color: colors.sub2, fontWeight: '500', marginTop: 2 }}>{sub}</Text>
      </View>
      <Icon name="chevronRight" size={20} color={colors.chev} sw={2.2} />
    </Pressable>
  );
}
