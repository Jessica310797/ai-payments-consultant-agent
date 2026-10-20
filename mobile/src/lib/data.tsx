import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadDataset, type DemoState } from '@shared/data/source';
import type { Dataset, Invoice, LedgerRecord } from '@shared/data/types';
import type { ActionStatus } from '@shared/lib/actions';
import { derive, notificationsFor, withUploads, type Derived, type Notice } from '@shared/lib/derive';
import type { PeriodKey } from '@shared/lib/periods';
import type { Href } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export { notificationsFor, type Derived, type Notice };

type Status = 'loading' | 'error' | 'ready';
export interface Uploaded {
  source: string;
  records: LedgerRecord[];
  merchantName?: string | null;
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
  uploaded: Uploaded | null;
  setUploadedData: (u: Uploaded | null) => void;
  addInvoice: (inv: Invoice) => void;
  actionStatus: Record<string, ActionStatus>;
  setActionStatus: (id: string, s: ActionStatus) => void;
  read: string[];
  markNotificationsRead: () => void;
}

const DataCtx = createContext<Ctx | null>(null);
const KEYS = { period: 'pn.period', actions: 'pn.actions', read: 'pn.readNotifications' };

// Preferences only: everything works if storage is unavailable.
async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
const writeJson = (key: string, v: unknown) => AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [base, setBase] = useState<Dataset | null>(null);
  const [demoState, setDemoState] = useState<DemoState>('normal');
  const [attempt, setAttempt] = useState(0);
  const [periodKey, setPeriodKeyState] = useState<PeriodKey>('1M');
  const [uploaded, setUploaded] = useState<Uploaded | null>(null);
  const [extraInvoices, setExtraInvoices] = useState<Invoice[]>([]);
  const [actionStatus, setActionStatusState] = useState<Record<string, ActionStatus>>({});
  const [read, setRead] = useState<string[]>([]);

  useEffect(() => {
    readJson<PeriodKey>(KEYS.period, '1M').then(setPeriodKeyState);
    readJson<Record<string, ActionStatus>>(KEYS.actions, {}).then(setActionStatusState);
    readJson<string[]>(KEYS.read, []).then(setRead);
  }, []);

  useEffect(() => {
    let live = true;
    setStatus('loading');
    setError(null);
    loadDataset(demoState)
      .then((d) => {
        if (live) {
          setBase(d);
          setStatus('ready');
        }
      })
      .catch((e: Error) => {
        if (live) {
          setError(e.message);
          setStatus('error');
        }
      });
    return () => {
      live = false;
    };
  }, [demoState, attempt]);

  const data = useMemo(() => (base ? withUploads(base, uploaded, extraInvoices) : null), [base, uploaded, extraInvoices]);
  const derived = useMemo(() => (data ? derive(data, periodKey) : null), [data, periodKey]);

  const setPeriodKey = useCallback((k: PeriodKey) => {
    setPeriodKeyState(k);
    writeJson(KEYS.period, k);
  }, []);
  const setActionStatus = useCallback((id: string, st: ActionStatus) => {
    setActionStatusState((cur) => {
      const next = { ...cur, [id]: st };
      writeJson(KEYS.actions, next);
      return next;
    });
  }, []);
  const markNotificationsRead = useCallback(() => {
    if (!data || !derived) return;
    const ids = notificationsFor(data, derived).map((n) => n.id);
    setRead(ids);
    writeJson(KEYS.read, ids);
  }, [data, derived]);

  const value: Ctx = {
    status, error, data, derived, periodKey, setPeriodKey, demoState, setDemoState,
    retry: () => setAttempt((a) => a + 1),
    uploaded,
    setUploadedData: (u) => {
      setUploaded(u);
      if (!u) setExtraInvoices([]);
    },
    addInvoice: (inv) => setExtraInvoices((cur) => [...cur.filter((i) => i.id !== inv.id), inv]),
    actionStatus, setActionStatus, read, markNotificationsRead,
  };
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export function useData() {
  const v = useContext(DataCtx);
  if (!v) throw new Error('useData must be used inside DataProvider');
  return v;
}

/** Where a notification leads in this app. */
export function noticeHref(n: Notice): Href {
  if (n.target.screen === 'finding') return { pathname: '/finding/[id]', params: { id: n.target.id! } };
  if (n.target.screen === 'change') return { pathname: '/change/[id]', params: { id: n.target.id! } };
  return '/costs';
}
