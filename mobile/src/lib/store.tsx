import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Check, Draft, Page, Report } from './types';

/** The merchant check in progress: statement pages → draft figures → confirmed report. */
interface Visit {
  id: string | null;
  pages: Page[];
  draft: Draft | null;
  checks: Check[];
  notes: string;
  report: Report | null;
}

const empty: Visit = { id: null, pages: [], draft: null, checks: [], notes: '', report: null };

const Ctx = createContext<{ visit: Visit; update: (v: Partial<Visit>) => void; reset: () => void } | null>(null);

export function VisitProvider({ children }: { children: ReactNode }) {
  const [visit, setVisit] = useState<Visit>(empty);
  const value = useMemo(
    () => ({
      visit,
      update: (v: Partial<Visit>) => setVisit((cur) => ({ ...cur, ...v })),
      reset: () => setVisit(empty),
    }),
    [visit],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVisit() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useVisit must be used inside VisitProvider');
  return v;
}
