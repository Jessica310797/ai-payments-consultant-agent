import { AppHeader } from '../components/layout/AppHeader';
import { DataGate } from '../components/layout/DataGate';
import { AuditCard } from '../components/dashboard/AuditCard';
import { CostDriversCard } from '../components/dashboard/CostDriversCard';
import { NextActions } from '../components/dashboard/NextActions';
import { OctoberPanel } from '../components/dashboard/OctoberPanel';
import { SummaryCard } from '../components/dashboard/SummaryCard';
import { Provenance } from '../components/ui/Provenance';
import { EmptyState } from '../components/ui/States';
import { useData } from '../state/DataContext';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const { data, derived } = useData();
  return (
    <>
      <AppHeader />
      <div className="mb-4 mt-6">
        <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-subtle">{greeting()}</p>
        <h1 className="mt-1 text-[26px] font-semibold leading-8 tracking-[-0.02em]">Payments overview</h1>
        {data && derived ? <p className="mt-1 text-[15px] text-subtle">{derived.empty ? 'No reporting period' : derived.period.label} · {data.merchant.name}</p> : null}
      </div>
      <DataGate>
        {derived?.empty ? (
          <div className="space-y-4">
            <EmptyState title="No payment data yet" body="Upload a transactions file or a provider invoice to see costs, audit findings and recommended actions." action={{ to: '/audit/upload', label: 'Upload data' }} />
            <OctoberPanel />
          </div>
        ) : (
          <div className="space-y-4">
            <SummaryCard />
            <OctoberPanel />
            <div className="grid gap-4 sm:grid-cols-2">
              <CostDriversCard />
              <AuditCard />
            </div>
            <NextActions />
            <Provenance className="px-1" />
          </div>
        )}
      </DataGate>
    </>
  );
}
