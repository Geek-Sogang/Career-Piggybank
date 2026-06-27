import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '@/theme/colors';
import { estimateAnnualTax, splitDeposit, won } from '@/lib/taxEnvelope';

export default function TaxEnvelope() {
  const [deposit, setDeposit] = useState('500000');
  const [annual, setAnnual] = useState('30000000');

  const d = Number(deposit) || 0;
  const a = Number(annual) || 0;

  const annualTax = useMemo(() => estimateAnnualTax(a), [a]);
  const env = useMemo(() => splitDeposit(d, a), [d, a]);

  const rows = [
    { label: '세금봉투', value: env.tax, color: colors.tax, hint: '5월 종소세 추가납부 대비' },
    { label: '경비봉투', value: env.expense, color: colors.expense, hint: '운영 경비 적립' },
    { label: '여윳돈', value: env.buffer, color: colors.buffer, hint: '변동성 버퍼·투자 재원' },
    { label: '즉시가용', value: env.spendable, color: colors.spendable, hint: '지금 써도 되는 돈' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.section}>입력</Text>
      <Field label="입금액 (원)" value={deposit} onChange={setDeposit} />
      <Field label="연 매출 추정 (원)" value={annual} onChange={setAnnual} />

      <Text style={styles.section}>이 입금의 봉투 분류</Text>
      {rows.map((r) => (
        <View key={r.label} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: r.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>{r.label}</Text>
            <Text style={styles.rowHint}>{r.hint}</Text>
          </View>
          <Text style={[styles.rowValue, { color: r.color }]}>{won(r.value)}</Text>
        </View>
      ))}

      <View style={styles.shock}>
        <Text style={styles.shockTitle}>5월 종소세 미리보기</Text>
        <Text style={styles.shockRow}>과세표준(추정) {won(annualTax.taxable)}</Text>
        <Text style={styles.shockRow}>산출세액+지방세 {won(annualTax.totalTax)}</Text>
        <Text style={styles.shockRow}>3.3% 선납 −{won(annualTax.alreadyWithheld)}</Text>
        <Text style={styles.shockDue}>추가납부 예상 {won(annualTax.additionalDue)}</Text>
      </View>

      <Text style={styles.assume}>
        가정 노출 — 경비율 {(env.assumptions.expenseRate * 100).toFixed(0)}% · 여윳돈비율{' '}
        {(env.assumptions.bufferRatio * 100).toFixed(0)}% · 실효 추가세율{' '}
        {(env.assumptions.effectiveTaxRate * 100).toFixed(2)}%. 결정론 산수라 숨은 계산이 없습니다.
      </Text>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        placeholder="0"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 10 },
  section: { fontSize: 13, fontWeight: '700', color: colors.sub, marginTop: 10 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, color: colors.sub },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowLabel: { fontSize: 15, fontWeight: '700', color: colors.ink },
  rowHint: { fontSize: 12, color: colors.sub, marginTop: 1 },
  rowValue: { fontSize: 16, fontWeight: '800' },
  shock: {
    backgroundColor: '#FFF4F4',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F4C7C7',
    marginTop: 8,
    gap: 3,
  },
  shockTitle: { fontSize: 14, fontWeight: '700', color: colors.tax, marginBottom: 4 },
  shockRow: { fontSize: 13, color: colors.sub },
  shockDue: { fontSize: 16, fontWeight: '800', color: colors.tax, marginTop: 4 },
  assume: { fontSize: 12, color: colors.sub, marginTop: 8, lineHeight: 17 },
});
