import { ChevronRight, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataGate } from '../components/layout/DataGate';
import { FindingIcon, KindBadge } from '../components/dashboard/FindingIcon';
import { Badge, cap, confidenceTone } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { PeriodSelector } from '../components/ui/PeriodSelector';
import { Provenance } from '../components/ui/Provenance';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import type { Finding } from '@shared/lib/audit';
import { money } from '@shared/lib/format';
import { useData } from '../state/DataContext';

function Group({ title, help, items }: { title: string; help: string; items: Finding[] }) {
  if (!items.length) return null;
  return (
    <section aria-label={title}>
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <p className="mb-2 text-[13px] text-subtle">{help}</p>
      <ul className="space-y-3">
        {items.map((f) => (
          <li key={f.id}>
            <Link to={`/audit/${f.id}`} className="flex gap-3 rounded-2xl border border-line bg-card p-4 hover:border-[#CBD3C9]">
              <FindingIcon f={f} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-semibold">{f.title}</span>
                  <KindBadge f={f} />
                </span>
                <span className="mt-1 block text-[13px] text-subtle">{f.headline}</span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {f.variance ? <Badge tone="neutral">{money(Math.abs(f.variance))} {f.varianceBasis === 'a year' ? 'a year' : `in ${f.varianceBasis}`}</Badge> : null}
                  <Badge tone={confidenceTone(f.confidence)}>{cap(f.confidence)} confidence</Badge>
                </span>
              </span>
              <ChevronRight size={18} className="mt-2 shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Audit() {
  const { derived } = useData();
  const f = derived?.findings ?? [];
  return (
    <>
      <ScreenHeader
        title="Audit"
        subtitle={derived && !derived.empty ? `Checks for ${derived.period.label}` : undefined}
        back={false}
        right={
          <Link to="/audit/upload" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-brand px-3 text-[13px] font-medium text-white hover:bg-brand-dark">
            <Upload size={15} aria-hidden /> Upload data
          </Link>
        }
      />
      <DataGate>
        <div className="space-y-5">
          <PeriodSelector />
          <Group title="Confirmed discrepancies" help="Charged differently from the contract or invoice. Money you can ask for back." items={f.filter((x) => x.kind === 'confirmed')} />
          <Group title="Potential opportunities" help="Estimates based on assumptions. Worth checking, not yet owed to you." items={f.filter((x) => x.kind === 'potential')} />
          <Group title="Other checks" help="Checks that found nothing, or need more data." items={f.filter((x) => x.kind === 'clear' || x.kind === 'needs-data')} />
          <Card as="div" className="!p-4">
            <p className="text-[13px] text-subtle">
              Fee checks compare each provider's charges with the contracted rates on file. Upload a transactions CSV or a provider invoice to add data to the audit.
            </p>
          </Card>
          <Provenance />
        </div>
      </DataGate>
    </>
  );
}
