import type { Invoice, LedgerRecord, SegmentId } from '../data/types';

/** The confirmed figures from a photographed / PDF statement (same fields as the API's draft). */
export interface StatementFigures {
  merchant_name: string | null;
  acquirer: string | null;
  period_start: string | null;
  period_end: string | null;
  other_fees: number | null;
  total_fees: number | null;
  lines: {
    scheme: 'Visa' | 'Mastercard' | 'Eftpos' | 'Amex' | 'Other';
    card_type: 'debit' | 'credit' | 'all';
    value: number | null;
    transactions: number | null;
    interchange: number | null;
    scheme_fees: number | null;
    acquiring: number | null;
  }[];
}

function segment(scheme: string, cardType: string): SegmentId {
  if (scheme === 'Eftpos') return 'eftpos_debit';
  if (scheme === 'Amex') return 'amex_credit';
  if (scheme === 'Visa' && cardType !== 'all') return cardType === 'credit' ? 'visa_credit' : 'visa_debit';
  if (scheme === 'Mastercard' && cardType !== 'all') return cardType === 'credit' ? 'mc_credit' : 'mc_debit';
  // Visa/Mastercard lines that don't say debit or credit can't be placed in a card type
  return 'other';
}

/** Turns one statement into ledger records (one month, one provider) and an invoice to reconcile against. */
export function statementToLedger(s: StatementFigures, fileName: string): { records: LedgerRecord[]; invoice: Invoice | null; month: string } {
  const month = (s.period_end ?? s.period_start ?? new Date().toISOString()).slice(0, 7);
  const provider = s.acquirer?.trim() || 'Statement';
  const lines = s.lines.filter((l) => (l.value ?? 0) > 0);
  const totalValue = lines.reduce((a, l) => a + (l.value ?? 0), 0);
  const records = new Map<SegmentId, LedgerRecord>();
  for (const l of lines) {
    const seg = segment(l.scheme, l.card_type);
    const r = records.get(seg) ?? { month, provider, segment: seg, transactions: 0, value: 0, fees: { acquiring: 0, interchange: 0, scheme: 0, processor: 0, other: 0 } };
    r.value += l.value ?? 0;
    r.transactions += l.transactions ?? 0;
    r.fees.interchange += l.interchange ?? 0;
    r.fees.scheme += l.scheme_fees ?? 0;
    r.fees.acquiring += l.acquiring ?? 0;
    // Statement-level other fees are shared out by sales value
    r.fees.other += totalValue ? ((s.other_fees ?? 0) * (l.value ?? 0)) / totalValue : 0;
    records.set(seg, r);
  }
  const invoice: Invoice | null = s.total_fees
    ? { id: `statement-${provider}-${month}`, provider, month, total: s.total_fees, fileName, status: 'extracted' }
    : null;
  return { records: Array.from(records.values()), invoice, month };
}
