import { ChevronRight, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataGate } from '../components/layout/DataGate';
import { AppliesBadge, StatusBadge } from '../components/dashboard/ChangeBadges';
import { Card } from '../components/ui/Card';
import { Provenance } from '../components/ui/Provenance';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { EmptyState } from '../components/ui/States';
import { dateLong, pct } from '../lib/format';
import { useData } from '../state/DataContext';

const CATEGORY = { regulation: 'Regulation', 'provider-pricing': 'Provider pricing', scheme: 'Scheme fees' };

export default function October() {
  const { data, derived } = useData();
  const up = derived?.before && derived.before.cost ? ((derived.now.cost - derived.before.cost) / derived.before.cost) * 100 : null;
  return (
    <>
      <ScreenHeader title="October changes" subtitle="Regulation, surcharging and cost updates" back={false} />
      <DataGate>
        {!data?.changes.length ? (
          <EmptyState title="No changes logged" body="Changes from regulators, schemes and providers will appear here." />
        ) : (
          <div className="space-y-4">
            <Card as="div" className="!border-transparent !bg-sage !p-4">
              <p className="text-[13px] leading-5">
                Items marked <strong>To confirm</strong> haven't been checked against the official source yet. Open each one to see the source, whether it applies to
                this merchant and what to do next.
              </p>
            </Card>
            {up != null ? (
              <Link to="/costs" className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 hover:border-[#CBD3C9]">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger"><TrendingUp size={20} aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">Payment cost increases</span>
                  <span className="block text-[13px] text-subtle">Costs {up >= 0 ? 'up' : 'down'} {pct(Math.abs(up), 1)} in {derived!.period.label} vs {derived!.period.comparisonLabel}. See what drove it.</span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
              </Link>
            ) : null}
            <section aria-labelledby="log">
              <h2 id="log" className="mb-2 text-[15px] font-semibold">Change log</h2>
              <ul className="space-y-3">
                {data.changes.map((c) => (
                  <li key={c.id}>
                    <Link to={`/october/${c.id}`} className="block rounded-2xl border border-line bg-card p-4 hover:border-[#CBD3C9]">
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-[12px] text-subtle">{CATEGORY[c.category]}</span>
                          <span className="block text-[15px] font-semibold">{c.title}</span>
                        </span>
                        <ChevronRight size={18} className="mt-3 shrink-0 text-muted" aria-hidden />
                      </span>
                      <span className="mt-1 block text-[13px] leading-5 text-subtle">{c.summary}</span>
                      <span className="mt-3 flex flex-wrap items-center gap-1.5">
                        <StatusBadge s={c.status} />
                        <AppliesBadge a={c.applicability} />
                        <span className="text-[12px] text-subtle">
                          Effective {c.effectiveDate ? dateLong(c.effectiveDate) : 'not set'}{c.effectiveDateVerified ? '' : ' (to confirm)'}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
            <Provenance />
          </div>
        )}
      </DataGate>
    </>
  );
}
