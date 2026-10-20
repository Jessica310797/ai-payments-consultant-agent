import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadDataset, type DemoState } from '../data/source';
import type { Dataset, Invoice, LedgerRecord } from '../data/types';
import { recommendActions, type ActionStatus, type NextAction } from '../lib/actions';
import { runAudit, type Finding } from '../lib/audit';
import { costDrivers, monthlySeries, summarise, varianceSplit, type Driver, type MonthPoint, type Summary, type Variance } from '../lib/metrics';
import { makePeriod, sortedMonths, type Period, type PeriodKey } from '../lib/periods';

type Status = 'loading' | 'error' | 'ready';

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

interface Ctx {
  status: Status;
  error: string | null;
  data: Dataset | null;
  derived: Derived | null;
  periodKey: PeriodKey;
  setPeriodKey: (k: PeriodKey) => void;
  demoState: DemoState;
  setDemoState: (s: DemoState) => void;
  retry: () => void;
  uploaded: { fileName: string; records: LedgerRecord[] } | null;
  useUploaded: (u: { fileName: string; records: LedgerRecord[] } | null) => void;
  addInvoice: (inv: Invoice) => void;
  actionStatus: Record<string, ActionStatus>;
  setActionStatus: (id: string, s: ActionStatus) => void;
  dismissed: string[];
  readNotifications: () => void;
}

const DataCtx = createContext<Ctx | null>(null);

// Per-viewer conveniences only; the app works without storage.
function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeStore(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

const initialDemo = (): DemoState => {
  const q = new URLSearchParams(window.location.search).get('demo');
  return q === 'loading' || q === 'empty' || q === 'error' ? q : 'normal';
};

export function DataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [base, setBase] = useState<Dataset | null>(null);
  const [demoState, setDemoState] = useState<DemoState>(initialDemo);
  const [attempt, setAttempt] = useState(0);
  const [periodKey, setPeriodKeyState] = useState<PeriodKey>(() => readStore<PeriodKey>('pw.period', '1M'));
  const [uploaded, setUploaded] = useState<Ctx['uploaded']>(null);
  const [extraInvoices, setExtraInvoices] = useState<Invoice[]>([]);
  const [actionStatus, setActionStatusState] = useState<Record<string, ActionStatus>>(() => readStore('pw.actions', {}));
  const [dismissed, setDismissed] = useState<string[]>(() => readStore('pw.readNotifications', []));

  useEffect(() => {
    let live = true;
    setStatus('loading');
    setError(null);
    loadDataset(demoState)
      .then((d) => live && (setBase(d), setStatus('ready')))
      .catch((e: Error) => live && (setError(e.message), setStatus('error')));
    return () => {
      live = false;
    };
  }, [demoState, attempt]);

  const data = useMemo<Dataset | null>(() => {
    if (!base) return null;
    if (!uploaded) return { ...base, invoices: [...base.invoices, ...extraInvoices] };
    return {
      ...base,
      meta: { source: `Uploaded file: ${uploaded.fileName}`, isDemo: false, lastUpdated: new Date().toISOString() },
      ledger: uploaded.records,
      invoices: extraInvoices,
      providers: sortedMonths(uploaded.records.map((r) => r.provider)).map((p) => ({ id: p, name: p, role: 'From uploaded file' })),
      benchmarks: [],
    };
  }, [base, uploaded, extraInvoices]);

  const derived = useMemo<Derived | null>(() => {
    if (!data) return null;
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
  }, [data, periodKey]);

  const setPeriodKey = useCallback((k: PeriodKey) => {
    setPeriodKeyState(k);
    writeStore('pw.period', k);
  }, []);
  const setActionStatus = useCallback((id: string, s: ActionStatus) => {
    setActionStatusState((cur) => {
      const next = { ...cur, [id]: s };
      writeStore('pw.actions', next);
      return next;
    });
  }, []);
  const readNotifications = useCallback(() => {
    const ids = derived ? notificationsFor(data!, derived).map((n) => n.id) : [];
    setDismissed(ids);
    writeStore('pw.readNotifications', ids);
  }, [data, derived]);

  const value: Ctx = {
    status, error, data, derived, periodKey, setPeriodKey, demoState, setDemoState,
    retry: () => setAttempt((a) => a + 1),
    uploaded, useUploaded: setUploaded,
    addInvoice: (inv) => setExtraInvoices((cur) => [...cur.filter((i) => i.id !== inv.id), inv]),
    actionStatus, setActionStatus, dismissed, readNotifications,
  };
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export function useData() {
  const v = useContext(DataCtx);
  if (!v) throw new Error('useData must be used inside DataProvider');
  return v;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  link: string;
  tone: 'warning' | 'info';
}

/** Alerts derived from the data: confirmed audit findings, unverified changes, and cost increases. */
export function notificationsFor(d: Dataset, x: Derived): Notice[] {
  const out: Notice[] = [];
  for (const f of x.findings.filter((f) => f.kind === 'confirmed')) out.push({ id: `finding-${f.id}`, title: f.title, body: f.headline, link: `/audit/${f.id}`, tone: 'warning' });
  if (x.before && x.now.cost > x.before.cost * 1.05) {
    out.push({ id: `costs-${x.period.label}`, title: 'Payment costs increased', body: `Costs rose ${(((x.now.cost - x.before.cost) / x.before.cost) * 100).toFixed(1)}% in ${x.period.label}.`, link: '/costs', tone: 'warning' });
  }
  for (const c of d.changes.filter((c) => c.status === 'unverified')) out.push({ id: `change-${c.id}`, title: c.title, body: 'Needs confirming against the official source.', link: `/october/${c.id}`, tone: 'info' });
  return out;
}
