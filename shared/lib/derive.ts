import type { Dataset } from '../data/types';
import { recommendActions, type NextAction } from './actions';
import { runAudit, type Finding } from './audit';
import { costDrivers, monthlySeries, summarise, varianceSplit, type Driver, type MonthPoint, type Summary, type Variance } from './metrics';
import { makePeriod, type Period, type PeriodKey } from './periods';

/** Everything the screens show, calculated from one dataset and the selected period. */
export interface Derived {
  period: Period;
  now: Summary;
  before: Summary | null;
  series: MonthPoint[];
  drivers: Driver[];
  variance: Variance | null;
  findings: Finding[];
  actions: NextAction[];
  empty: boolean;
}

export function derive(data: Dataset, periodKey: PeriodKey): Derived {
  const period = makePeriod(periodKey, data.ledger.map((r) => r.month));
  const now = summarise(data.ledger, period.current);
  const before = period.comparison.length ? summarise(data.ledger, period.comparison) : null;
  const variance = varianceSplit(data.ledger, period.current, period.comparison);
  const findings = runAudit(data, period.current, period.label);
  return {
    period, now, before, variance, findings,
    series: monthlySeries(data.ledger, period.chart),
    drivers: costDrivers(now),
    actions: recommendActions(data, now, before, variance, findings, period.label),
    empty: data.ledger.length === 0,
  };
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  /** Route-independent target: the screen and, for detail screens, the item id. */
  target: { screen: 'finding' | 'costs' | 'change'; id?: string };
  tone: 'warning' | 'info';
}

/** Alerts derived from the data: confirmed audit findings, cost increases and unverified changes. */
export function notificationsFor(d: Dataset, x: Derived): Notice[] {
  const out: Notice[] = [];
  for (const f of x.findings.filter((f) => f.kind === 'confirmed')) out.push({ id: `finding-${f.id}`, title: f.title, body: f.headline, target: { screen: 'finding', id: f.id }, tone: 'warning' });
  if (x.before && x.now.cost > x.before.cost * 1.05) {
    out.push({ id: `costs-${x.period.label}`, title: 'Payment costs increased', body: `Costs rose ${(((x.now.cost - x.before.cost) / x.before.cost) * 100).toFixed(1)}% in ${x.period.label}.`, target: { screen: 'costs' }, tone: 'warning' });
  }
  for (const c of d.changes.filter((c) => c.status === 'unverified')) out.push({ id: `change-${c.id}`, title: c.title, body: 'Needs confirming against the official source.', target: { screen: 'change', id: c.id }, tone: 'info' });
  return out;
}

/** Applies an uploaded ledger (and invoices) on top of the base dataset. */
export function withUploads(base: Dataset, uploaded: { source: string; records: Dataset['ledger']; merchantName?: string | null } | null, extraInvoices: Dataset['invoices']): Dataset {
  if (!uploaded) return { ...base, invoices: [...base.invoices, ...extraInvoices] };
  const providers = Array.from(new Set(uploaded.records.map((r) => r.provider))).sort();
  return {
    ...base,
    meta: { source: uploaded.source, isDemo: false, lastUpdated: new Date().toISOString() },
    merchant: uploaded.merchantName ? { ...base.merchant, name: uploaded.merchantName } : base.merchant,
    ledger: uploaded.records,
    invoices: extraInvoices,
    providers: providers.map((p) => ({ id: p, name: p, role: 'From uploaded data' })),
    benchmarks: [],
  };
}
