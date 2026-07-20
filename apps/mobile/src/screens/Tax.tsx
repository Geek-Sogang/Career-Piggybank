import { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card, T } from '@/components/ui';
import { useApp } from '@/store';
import { getEnvelopeBalances, getGoals, type Goal } from '@/api';
import { splitDeposit, estimateAnnualTax, won } from '@/lib/taxEnvelope';

const ANNUAL = 30_000_000;

export function Tax() {
  const { lastAlloc, actions, pacingApplied } = useApp();
  // 방금 배분한 실제 입금이 있으면 그 금액·분배로, 없으면 데모 기본값(결정론 엔진 라이브 계산)
  const DEPOSIT = lastAlloc?.deposit ?? 500_000;
  const e = lastAlloc?.split ?? splitDeposit(DEPOSIT, ANNUAL);
  const a = estimateAnnualTax(ANNUAL);
  const pct = (v: number) => (v / DEPOSIT) * 100;

  // 봉투별 총 잔액 — '총액 (+이번 입금)' 표시용
  const [balances, setBalances] = useState<Record<string, number> | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  useEffect(() => {
    getEnvelopeBalances().then((r) => setBalances(r.balances)).catch(() => {});
    getGoals().then(setGoals).catch(() => {});   // 목표 봉투 — ⑤b 페이싱으로 담긴 것 포함
  }, []);

  const rows = [
    { key: 'tax', c: colors.tax, label: '세금', sub: '5월 종소세 대비', v: e.tax },
    { key: 'expense', c: colors.expense, label: '경비', sub: '장비·소프트웨어', v: e.expense },
    { key: 'buffer', c: colors.buffer, label: '여윳돈', sub: '투자·비상금', v: e.buffer },
    { key: 'spendable', c: colors.spendable, label: '즉시가용', sub: '바로 쓸 수 있어요', v: e.spendable, accent: colors.spendableInk },
  ];

  return (
    <View style={{ gap: 14 }}>
      {/* 방금 담은 입금 안내 — 챗 승인 직후 어떤 봉투에 얼마 들어갔는지 */}
      {lastAlloc && (
        <View style={{ backgroundColor: colors.greenTint2, borderWidth: 1, borderColor: colors.greenLine, borderRadius: 14, padding: 15 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.green, letterSpacing: -0.3 }}>
            이번 {won(DEPOSIT)} 입금, 이렇게 나눠 담았어요 ✓
          </Text>
          <Text style={{ fontSize: 12, color: colors.sub2, fontWeight: '600', marginTop: 4, lineHeight: 18 }}>
            세금 +{won(e.tax)} · 경비 +{won(e.expense)} · 즉시가용 +{won(e.spendable)} · 여윳돈 +{won(e.buffer)}
          </Text>
        </View>
      )}

      {/* 입력 요약 */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <MiniCard label="이번 입금" value={won(DEPOSIT)} />
        <MiniCard label="연매출 (추정)" value={won(ANNUAL)} />
      </View>

      {/* 자동 분류 */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>이번 입금 자동 분류</Text>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink, ...T.num }}>{won(DEPOSIT)}</Text>
        </View>
        <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2, marginTop: 14 }}>
          {rows.map((r, i) => (
            <View key={i} style={{ flexGrow: pct(r.v), flexBasis: 0, backgroundColor: r.c }} />
          ))}
        </View>
        <View style={{ marginTop: 16 }}>
          {rows.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderBottomWidth: i < 3 ? 1 : 0, borderBottomColor: colors.line2 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: r.c }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{r.label}</Text>
                <Text style={{ fontSize: 11, color: colors.sub2, fontWeight: '500', marginTop: 1 }}>{r.sub}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: r.accent || colors.ink, ...T.num }}>{won(balances?.[r.key] ?? r.v)}</Text>
                {lastAlloc ? (
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.green, ...T.num }}>(+{won(r.v)}) · {pct(r.v).toFixed(0)}%</Text>
                ) : (
                  <Text style={{ fontSize: 10.5, color: colors.sub2, fontWeight: '600' }}>{pct(r.v).toFixed(1)}%</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </Card>

      {/* 목표 봉투 — ⑤b 페이싱으로 여윳돈에서 담긴 봉투가 여기 모인다 */}
      {goals.length > 0 && (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>목표 봉투</Text>
            <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '600' }}>여윳돈에서 담아 모으는 봉투</Text>
          </View>
          <View style={{ marginTop: 14, gap: 15 }}>
            {goals.map((g) => {
              const added = pacingApplied[g.id] ?? 0;      // 방금 페이싱으로 담은 금액
              const bal = g.balance + added;
              const p = Math.min(1, bal / Math.max(1, g.target_amount));
              return (
                <View key={g.id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{g.name}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink, ...T.num }}>
                      {won(bal)} <Text style={{ fontSize: 11, color: colors.sub3, fontWeight: '600' }}>/ {won(g.target_amount)}</Text>
                    </Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.line3, overflow: 'hidden' }}>
                    <View style={{ width: `${p * 100}%`, height: 8, borderRadius: 4, backgroundColor: colors.buffer }} />
                  </View>
                  {added > 0 ? (
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.green }}>방금 여윳돈에서 +{won(added)} 담았어요 ✓</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {/* 5월 종소세 미리보기 */}
      <Card>
        <Text style={{ fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: colors.ink }}>5월 종합소득세 미리보기</Text>
        <View style={{ marginTop: 14 }}>
          <KV k="과세표준" v={won(a.taxable)} />
          <KV k="산출세액 (지방세 포함)" v={won(a.totalTax)} />
          <KV k="기납부 (3.3% 원천징수)" v={`−${won(a.alreadyWithheld)}`} vColor={colors.buffer} border />
        </View>
        {/* 준비 현황 — 긍정 프레임은 유지하되 수치는 실값(세금봉투 잔액 vs 산출 추가납부) */}
        {(() => {
          const prepared = balances?.tax ?? null;
          if (prepared == null) return null;
          const taxReady = prepared >= a.additionalDue;
          return (
            <View style={{ marginTop: 14, backgroundColor: colors.greenTint, borderRadius: 14, padding: 15, gap: 11 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: taxReady ? colors.green : colors.buffer, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={taxReady ? 'check' : 'coin'} size={13} color="#fff" sw={2.6} />
                </View>
                <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.greenInk }}>
                  {taxReady ? '5월 종소세, 넉넉히 준비됐어요' : '5월 종소세, 모아가는 중이에요'}
                </Text>
              </View>
              <View style={{ gap: 7 }}>
                <TaxLine label="5월 추가납부 예상" value={won(a.additionalDue)} />
                <TaxLine label="세금봉투에 모음" value={won(prepared)} strong />
                {taxReady ? (
                  <TaxLine label="여유분" value={`+${won(prepared - a.additionalDue)}`} accent />
                ) : (
                  <TaxLine label="앞으로 모을 금액" value={won(a.additionalDue - prepared)} />
                )}
              </View>
            </View>
          );
        })()}
      </Card>

      {/* 계산 가정 */}
      <View style={{ backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.dash, borderStyle: 'dashed', borderRadius: 14, padding: 14 }}>
        <Text style={{ fontSize: 12, color: colors.sub, lineHeight: 21, fontWeight: '500' }}>
          <Text style={{ fontWeight: '800', color: colors.ink2 }}>계산 가정 · 검증 가능한 산수</Text>{'\n'}
          연매출 3,000만 · 단순경비율 적용 → 과세표준 2,100만{'\n'}
          소득세 + 지방소득세 10% 포함 = {won(a.totalTax).replace('₩', '')}{'\n'}
          기납부 3.3% ({won(a.alreadyWithheld).replace('₩', '')}) 차감 → 추가납부 {won(a.additionalDue).replace('₩', '')}
        </Text>
      </View>

      {/* 파킹통장 연결 — 자동 봉투 상품화 */}
      <Pressable onPress={() => actions.openProduct('parking')} style={{ backgroundColor: colors.green, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: colors.green, shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: 'rgba(255,255,255,.85)' }}>이 돈, 어디에 둘까요?</Text>
          <Text style={{ fontSize: 15.5, fontWeight: '800', color: '#fff', marginTop: 3, letterSpacing: -0.3 }}>하나 긱워커 파킹통장</Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,.85)', marginTop: 3 }}>연 3.0% 우대 · 언제든 인출 · 5월 종소세 대비 금고</Text>
        </View>
        <Icon name="arrowRight" size={20} color="#fff" sw={2.2} />
      </Pressable>
    </View>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14 }}>
      <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 17, fontWeight: '800', letterSpacing: -0.4, marginTop: 3, color: colors.ink, ...T.num }}>{value}</Text>
    </View>
  );
}
function TaxLine({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.greenInk }}>{label}</Text>
      <Text style={{ fontSize: strong ? 14.5 : 13, fontWeight: strong ? '800' : '700', color: accent ? colors.green : colors.greenInk, ...T.num }}>{value}</Text>
    </View>
  );
}
function KV({ k, v, vColor, border }: { k: string; v: string; vColor?: string; border?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: border ? 1 : 0, borderBottomColor: colors.line }}>
      <Text style={{ fontSize: 13.5, color: colors.sub, fontWeight: '600' }}>{k}</Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: vColor || colors.ink, ...T.num }}>{v}</Text>
    </View>
  );
}
