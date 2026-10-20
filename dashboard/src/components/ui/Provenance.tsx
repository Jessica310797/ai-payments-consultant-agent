import { Database } from 'lucide-react';
import { useData } from '../../state/DataContext';
import { dateTime } from '../../lib/format';

/** Where the numbers come from, which period they cover and when they were last updated. */
export function Provenance({ className = '' }: { className?: string }) {
  const { data, derived } = useData();
  if (!data || !derived) return null;
  const cmp = derived.period.comparison.length ? ` · compared with ${derived.period.comparisonLabel}` : '';
  return (
    <p className={`flex items-start gap-1.5 text-[12px] leading-5 text-subtle ${className}`}>
      <Database size={13} className="mt-[3px] shrink-0" aria-hidden />
      <span>
        {data.meta.source} · Reporting period {derived.period.label}
        {cmp} · Updated {dateTime(data.meta.lastUpdated)}
      </span>
    </p>
  );
}
