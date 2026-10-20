// DEMO DATA for a fictional merchant. Replace with the merchant's real details.
import type { Benchmark, DataMeta, Invoice, Merchant, Provider } from '../types';

export const demoMeta: DataMeta = {
  source: 'Demo data (fixtures)',
  isDemo: true,
  lastUpdated: '2026-10-20T09:12:00+10:00',
};

export const demoMerchant: Merchant = {
  name: 'Acme Retail Pty Ltd',
  surchargesToday: true,
  surchargeRatePct: 1.2,
};

export const demoProviders: Provider[] = [
  { id: 'A', name: 'Provider A', role: 'In-store acquiring' },
  { id: 'B', name: 'Provider B', role: 'Online gateway' },
  { id: 'C', name: 'Provider C', role: 'Amex acceptance' },
];

/** Invoice totals as billed. Provider B's October invoice is higher than its transaction-level fees. */
export const demoInvoices: Invoice[] = [
  { id: 'inv-a-2026-10', provider: 'A', month: '2026-10', total: 181168.28, fileName: 'provider-a-oct-2026.pdf', status: 'extracted' },
  { id: 'inv-b-2026-10', provider: 'B', month: '2026-10', total: 78456.59, fileName: 'provider-b-oct-2026.pdf', status: 'extracted' },
  { id: 'inv-c-2026-10', provider: 'C', month: '2026-10', total: 26854.00, fileName: 'provider-c-oct-2026.pdf', status: 'extracted' },
];

/** Illustrative peer ranges for acquiring margin (% of value). Not market data - replace with a real benchmark source. */
export const demoBenchmarks: Benchmark[] = [
  { provider: 'A', component: 'acquiring', lowPct: 0.46, medianPct: 0.58, highPct: 0.7, basis: 'Demo peer range, in-store retail, $10-25m/yr' },
  { provider: 'B', component: 'acquiring', lowPct: 0.55, medianPct: 0.65, highPct: 0.8, basis: 'Demo peer range, online retail, $5-10m/yr' },
  { provider: 'C', component: 'acquiring', lowPct: 1.4, medianPct: 1.65, highPct: 1.9, basis: 'Demo peer range, Amex direct' },
];

/** Least-cost routing assumption: share of Visa/Mastercard debit that is dual-network and can be routed. */
export const demoRouting = {
  routableDebitShare: 0.7,
  basis: 'Assumed 70% of Visa/Mastercard debit is dual-network and can be routed to eftpos. Replace with the share from transaction data.',
};
