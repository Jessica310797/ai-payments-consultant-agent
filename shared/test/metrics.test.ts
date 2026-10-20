import { describe, expect, it } from 'vitest';
import { ledger } from '../data/fixtures/ledger';
import type { LedgerRecord } from '../data/types';
import { importTransactions } from '../lib/csv';
import { costDrivers, summarise, varianceSplit } from '../lib/metrics';
import { makePeriod } from '../lib/periods';

const rec = (month: string, segment: LedgerRecord['segment'], value: number, rate: number, expectedRate = rate): LedgerRecord => ({
  month, provider: 'A', segment, transactions: Math.round(value / 50), value,
  fees: { acquiring: value * rate, interchange: 0, scheme: 0, processor: 0, other: 0 },
  expected: { acquiring: value * expectedRate, interchange: 0, scheme: 0, processor: 0, other: 0 },
});

describe('periods', () => {
  const months = Array.from(new Set(ledger.map((r) => r.month)));
  it('compares with the equally long period just before', () => {
    expect(makePeriod('1M', months)).toMatchObject({ current: ['2026-10'], comparison: ['2026-09'] });
    expect(makePeriod('3M', months)).toMatchObject({ current: ['2026-08', '2026-09', '2026-10'], comparison: ['2026-05', '2026-06', '2026-07'] });
    expect(makePeriod('6M', months).comparison).toEqual(['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04']);
  });
  it('has no comparison when the data is too short', () => {
    expect(makePeriod('3M', ['2026-09', '2026-10']).comparison).toEqual([]);
  });
});

describe('summary', () => {
  it('effective rate = total costs / payment volume', () => {
    const s = summarise(ledger, ['2026-10']);
    expect(s.rate).toBeCloseTo((s.cost / s.value) * 100, 10);
    expect(s.transactions).toBe(248620);
    expect(Math.round(s.value / 1e5) / 10).toBe(18.4);
    expect(Math.round(s.cost / 1e3)).toBe(286);
    expect(s.rate!.toFixed(2)).toBe('1.55');
  });
  it('cost drivers add up to total cost and are ranked', () => {
    const s = summarise(ledger, ['2026-10']);
    const d = costDrivers(s);
    expect(d.reduce((a, x) => a + x.amount, 0)).toBeCloseTo(s.cost, 6);
    expect(d.map((x) => x.amount)).toEqual([...d.map((x) => x.amount)].sort((a, b) => b - a));
  });
});

describe('variance split', () => {
  it('parts add up to the total change on the demo data', () => {
    for (const [cur, cmp] of [[['2026-10'], ['2026-09']], [['2026-08', '2026-09', '2026-10'], ['2026-05', '2026-06', '2026-07']]]) {
      const v = varianceSplit(ledger, cur, cmp)!;
      expect(v.volume + v.mix + v.pricing! + v.unexplained!).toBeCloseTo(v.after - v.before, 6);
    }
  });
  it('isolates volume, mix, pricing and unexplained', () => {
    // Same rates, double the volume → all volume
    let v = varianceSplit([rec('m0', 'visa_debit', 100, 0.01), rec('m1', 'visa_debit', 200, 0.01)], ['m1'], ['m0'])!;
    expect(v).toMatchObject({ volume: 1, mix: 0, pricing: 0, unexplained: 0 });
    // Same total volume moving to a dearer card → all mix
    v = varianceSplit([rec('m0', 'visa_debit', 100, 0.01), rec('m0', 'visa_credit', 100, 0.02), rec('m1', 'visa_debit', 50, 0.01), rec('m1', 'visa_credit', 150, 0.02)], ['m1'], ['m0'])!;
    expect(v.volume).toBeCloseTo(0);
    expect(v.mix).toBeCloseTo(0.5);
    // Contract rate up 1% → 2%, charged as contracted → all pricing
    v = varianceSplit([rec('m0', 'visa_debit', 100, 0.01), rec('m1', 'visa_debit', 100, 0.02)], ['m1'], ['m0'])!;
    expect(v.pricing).toBeCloseTo(1);
    expect(v.unexplained).toBeCloseTo(0);
    // Charged above an unchanged contract → all unexplained
    v = varianceSplit([rec('m0', 'visa_debit', 100, 0.01), rec('m1', 'visa_debit', 100, 0.015, 0.01)], ['m1'], ['m0'])!;
    expect(v.pricing).toBeCloseTo(0);
    expect(v.unexplained).toBeCloseTo(0.5);
  });
});

describe('CSV import', () => {
  it('reads day-first dates, schemes and fees, skipping declines and refunds', () => {
    const csv = 'Date,Amount,Card Scheme,Debit/Credit,Status,Interchange,Scheme Fee,MSF\n'
      + '01/10/2026,"$1,000.00",VISA,Credit,Approved,5,2,3\n'
      + '02/10/2026,50,MC,DR,Approved,0.1,0.05,0.2\n'
      + '03/10/2026,20,eftpos,,Declined,0,0,0\n'
      + '04/10/2026,-30,Visa,Debit,Approved,0,0,0\n';
    const r = importTransactions(csv);
    expect(r.rowsUsed).toBe(2);
    expect(r.records.find((x) => x.segment === 'visa_credit')).toMatchObject({ month: '2026-10', value: 1000, fees: { interchange: 5, scheme: 2, acquiring: 3 } });
    expect(r.records.find((x) => x.segment === 'mc_debit')?.value).toBe(50);
    expect(r.skipped).toEqual([{ reason: 'Not approved', count: 1 }, { reason: 'Refund, zero or unreadable amount', count: 1 }]);
  });
  it('explains missing columns', () => {
    expect(() => importTransactions('foo,bar\n1,2\n')).toThrow(/date, amount, scheme/);
  });
});
