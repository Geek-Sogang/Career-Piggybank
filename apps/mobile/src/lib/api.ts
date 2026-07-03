/**
 * 백엔드(apps/api) 호출 클라이언트.
 * 데모는 온디바이스 엔진(taxEnvelope.ts)으로 동작하지만, 실제 연동 시 이 클라이언트로 전환.
 * API_BASE는 app.config / 환경변수(EXPO_PUBLIC_API_BASE)로 주입.
 */
import Constants from 'expo-constants';

import type { Envelopes } from './taxEnvelope';

export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ??
  (Constants.expoConfig?.extra?.apiBase as string | undefined) ??
  'http://localhost:8000';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export function splitDepositRemote(
  deposit: number,
  annualGross: number,
  expenseRate = 0.3,
  bufferRatio = 0.3
): Promise<Envelopes> {
  return post<Envelopes>('/v1/tax-envelope/split', {
    deposit,
    annual_gross: annualGross,
    expense_rate: expenseRate,
    buffer_ratio: bufferRatio,
  });
}
