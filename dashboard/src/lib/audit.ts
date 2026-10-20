import type { Dataset } from '../data/types';
import { money, pct } from './format';
import { feeTotal, overcharges, summarise } from './metrics';
import { componentLabel } from './segments';

export type FindingKind = 'confirmed' | 'potential' | 'clear' | 'needs-data';
export type Confidence = 'high' | 'medium' | 'low';

export interface Finding {
  id: 'discrepancies' | 'reconciliation' | 'benchmarking' | 'routing';
  title: string;
  kind: FindingKind;
  headline: string;
  /** Dollar variance; `varianceBasis` says over what period. */
  variance: number | null;
  varianceBasis: string;
  evidence: string[];
  assumptions: string[];
  confidence: Confidence;
  nextAction: string;
}

const annualise = (v: number, months: number) => (months ? (v * 12) / months : 0);
/** Opportunities smaller than this (a year) aren't worth raising. */
const MIN_OPPORTUNITY = 500;
const providerName = (d: Dataset, id: string) => d.providers.find((p) => p.id === id)?.name ?? id;

export function feeDiscrepancies(d: Dataset, months: string[], label: string): Finding {
  const base = { id: 'discrepancies' as const, title: 'Fee discrepancies', varianceBasis: label, assumptions: [] };
  const by = overcharges(d.ledger, months);
  if (!by.size) {
    return { ...base, kind: 'needs-data', headline: 'Add contracted rates to check fees against them', variance: null, evidence: [],
      confidence: 'low', nextAction: 'Upload a fee schedule or invoice so charges can be compared with the contract.' };
  }
  const evidence: string[] = [];
  let total = 0;
  const providers = new Set<string>();
  for (const [p, comps] of by) {
    for (const [c, x] of comps) {
      const over = x.charged - x.expected;
      if (over < 50) continue;
      total += over;
      providers.add(p);
      const rateNote = c === 'processor'
        ? `${((x.charged / Math.max(x.transactions, 1)) * 100).toFixed(1)}¢ vs ${((x.expected / Math.max(x.transactions, 1)) * 100).toFixed(1)}¢ per transaction`
        : `${pct((x.charged / x.value) * 100)} vs ${pct((x.expected / x.value) * 100)} of affected sales`;
      evidence.push(`${providerName(d, p)} · ${componentLabel(c)}: charged ${money(x.charged, { exact: true })}, contract ${money(x.expected, { exact: true })} (${rateNote}) → +${money(over, { exact: true })}`);
    }
  }
  if (!total) {
    return { ...base, kind: 'clear', headline: 'Charges match the contracted rates', variance: 0, evidence: ['All fee lines are within $50 of the contracted amount.'],
      confidence: 'high', nextAction: 'No action needed. Re-run after the next invoice.' };
  }
  return { ...base, kind: 'confirmed', variance: total,
    headline: `${money(total)} above contracted rates across ${providers.size} provider${providers.size > 1 ? 's' : ''}`,
    evidence, confidence: 'high',
    nextAction: 'Raise a billing dispute with each provider, quoting the contracted rate, and ask for a credit.' };
}

export function invoiceReconciliation(d: Dataset, months: string[], label: string): Finding {
  const base = { id: 'reconciliation' as const, title: 'Invoice reconciliation', varianceBasis: label, assumptions: ['Differences under $50 are treated as rounding.'] };
  const set = new Set(months);
  const invoices = d.invoices.filter((i) => set.has(i.month));
  if (!invoices.length) {
    return { ...base, kind: 'needs-data', headline: 'Upload invoices to reconcile them with transaction-level fees', variance: null, evidence: [],
      confidence: 'low', nextAction: 'Upload each provider\'s invoice for the period (Audit → Upload data).' };
  }
  const evidence: string[] = [];
  let diff = 0, mismatches = 0;
  for (const inv of invoices) {
    if (inv.status !== 'extracted') {
      evidence.push(`${inv.fileName}: received, not read yet - totals can't be compared until it's extracted.`);
      continue;
    }
    const ledgerTotal = d.ledger.filter((r) => r.provider === inv.provider && r.month === inv.month).reduce((a, r) => a + feeTotal(r.fees), 0);
    const gap = inv.total - ledgerTotal;
    if (Math.abs(gap) >= 50) {
      mismatches++;
      diff += gap;
      evidence.push(`${providerName(d, inv.provider)} invoice ${money(inv.total, { exact: true })} vs ${money(ledgerTotal, { exact: true })} in transaction fees → ${gap > 0 ? '+' : ''}${money(gap, { exact: true })}`);
    } else {
      evidence.push(`${providerName(d, inv.provider)} invoice matches transaction fees (${money(inv.total, { exact: true })}).`);
    }
  }
  if (!mismatches) {
    return { ...base, kind: 'clear', headline: 'Invoices match transaction-level fees', variance: 0, evidence, confidence: 'high', nextAction: 'No action needed.' };
  }
  return { ...base, kind: 'confirmed', variance: diff,
    headline: `${money(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} invoiced than the transactions support`,
    evidence, confidence: 'medium',
    nextAction: 'Ask the provider for an itemised breakdown of the invoice lines that don\'t match.' };
}

