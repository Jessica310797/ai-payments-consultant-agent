export type Scheme = 'Visa' | 'Mastercard' | 'Eftpos' | 'Amex' | 'Other';
export type CardType = 'debit' | 'credit' | 'all';

export interface Line {
  scheme: Scheme;
  card_type: CardType;
  value: number | null;
  transactions: number | null;
  interchange: number | null;
  scheme_fees: number | null;
  acquiring: number | null;
}

export interface Draft {
  merchant_name: string | null;
  acquirer: string | null;
  period_start: string | null;
  period_end: string | null;
  pricing_model: 'interchange_plus_plus' | 'blended' | 'unknown' | null;
  total_card_value: number | null;
  total_transactions: number | null;
  interchange_fees: number | null;
  scheme_fees: number | null;
  acquiring_fees: number | null;
  other_fees: number | null;
  total_fees: number | null;
  lines: Line[];
}

export interface Check {
  level: 'warn' | 'info';
  message: string;
}

export interface Stage {
  interchange: number;
  scheme: number;
  processing: number;
  total: number;
  rate: number;
}

export interface RoutingRow {
  scheme: string;
  value: number;
  shares: Record<string, number>;
}

export interface Report {
  merchant_name: string | null;
  acquirer: string | null;
  period_start: string | null;
  period_end: string | null;
  months: number;
  pricing_model: string | null;
  headline: {
    revenue: number | null;
    volume: number | null;
    atv: number | null;
    total_cost: number | null;
    interchange: number | null;
    scheme_fees: number | null;
    acquiring: number | null;
    other: number | null;
    effective_rate: number | null;
  };
  mix: { card_type: CardType; share: number; schemes: { scheme: string; value: number; count: number; share: number }[] }[];
  routing_now: RoutingRow[];
  routing_suggested: RoutingRow[];
  eftpos_share_now: number | null;
  eftpos_share_suggested: number | null;
  reform: null | {
    stages: { today: Stage; after: Stage; lcr: Stage };
    saving: number;
    routing_saving: number;
    notes: string[];
  };
  surcharge_base: number | null;
  checks: Check[];
}

export interface SavedCheck {
  id: string;
  savedAt: string;
  draft: Draft;
  report: Report;
}

/** A page of the statement picked on the phone: a photo or a PDF. */
export interface Page {
  uri: string;
  name: string;
  type: string;
  file?: File; // web only
}
