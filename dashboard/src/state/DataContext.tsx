import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadDataset, type DemoState } from '@shared/data/source';
import type { Dataset, Invoice, LedgerRecord } from '@shared/data/types';
import type { ActionStatus } from '@shared/lib/actions';
import { derive, notificationsFor, withUploads, type Derived, type Notice } from '@shared/lib/derive';
import type { PeriodKey } from '@shared/lib/periods';

export { notificationsFor, type Derived, type Notice };

type Status = 'loading' | 'error' | 'ready';


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
  setUploadedData: (u: { fileName: string; records: LedgerRecord[] } | null) => void;
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

  const data = useMemo<Dataset | null>(
    () => (base ? withUploads(base, uploaded ? { source: `Uploaded file: ${uploaded.fileName}`, records: uploaded.records } : null, extraInvoices) : null),
    [base, uploaded, extraInvoices],
  );

  const derived = useMemo<Derived | null>(() => (data ? derive(data, periodKey) : null), [data, periodKey]);

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
    uploaded, setUploadedData: setUploaded,
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

/** Where a notification leads in this app. */
export function noticePath(n: Notice): string {
  return n.target.screen === 'finding' ? `/audit/${n.target.id}` : n.target.screen === 'change' ? `/october/${n.target.id}` : '/costs';
}