export function providerBenchmarking(d: Dataset, months: string[]): Finding {
  const s = summarise(d.ledger, months);
  const base = { id: 'benchmarking' as const, title: 'Provider benchmarking', varianceBasis: 'a year' };
  if (!d.benchmarks.length) {
    return { ...base, kind: 'needs-data', headline: 'No benchmark data connected', variance: null, evidence: [], assumptions: [], confidence: 'low',
      nextAction: 'Connect a benchmark source to compare provider pricing.' };
  }
  const evidence: string[] = [], assumptions: string[] = [];
  let saving = 0;
  for (const b of d.benchmarks) {
    const rs = d.ledger.filter((r) => r.provider === b.provider && months.includes(r.month));
    const value = rs.reduce((a, r) => a + r.value, 0);
    if (!value) continue;
    const rate = (rs.reduce((a, r) => a + r.fees[b.component], 0) / value) * 100;
    const gap = rate - b.medianPct;
    assumptions.push(`${providerName(d, b.provider)}: ${b.basis} (median ${pct(b.medianPct)}).`);
    if (gap > 0) {
      const v = annualise((value * gap) / 100, s.months);
      saving += v;
      evidence.push(`${providerName(d, b.provider)} ${componentLabel(b.component).toLowerCase()} ${pct(rate)} vs peer median ${pct(b.medianPct)} → ${money(v)} a year at the median`);
    } else {
      evidence.push(`${providerName(d, b.provider)} ${componentLabel(b.component).toLowerCase()} ${pct(rate)} is at or below the peer median.`);
    }
  }
  const worth = saving >= MIN_OPPORTUNITY;
  return { ...base, kind: worth ? 'potential' : 'clear', variance: saving,
    headline: worth ? `Up to ${money(saving)} a year if pricing moved to the peer median` : 'Pricing is in line with peers',
    evidence, assumptions, confidence: 'low',
    nextAction: worth ? 'Use the benchmark to ask providers for a rate review, or request competing quotes.' : 'No action needed.' };
}

/**
 * Least-cost routing estimate: for each provider that carries eftpos, the (interchange + scheme) rate gap between
 * Visa/Mastercard debit and eftpos, applied to the routable share of Visa/Mastercard debit sales.
 */
export function routingOptimisation(d: Dataset, months: string[]): Finding {
  const base = { id: 'routing' as const, title: 'Routing optimisation', varianceBasis: 'a year' };
  const set = new Set(months);
  const rs = d.ledger.filter((r) => set.has(r.month));
  const n = new Set(rs.map((r) => r.month)).size;
  const evidence: string[] = [];
  let saving = 0;
  for (const p of d.providers) {
    const e = rs.filter((r) => r.provider === p.id && r.segment === 'eftpos_debit');
    const eValue = e.reduce((a, r) => a + r.value, 0);
    if (!eValue) continue;
    const eRate = e.reduce((a, r) => a + r.fees.interchange + r.fees.scheme, 0) / eValue;
    for (const seg of ['visa_debit', 'mc_debit'] as const) {
      const s = rs.filter((r) => r.provider === p.id && r.segment === seg);
      const v = s.reduce((a, r) => a + r.value, 0);
      if (!v) continue;
      const rate = s.reduce((a, r) => a + r.fees.interchange + r.fees.scheme, 0) / v;
      const gain = annualise(v * d.routing.routableDebitShare * Math.max(rate - eRate, 0), n);
      saving += gain;
      evidence.push(`${p.name} ${seg === 'visa_debit' ? 'Visa' : 'Mastercard'} debit: ${pct(rate * 100)} interchange + scheme vs ${pct(eRate * 100)} on eftpos → ${money(gain)} a year`);
    }
  }
  if (!evidence.length) {
    return { ...base, kind: 'needs-data', headline: 'Needs eftpos and Visa/Mastercard debit fees to estimate', variance: null, evidence: [], assumptions: [d.routing.basis],
      confidence: 'low', nextAction: 'Upload transaction data with the debit network for each payment.' };
  }
  const worth = saving >= MIN_OPPORTUNITY;
  return { ...base, kind: worth ? 'potential' : 'clear', variance: saving,
    headline: worth ? `Potential to save ${money(saving)} a year with least-cost routing` : 'No meaningful saving from least-cost routing',
    evidence,
    assumptions: [d.routing.basis,
      'Uses average rates per card type. Actual savings depend on each payment\'s amount, because eftpos and scheme pricing differ between small and large payments.',
      'Assumes each provider supports least-cost routing and processing fees are the same on eftpos.'],
    confidence: 'medium',
    nextAction: worth ? 'Ask each provider to switch on least-cost routing, then check the eftpos share next month.' : 'No action needed.' };
}

export function runAudit(d: Dataset, months: string[], label: string): Finding[] {
  return [feeDiscrepancies(d, months, label), invoiceReconciliation(d, months, label), providerBenchmarking(d, months), routingOptimisation(d, months)];
}
