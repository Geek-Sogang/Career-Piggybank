/**
 * 세금봉투 결정론 엔진 (TS 포트).
 *
 * 백엔드 apps/api/app/services/tax_envelope.py 와 동일 로직을 온디바이스로 미러링 —
 * 데모를 백엔드 없이(오프라인) 돌릴 수 있게 하기 위함(기획서 §9-3 "오프라인 빌드").
 * 두 구현이 갈라지지 않도록 수정 시 양쪽을 함께 바꿀 것.
 */

// 2024 종합소득세 누진세율 [과세표준 상한, 세율, 누진공제]
const TAX_BRACKETS: [number, number, number][] = [
  [14_000_000, 0.06, 0],
  [50_000_000, 0.15, 1_260_000],
  [88_000_000, 0.24, 5_760_000],
  [150_000_000, 0.35, 15_440_000],
  [300_000_000, 0.38, 19_940_000],
  [500_000_000, 0.4, 25_940_000],
  [1_000_000_000, 0.42, 35_940_000],
  [Infinity, 0.45, 65_940_000],
];

export const WITHHOLDING_RATE = 0.033;
const LOCAL_TAX_RATE = 0.1;
export const DEFAULT_EXPENSE_RATE = 0.3;
export const DEFAULT_BUFFER_RATIO = 0.3;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function incomeTax(taxable: number): number {
  if (taxable <= 0) return 0;
  for (const [ceiling, rate, quick] of TAX_BRACKETS) {
    if (taxable <= ceiling) return Math.max(0, taxable * rate - quick);
  }
  return 0;
}

export interface AnnualTax {
  annualGross: number;
  expenseRate: number;
  taxable: number;
  incomeTax: number;
  localTax: number;
  totalTax: number;
  alreadyWithheld: number;
  additionalDue: number;
  effectiveTaxRate: number;
}

export function estimateAnnualTax(
  annualGross: number,
  expenseRate: number = DEFAULT_EXPENSE_RATE
): AnnualTax {
  const taxable = annualGross * (1 - expenseRate);
  const inc = incomeTax(taxable);
  const local = inc * LOCAL_TAX_RATE;
  const total = inc + local;
  const withheld = annualGross * WITHHOLDING_RATE;
  const additional = total - withheld;
  return {
    annualGross: round2(annualGross),
    expenseRate,
    taxable: round2(taxable),
    incomeTax: round2(inc),
    localTax: round2(local),
    totalTax: round2(total),
    alreadyWithheld: round2(withheld),
    additionalDue: round2(additional),
    effectiveTaxRate: annualGross ? round2(additional / annualGross * 1e6) / 1e6 : 0,
  };
}

export interface Envelopes {
  deposit: number;
  tax: number;
  expense: number;
  buffer: number;
  spendable: number;
  assumptions: Record<string, number>;
}

export function splitDeposit(
  deposit: number,
  annualGross: number,
  expenseRate: number = DEFAULT_EXPENSE_RATE,
  bufferRatio: number = DEFAULT_BUFFER_RATIO
): Envelopes {
  const annual = estimateAnnualTax(annualGross, expenseRate);
  const tax = deposit * Math.max(0, annual.effectiveTaxRate);
  const expense = deposit * expenseRate;
  const remaining = Math.max(0, deposit - tax - expense);
  const buffer = remaining * bufferRatio;
  const spendable = remaining - buffer;
  return {
    deposit: round2(deposit),
    tax: round2(tax),
    expense: round2(expense),
    buffer: round2(buffer),
    spendable: round2(spendable),
    assumptions: {
      expenseRate,
      bufferRatio,
      withholdingRate: WITHHOLDING_RATE,
      effectiveTaxRate: annual.effectiveTaxRate,
    },
  };
}

export const won = (n: number) => '₩' + Math.round(n).toLocaleString('ko-KR');
