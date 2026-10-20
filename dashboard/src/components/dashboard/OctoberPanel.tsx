import { CalendarDays, ChevronRight, CreditCard, FileText, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { dateLong } from '../../lib/format';
import { useData } from '../../state/DataContext';
import { Badge, type Tone } from '../ui/Badge';
import { TextLink } from '../ui/Card';

interface Row {
  to: string;
  icon: ReactNode;
  iconBg: string;
  title: string;
  summary: string;
  action: string;
  tone: Tone;
  meta: string;
}

export function OctoberPanel() {
  const { data, derived } = useData();
  if (!data || !derived) return null;
  const surcharge = data.changes.find((c) => c.id === 'surcharging');
  const unverified = data.changes.filter((c) => c.status === 'unverified').length;
  const { now, before } = derived;
  const costUp = before && before.cost ? ((now.cost - before.cost) / before.cost) * 100 : null;

  const rows: Row[] = [
    {
      to: surcharge ? `/october/${surcharge.id}` : '/october',
      icon: <CreditCard size={20} aria-hidden />, iconBg: 'bg-[#EAF1EC] text-brand-dark',
      title: 'Surcharge applicability',
      summary: 'Check which rules apply to your payment methods and customer charges.',
      action: 'Assess applicability', tone: 'amber',
      meta: surcharge
        ? `${surcharge.status === 'unverified' ? 'Unverified' : 'Confirmed'} · Effective ${surcharge.effectiveDate ? dateLong(surcharge.effectiveDate) : 'not set'}${surcharge.effectiveDateVerified ? '' : ' (to confirm)'}`
        : 'Not assessed',
    },
    {
      to: '/costs',
      icon: <TrendingUp size={20} aria-hidden />, iconBg: 'bg-danger-soft text-danger',
      title: 'Payment cost increases',
      summary: 'Investigate changes in processor fees, scheme fees, interchange and effective rates.',
      action: 'Investigate costs', tone: costUp != null && costUp > 0 ? 'danger' : 'neutral',
      meta: costUp != null ? `Seen in your data · Costs ${costUp >= 0 ? 'up' : 'down'} ${Math.abs(costUp).toFixed(1)}% vs ${derived.period.comparisonLabel}` : 'No comparison period',
    },
    {
      to: '/october',
      icon: <FileText size={20} aria-hidden />, iconBg: 'bg-info-soft text-info',
      title: 'Regulatory change log',
      summary: 'Review confirmed changes, effective dates, affected merchants and required actions.',
      action: 'View October updates', tone: 'neutral',
      meta: `${data.changes.length} items · ${unverified} to confirm against the source`,
    },
  ];
  const needsAction = unverified > 0 || (costUp ?? 0) > 0;

  return (
    <section aria-labelledby="october-title" className="rounded-2xl bg-sage p-3 sm:p-4">
      <div className="flex items-start gap-3 px-1 pb-3 pt-1">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-dark text-white" aria-hidden>
          <CalendarDays size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="october-title" className="text-[18px] font-semibold leading-6">October changes</h2>
          <p className="text-[13px] text-subtle">Regulation, surcharging and cost updates</p>
        </div>
        {needsAction ? (
          <Link to="/october" className="inline-flex items-center gap-0.5 rounded-full bg-danger-soft px-3 py-1 text-[12px] font-medium text-danger hover:brightness-95">
            Action required <ChevronRight size={14} aria-hidden />
          </Link>
        ) : null}
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-xl bg-card">
        {rows.map((r) => (
          <li key={r.title}>
            <Link to={r.to} className="flex gap-3 p-4 hover:bg-[#FAFBF9]">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${r.iconBg}`}>{r.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <span className="text-[15px] font-semibold">{r.title}</span>
                  <Badge tone={r.tone}>{r.action}</Badge>
                </span>
                <span className="mt-0.5 block text-[13px] leading-5 text-subtle">{r.summary}</span>
                <span className="mt-1 block text-[12px] text-muted">{r.meta}</span>
              </span>
              <ChevronRight size={18} className="mt-1 shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <div className="px-2 pt-3">
        <TextLink to="/october">See all October updates</TextLink>
      </div>
    </section>
  );
}
