import { describe, expect, it } from 'vitest';
import { demoChanges } from '../data/fixtures/changes';
import { demoMerchant, demoMeta, demoRouting } from '../data/fixtures/merchant';
import type { Dataset } from '../data/types';
import { derive, withUploads } from '../lib/derive';
import { statementToLedger, type StatementFigures } from '../lib/statement';

const statement: StatementFigures = {
  merchant_name: 'Test Cafe', acquirer: 'Bank X', period_start: '2026-09-01', period_end: '2026-09-30',
  other_fees: 30, total_fees: 330,
  lines: [
    { scheme: 'Visa', card_type: 'debit', value: 10000, transactions: 200, interchange: 20, scheme_fees: 10, acquiring: 50 },
    { scheme: 'Mastercard', card_type: 'credit', value: 5000, transactions: 80, interchange: 40, scheme_fees: 20, acquiring: 60 },
    { scheme: 'Eftpos', card_type: 'all', value: 5000, transactions: 150, interchange: 10, scheme_fees: 5, acquiring: 55 },
    { scheme: 'Amex', card_type: 'all', value: 0, transactions: 0, interchange: null, scheme_fees: null, acquiring: null },
  ],
};

describe('statement → ledger', () => {
  it('maps lines to card segments and shares out other fees by value', () => {
    const { records, invoice, month } = statementToLedger(statement, 'photo.jpg');
    expect(month).toBe('2026-09');
    expect(records.map((r) => r.segment).sort()).toEqual(['eftpos_debit', 'mc_credit', 'visa_debit']);
    expect(records.find((r) => r.segment === 'visa_debit')!.fees.other).toBeCloseTo(15);
    const fees = records.reduce((a, r) => a + Object.values(r.fees).reduce((x, y) => x + y, 0), 0);
    expect(fees).toBeCloseTo(300);
    expect(invoice).toMatchObject({ provider: 'Bank X', month: '2026-09', total: 330 });
  });

  it('feeds the dashboard and reconciles when lines and statement total are within tolerance', () => {
    const { records, invoice } = statementToLedger(statement, 'photo.jpg');
    const base: Dataset = { meta: demoMeta, merchant: demoMerchant, providers: [], ledger: [], invoices: [], changes: demoChanges, benchmarks: [], routing: demoRouting };
    const d = derive(withUploads(base, { source: 'Statement', records }, invoice ? [invoice] : []), '1M');
    expect(d.now.cost).toBeCloseTo(300);
    expect(d.now.rate).toBeCloseTo(1.5);
    expect(d.before).toBeNull();
    expect(withUploads(base, { source: 'S', records, merchantName: 'Test Cafe' }, []).merchant.name).toBe('Test Cafe');
    // 330 billed vs 300 in lines: under the $50 rounding tolerance, so it reconciles
    expect(d.findings.find((f) => f.id === 'reconciliation')!.kind).toBe('clear');
  });
});
