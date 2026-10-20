import { ChevronRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { NextAction } from '../../lib/actions';
import { useData } from '../../state/DataContext';
import { Badge, cap, priorityTone } from '../ui/Badge';
import { TextLink } from '../ui/Card';

export const STATUS_LABEL = { open: 'Not started', 'in-progress': 'In progress', done: 'Done' } as const;

export function ActionCard({ a, rank }: { a: NextAction; rank: number }) {
  const { actionStatus } = useData();
  const status = actionStatus[a.id] ?? 'open';
  return (
    <Link to={`/actions/${a.id}`} className="flex h-full flex-col rounded-xl border border-line bg-card p-4 hover:border-[#CBD3C9]">
      <span className="flex items-start gap-3">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold ${rank === 1 ? 'bg-brand-dark text-white' : 'bg-sage text-brand-dark'}`} aria-label={`Rank ${rank}`}>
          {rank}
        </span>
        <span className="min-w-0 flex-1 text-[14px] font-semibold leading-5">{a.title}</span>
        <ChevronRight size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
      </span>
      <span className="mt-2 block flex-1 text-[13px] leading-5 text-subtle">{a.reason}</span>
      {a.impact ? <span className="mt-2 block text-[12px] font-medium text-ink">Impact: {a.impact}</span> : null}
      <span className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge tone={priorityTone(a.priority)}>{cap(a.priority)} priority</Badge>
        <Badge tone="neutral">{cap(a.confidence)} confidence</Badge>
        <Badge tone={status === 'done' ? 'brand' : status === 'in-progress' ? 'info' : 'neutral'}>{STATUS_LABEL[status]}</Badge>
      </span>
    </Link>
  );
}

export function NextActions() {
  const { derived } = useData();
  if (!derived) return null;
  return (
    <section aria-labelledby="actions-title" className="rounded-2xl bg-sage p-3 sm:p-4">
      <div className="flex items-start gap-3 px-1 pb-3 pt-1">
        <Sparkles size={24} className="mt-0.5 shrink-0 text-brand-dark" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="actions-title" className="text-[16px] font-semibold leading-6">Recommended next actions</h2>
          <p className="text-[13px] text-subtle">Prioritised by potential impact and urgency</p>
        </div>
        <TextLink to="/actions" className="mt-1">View all</TextLink>
      </div>
      <ol className="grid gap-3 sm:grid-cols-3">
        {derived.actions.slice(0, 3).map((a, i) => (
          <li key={a.id}><ActionCard a={a} rank={i + 1} /></li>
        ))}
      </ol>
    </section>
  );
}
