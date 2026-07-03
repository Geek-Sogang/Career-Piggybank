import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { Card, T } from '@/components/ui';
import { useApp } from '@/store';

export function Ledger() {
  const { actions } = useApp();
  return (
    <View style={{ gap: 14 }}>
      {/* 월 요약 */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.sub }}>2025년 5월</Text>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.buffer, backgroundColor: colors.bufferTint, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, overflow: 'hidden' }}>자동 분류 켜짐</Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '600' }}>일감 매출</Text>
            <Text style={{ fontSize: 19, fontWeight: '800', letterSpacing: -0.4, marginTop: 3, color: colors.ink, ...T.num }}>₩1,700,000</Text>
          </View>
          <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: colors.line, paddingLeft: 14 }}>
            <Text style={{ fontSize: 11.5, color: colors.sub2, fontWeight: '600' }}>지출</Text>
            <Text style={{ fontSize: 19, fontWeight: '800', letterSpacing: -0.4, marginTop: 3, color: colors.ink, ...T.num }}>₩1,240,000</Text>
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
        <ManualTagRow />
        <TxRow badge="커" bg={colors.greenTint} color={colors.green} title="○○커머스" tag="일감 매출 · 자동분류" tagColor={colors.spendable} amount="+₩500,000" onPress={() => actions.openJob('commerce')} />
        <TxRow badge="스" bg={colors.orangeTint} color={colors.orange} title="△△스튜디오" tag="일감 매출 · 자동분류" tagColor={colors.spendable} amount="+₩1,200,000" onPress={() => actions.openJob('studio')} />
        <TxRow badge="구독" bg={colors.line} color={colors.sub} title="Figma 구독" tag="경비 · 소프트웨어" tagColor={colors.sub2} amount="−₩18,000" amountColor={colors.sub2} last small onPress={() => actions.pushScr('txDetail')} />
      </Card>
    </View>
  );
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

function ManualTagRow() {
  const [tag, setTag] = useState<{ label: string; color: string } | null>(null);
  const [open, setOpen] = useState(false);
  const OPTS: { label: string; color: string }[] = [
    { label: '일감 매출', color: colors.spendable },
    { label: '경비', color: colors.expense },
    { label: '개인', color: colors.sub2 },
  ];
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.line2 }}>
      <Pressable onPress={() => { if (!tag) setOpen((o) => !o); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
        <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: colors.bufferTint, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.buffer }}>토스</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>토스페이 정산</Text>
          {tag ? (
            <Text style={{ fontSize: 11.5, color: tag.color, fontWeight: '700', marginTop: 2 }}>{tag.label} · 직접 분류 ✓</Text>
          ) : (
            <Text style={{ fontSize: 11.5, color: colors.orange, fontWeight: '700', marginTop: 2 }}>AI 미분류 · 직접 분류하기</Text>
          )}
        </View>
        <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.ink, ...T.num }}>+₩250,000</Text>
      </Pressable>
      {open && !tag && (
        <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 14, paddingLeft: 50 }}>
          {OPTS.map((o) => (
            <Pressable key={o.label} onPress={() => { setTag(o); setOpen(false); }} style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: 9, borderWidth: 1.4, borderColor: o.color, backgroundColor: '#fff' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: o.color }}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
