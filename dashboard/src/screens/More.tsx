import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import type { DemoState } from '@shared/data/source';
import { dateTime } from '@shared/lib/format';
import { useData } from '../state/DataContext';

const LINKS = [
  { to: '/costs', label: 'Payment costs', help: 'Period comparison and what changed the cost' },
  { to: '/drivers', label: 'Cost drivers', help: 'Fees by type and provider' },
  { to: '/actions', label: 'Recommended actions', help: 'Ranked next steps' },
  { to: '/audit/upload', label: 'Upload data', help: 'Transactions CSV and fee invoices' },
  { to: '/notifications', label: 'Notifications', help: 'Alerts from your data' },
];

export default function More() {
  const { data, uploaded, setUploadedData, demoState, setDemoState } = useData();
  return (
    <>
      <ScreenHeader title="More" back={false} />
      <div className="space-y-4">
        <Card as="div" className="!p-0">
          <ul className="divide-y divide-line">
            {LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#FAFBF9]">
                  <span className="min-w-0 flex-1"><span className="block text-[15px] font-medium">{l.label}</span><span className="block text-[13px] text-subtle">{l.help}</span></span>
                  <ChevronRight size={18} className="text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card labelledBy="src">
          <CardHeader id="src" title="Data source" />
          {data ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
              <dt className="text-subtle">Merchant</dt><dd>{data.merchant.name}</dd>
              <dt className="text-subtle">Source</dt><dd>{data.meta.source}</dd>
              <dt className="text-subtle">Updated</dt><dd>{dateTime(data.meta.lastUpdated)}</dd>
            </dl>
          ) : <p className="text-[13px] text-subtle">Not loaded.</p>}
          {uploaded ? <Button kind="secondary" className="mt-3" onClick={() => setUploadedData(null)}>Switch back to demo data</Button> : null}
        </Card>
        <Card labelledBy="how">
          <CardHeader id="how" title="How the numbers are worked out" />
          <ul className="list-disc space-y-2 pl-5 text-[13px] leading-5 text-subtle">
            <li><strong className="text-ink">Effective cost rate</strong> = total payment costs ÷ payment volume.</li>
            <li><strong className="text-ink">Changes</strong> compare the selected period with the period of the same length just before it.</li>
            <li><strong className="text-ink">What changed the cost</strong> splits the change into transaction volume, card mix, contracted pricing changes and an unexplained remainder; the four parts add up to the total.</li>
            <li><strong className="text-ink">Confirmed discrepancies</strong> are charges above the contracted rates or invoices that don't match transactions. <strong className="text-ink">Opportunities</strong> are estimates and list their assumptions.</li>
            <li>Regulatory items stay <strong className="text-ink">To confirm</strong> until checked against the official source.</li>
          </ul>
        </Card>
        <Card labelledBy="demo">
          <CardHeader id="demo" title="Preview states" subtitle="For testing how screens look while loading, with no data, or when the data service fails." />
          <div role="radiogroup" aria-labelledby="demo" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['normal', 'loading', 'empty', 'error'] as DemoState[]).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={demoState === s} onClick={() => setDemoState(s)}
                className={`min-h-11 rounded-xl border text-[13px] font-medium capitalize ${demoState === s ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line bg-card text-subtle hover:text-ink'}`}>
                {s === 'normal' ? 'Demo data' : s}
              </button>
            ))}
          </div>
        </Card>
        <p className="px-1 text-[12px] text-subtle">PayNavigate · demo build. All figures shown are generated demo data for a fictional merchant.</p>
      </div>
    </>
  );
}
