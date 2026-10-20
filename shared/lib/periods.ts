import { rangeLabel } from './format';

export type PeriodKey = '1M' | '3M' | '6M';
export const PERIOD_OPTIONS: { key: PeriodKey; label: string; months: number }[] = [
  { key: '1M', label: 'Month', months: 1 },
  { key: '3M', label: '3 months', months: 3 },
  { key: '6M', label: '6 months', months: 6 },
];

export interface Period {
  key: PeriodKey;
  current: string[];
  /** The equally long period immediately before `current`; empty when the data doesn't go back far enough. */
  comparison: string[];
  label: string;
  comparisonLabel: string;
  /** Months shown on the trend chart: comparison + current, at least six. */
  chart: string[];
}

export function sortedMonths(months: Iterable<string>): string[] {
  return Array.from(new Set(months)).sort();
}

export function makePeriod(key: PeriodKey, available: string[]): Period {
  const n = PERIOD_OPTIONS.find((o) => o.key === key)!.months;
  const all = sortedMonths(available);
  const current = all.slice(-n);
  const before = all.slice(0, Math.max(all.length - n, 0));
  const comparison = before.length >= n ? before.slice(-n) : [];
  const chartLen = Math.max(6, n * 2);
  return {
    key,
    current,
    comparison,
    label: rangeLabel(current),
    comparisonLabel: comparison.length ? rangeLabel(comparison) : 'no earlier data',
    chart: all.slice(-chartLen),
  };
}
