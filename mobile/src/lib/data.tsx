import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadDataset, type DemoState } from '@shared/data/source';
import type { Dataset, Invoice, LedgerRecord } from '@shared/data/types';
import type { ActionStatus } from '@shared/lib/actions';
import { derive, notificationsFor, withUploads, type Derived, type Notice } from '@shared/lib/derive';
import type { PeriodKey } from '@shared/lib/periods';
import type { Href } from 'expo-router';
import { useAuth } from './auth';
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
  /** Show the fictional demo merchant instead of the signed-in merchant's own data. */
  showDemo: boolean;
  setShowDemo: (v: boolean) => void;
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

/** A signed-in merchant's own dataset: the general change log, plus whatever they've added on this phone. */
function ownDataset(demo: Dataset, merchantName: string): Dataset {
  return {
    ...demo,
    meta: { source: 'Your data on this phone', isDemo: false, lastUpdated: new Date().toISOString() },
    merchant: { name: merchantName, surchargesToday: false, surchargeRatePct: 0 },
    providers: [],
    ledger: [],
    invoices: [],
    benchmarks: [],
    // Demo-only items (a fictional provider's price change) are left out; regulatory items aren't assessed yet
    changes: demo.changes
      .filter((c) => c.category === 'regulation')
      .map((c) => ({ ...c, applicability: 'not-assessed' as const, applicabilityReason: 'Not assessed for your business yet. Add a statement so PayNavigate can check which payment methods it covers.' })),
  };
}

interface Stored {
  uploaded: Uploaded | null;
  invoices: Invoice[];
}
const EMPTY: Stored = { uploaded: null, invoices: [] };

export function DataProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const merchantId = profile?.merchant.id ?? null;
  // The latest load result, tagged with what it was loaded for; anything else is still loading
  const [loaded, setLoaded] = useState<{ key: string; data: Dataset | null; error: string | null } | null>(null);
  const [demoState, setDemoState] = useState<DemoState>('normal');
  const [showDemo, setShowDemoState] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [periodKey, setPeriodKeyState] = useState<PeriodKey>('1M');
  const [storedFor, setStoredFor] = useState<{ key: string | null; value: Stored }>({ key: null, value: EMPTY });
  const [actionStatus, setActionStatusState] = useState<Record<string, ActionStatus>>({});
  const [read, setRead] = useState<string[]>([]);

  useEffect(() => {
    readJson<PeriodKey>(KEYS.period, '1M').then(setPeriodKeyState);
    readJson<Record<string, ActionStatus>>(KEYS.actions, {}).then(setActionStatusState);
    readJson<string[]>(KEYS.read, []).then(setRead);
  }, []);

  // Each merchant's own data is kept on the phone under their merchant id
  const storeKey = merchantId != null ? `pn.merchant.${merchantId}` : null;
  useEffect(() => {
    if (storeKey) readJson<Stored>(storeKey, EMPTY).then((value) => setStoredFor({ key: storeKey, value }));
    readJson<boolean>(`${storeKey ?? 'pn'}.showDemo`, false).then(setShowDemoState);
  }, [storeKey]);
  // Another merchant's data is never shown while this merchant's is being read
  const stored = storedFor.key === storeKey ? storedFor.value : EMPTY;
  // Updates build on the latest saved value, so two changes in a row (statement + its invoice) both stick
  const updateStored = useCallback((change: (cur: Stored) => Stored) => {
    setStoredFor((prev) => {
      const next = change(prev.key === storeKey ? prev.value : EMPTY);
      if (storeKey) writeJson(storeKey, next);
      return { key: storeKey, value: next };
    });
  }, [storeKey]);

  const loadKey = `${demoState}:${attempt}`;
  useEffect(() => {
    let live = true;
    loadDataset(demoState)
      .then((d) => live && setLoaded({ key: loadKey, data: d, error: null }))
      .catch((e: Error) => live && setLoaded({ key: loadKey, data: null, error: e.message }));
    return () => {
      live = false;
    };
  }, [demoState, loadKey]);
  const current = loaded?.key === loadKey ? loaded : null;
  const status: Status = !current ? 'loading' : current.error ? 'error' : 'ready';
  const error = current?.error ?? null;
  const demoBase = current?.data ?? null;

  const data = useMemo(() => {
    if (!demoBase) return null;
    if (showDemo || !profile || demoState !== 'normal') return demoBase;
    return withUploads(ownDataset(demoBase, profile.merchant.name), stored.uploaded, stored.invoices);
  }, [demoBase, showDemo, profile, demoState, stored]);
  const derived = useMemo(() => (data ? derive(data, periodKey) : null), [data, periodKey]);

  const setPeriodKey = useCallback((k: PeriodKey) => {
    setPeriodKeyState(k);
    writeJson(KEYS.period, k);
  }, []);
  const setShowDemo = useCallback((v: boolean) => {
    setShowDemoState(v);
    writeJson(`${storeKey ?? 'pn'}.showDemo`, v);
  }, [storeKey]);
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
    status, error, data, derived, periodKey, setPeriodKey, demoState, setDemoState, showDemo, setShowDemo,
    retry: () => setAttempt((a) => a + 1),
    uploaded: stored.uploaded,
    setUploadedData: (u) => {
      // Adding data switches the dashboard to the merchant's own data
      updateStored((cur) => (u ? { ...cur, uploaded: u } : EMPTY));
      if (u) setShowDemo(false);
    },
    addInvoice: (inv) => updateStored((cur) => ({ ...cur, invoices: [...cur.invoices.filter((i) => i.id !== inv.id), inv] })),
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
