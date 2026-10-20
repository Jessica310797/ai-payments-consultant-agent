import { useRef, type KeyboardEvent } from 'react';
import { PERIOD_OPTIONS } from '../../lib/periods';
import { useData } from '../../state/DataContext';

/** Segmented radio group: Tab focuses the selected option, arrow keys move between options. */
export function PeriodSelector({ className = '' }: { className?: string }) {
  const { periodKey, setPeriodKey } = useData();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + PERIOD_OPTIONS.length) % PERIOD_OPTIONS.length;
    setPeriodKey(PERIOD_OPTIONS[next].key);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Reporting period" className={`inline-flex rounded-xl bg-[#ECEEEA] p-1 ${className}`}>
      {PERIOD_OPTIONS.map((o, i) => {
        const on = o.key === periodKey;
        return (
          <button
            key={o.key}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => setPeriodKey(o.key)}
            onKeyDown={(e) => onKey(e, i)}
            className={`min-h-9 rounded-lg px-3 text-[13px] font-medium transition-colors ${on ? 'bg-card text-ink shadow-sm' : 'text-subtle hover:text-ink'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
