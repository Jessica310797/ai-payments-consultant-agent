// Data shapes shared by fixtures, uploads and (later) real data sources.

export type FeeComponent = 'acquiring' | 'interchange' | 'scheme' | 'processor' | 'other';
export type Fees = Record<FeeComponent, number>;

export type SegmentId = 'visa_debit' | 'mc_debit' | 'eftpos_debit' | 'visa_credit' | 'mc_credit' | 'amex_credit' | 'other';

/** One month of one provider's fees for one card segment. */
export interface LedgerRecord {
  month: string; // YYYY-MM
  provider: string;
  segment: SegmentId;
  transactions: number;
  value: number; // card sales, AUD
  fees: Fees; // what was charged
  expected?: Fees; // what the contract / published rates say should have been charged (absent if unknown)
}

export interface Provider {
  id: string;
  name: string;
  role: string;
}

export interface Merchant {
  name: string;
  abn?: string;
  surchargesToday: boolean;
  surchargeRatePct: number;
}

export interface DataMeta {
  source: string; // shown as provenance
  isDemo: boolean;
  lastUpdated: string; // ISO timestamp
}

export interface Invoice {
  id: string;
  provider: string;
  month: string;
  total: number;
  fileName: string;
  status: 'extracted' | 'awaiting-extraction';
}

export type ChangeStatus = 'confirmed' | 'observed' | 'unverified';
export type Applicability = 'applies' | 'likely' | 'not-assessed' | 'does-not-apply';

export interface RegulatoryChange {
  id: string;
  title: string;
  summary: string;
  category: 'regulation' | 'provider-pricing' | 'scheme';
  status: ChangeStatus;
  effectiveDate: string | null; // ISO date
  effectiveDateVerified: boolean;
  source: { label: string; url: string | null };
  affected: string;
  applicability: Applicability;
  applicabilityReason: string;
  nextSteps: string[];
  lastChecked: string;
}

export interface Benchmark {
  provider: string;
  component: FeeComponent;
  lowPct: number;
  medianPct: number;
  highPct: number;
  basis: string;
}

export interface Dataset {
  meta: DataMeta;
  merchant: Merchant;
  providers: Provider[];
  ledger: LedgerRecord[];
  invoices: Invoice[];
  changes: RegulatoryChange[];
  benchmarks: Benchmark[];
  routing: { routableDebitShare: number; basis: string };
}
