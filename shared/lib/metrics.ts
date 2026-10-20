import type { FeeComponent, Fees, LedgerRecord } from '../data/types';
import { COMPONENTS } from './segments';

export const feeTotal = (f: Fees) => f.acquiring + f.interchange + f.scheme + f.processor + f.other;
const emptyFees = (): Fees => ({ acquiring: 0, interchange: 0, scheme: 0, processor: 0, other: 0 });
const addFees = (a: Fees, b: Fees) => {
  for (const c of COMPONENTS) a[c.id] += b[c.id];
  return a;
};

export interface Summary {
  transactions: number;
  value: number;
  cost: number;
  /** Total payment costs / payment volume, in %. */
  rate: number | null;
  fees: Fees;
  expected: Fees | null;
  months: number;
}

export function summarise(ledger: LedgerRecord[], months: string[]): Summary {
  const set = new Set(months);
  const rs = ledger.filter((r) => set.has(r.month));
  const fees = rs.reduce((a, r) => addFees(a, r.fees), emptyFees());
  const hasExpected = rs.length > 0 && rs.every((r) => r.expected);
  const expected = hasExpected ? rs.reduce((a, r) => addFees(a, r.expected!), emptyFees()) : null;
  const value = rs.reduce((a, r) => a + r.value, 0);
  const cost = feeTotal(fees);
  return {
    transactions: rs.reduce((a, r) => a + r.transactions, 0),
    value,
    cost,
    rate: value > 0 ? (cost / value) * 100 : null,
    fees,
    expected,
    months: new Set(rs.map((r) => r.month)).size,
  };
}

export interface Change {
  /** % change for counts and money; percentage points for rates. */
  delta: number | null;
  unit: '%' | 'pp';
}

export const pctChange = (now: number, before: number): Change => ({ delta: before ? ((now - before) / before) * 100 : null, unit: '%' });
export const ppChange = (now: number | null, before: number | null): Change => ({
  delta: now != null && before != null ? now - before : null,
  unit: 'pp',
});

export interface MonthPoint {
  month: string;
  cost: number;
  value: number;
  transactions: number;
  rate: number | null;
}

export function monthlySeries(ledger: LedgerRecord[], months: string[]): MonthPoint[] {
  return months.map((m) => {
    const s = summarise(ledger, [m]);
    return { month: m, cost: s.cost, value: s.value, transactions: s.transactions, rate: s.rate };
  });
}

export interface Driver {
  component: FeeComponent;
  label: string;
  amount: number;
  share: number;
}

/** Fee components ranked by amount, with their share of total costs. */
export function costDrivers(s: Summary): Driver[] {
  return COMPONENTS.map((c) => ({ component: c.id, label: c.label, amount: s.fees[c.id], share: s.cost ? (s.fees[c.id] / s.cost) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export interface Variance {
  before: number;
  after: number;
  /** More (or less) sales at the comparison period's average rate. */
  volume: number;
  /** Shift in which providers / card types the sales went through, at the comparison period's rates. */
  mix: number;
  /** Change in contracted / published rates. Null when the data has no expected fees. */
  pricing: number | null;
  /** What's left: charges that neither volume, mix nor contracted pricing explain. */
  unexplained: number | null;
  /** pricing + unexplained, when they can't be told apart. */
  rateChange: number;
}

/**
 * Splits the change in total cost between two periods. Each provider × card segment is one line:
 *   volume      = C0 × (V1/V0 − 1)
 *   mix         = Σ v1ᵢ·r0ᵢ − C0 × V1/V0        (r0ᵢ = actual cost rate of line i before)
 *   pricing     = Σ v1ᵢ·(k1ᵢ − k0ᵢ)             (kᵢ = expected / contracted cost rate of line i)
 *   unexplained = (C1 − C0) − volume − mix − pricing
 * The four parts add up exactly to the total change.
 */
export function varianceSplit(ledger: LedgerRecord[], current: string[], comparison: string[]): Variance | null {
  if (!comparison.length) return null;
  const key = (r: LedgerRecord) => `${r.provider}|${r.segment}`;
  const agg = (months: string[]) => {
    const set = new Set(months), out = new Map<string, { v: number; c: number; e: number | null }>();
    for (const r of ledger) {
      if (!set.has(r.month)) continue;
      const k = key(r), cur = out.get(k) ?? { v: 0, c: 0, e: 0 };
      cur.v += r.value;
      cur.c += feeTotal(r.fees);
      cur.e = r.expected && cur.e != null ? cur.e + feeTotal(r.expected) : null;
      out.set(k, cur);
    }
    return out;
  };
  const p0 = agg(comparison), p1 = agg(current);
  const sum = (m: Map<string, { v: number; c: number }>, f: 'v' | 'c') => Array.from(m.values()).reduce((a, x) => a + x[f], 0);
  const V0 = sum(p0, 'v'), V1 = sum(p1, 'v'), C0 = sum(p0, 'c'), C1 = sum(p1, 'c');
  if (!V0) return null;
  const avg0 = C0 / V0;
  const volume = C0 * (V1 / V0 - 1);
  let atOldRates = 0, pricing: number | null = 0;
  for (const [k, l1] of p1) {
    const l0 = p0.get(k);
    const r0 = l0 && l0.v ? l0.c / l0.v : avg0;
    atOldRates += l1.v * r0;
    if (pricing != null) {
      if (l1.e == null || (l0 && l0.e == null)) pricing = null;
      else if (l0 && l0.v && l1.v) pricing += l1.v * (l1.e / l1.v - l0.e! / l0.v);
    }
  }
  const mix = atOldRates - C0 * (V1 / V0);
  const rateChange = C1 - C0 - volume - mix;
  return { before: C0, after: C1, volume, mix, pricing, unexplained: pricing == null ? null : rateChange - pricing, rateChange };
}

/** Charged minus expected, per provider and component, for the given months (only where expected fees are known). */
export function overcharges(ledger: LedgerRecord[], months: string[]) {
  const set = new Set(months);
  const out = new Map<string, Map<FeeComponent, { charged: number; expected: number; value: number; transactions: number }>>();
  for (const r of ledger) {
    if (!set.has(r.month) || !r.expected) continue;
    const byComp = out.get(r.provider) ?? new Map();
    for (const c of COMPONENTS) {
      const cur = byComp.get(c.id) ?? { charged: 0, expected: 0, value: 0, transactions: 0 };
      cur.charged += r.fees[c.id];
      cur.expected += r.expected[c.id];
      if (r.fees[c.id] - r.expected[c.id] > 0.005) {
        cur.value += r.value;
        cur.transactions += r.transactions;
      }
      byComp.set(c.id, cur);
    }
    out.set(r.provider, byComp);
  }
  return out;
}
