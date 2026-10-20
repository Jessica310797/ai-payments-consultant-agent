import { ArrowDown, ArrowUp } from 'lucide-react';
import type { Change } from '../../lib/metrics';

/** Change vs the comparison period. `upIsGood` sets the colour: more sales is good, more cost is bad. */
export function Delta({ change, upIsGood, compareLabel }: { change: Change | null; upIsGood: boolean; compareLabel: string }) {
  if (!change || change.delta == null) return <p className="mt-1 text-[12px] text-subtle">No comparison</p>;
  const d = change.delta;
  const up = d >= 0;
  const good = up === upIsGood;
  const text = change.unit === 'pp' ? `${Math.abs(d).toFixed(2)} pp` : `${Math.abs(d).toFixed(1)}%`;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <div>
      <p className={`mt-1 inline-flex items-center gap-1 text-[13px] font-medium ${good ? 'text-brand' : 'text-danger'}`}>
        <Icon size={14} aria-hidden />
        <span>
          <span className="sr-only">{up ? 'Up' : 'Down'} </span>
          {text}
        </span>
      </p>
      <p className="text-[11px] text-subtle">vs {compareLabel}</p>
    </div>
  );
}
