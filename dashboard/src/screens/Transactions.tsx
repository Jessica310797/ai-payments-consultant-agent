import { Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataGate } from '../components/layout/DataGate';
import { Card, CardHeader } from '../components/ui/Card';
import { PeriodSelector } from '../components/ui/PeriodSelector';
import { Provenance } from '../components/ui/Provenance';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { EmptyState } from '../components/ui/States';
import { Table, Td } from '../components/ui/Table';
import type { SegmentId } from '../data/types';
import { count, money, pct } from '../lib/format';
import { summarise } from '../lib/metrics';
import { SEGMENTS } from '../lib/segments';
import { useData } from '../state/DataContext';

export default function Transactions() {
  const { data, derived } = useData();
  const segs = data ? (Object.keys(SEGMENTS) as SegmentId[]).filter((s) => data.ledger.some((r) => r.segment === s)) : [];
  return (
    <>
      <ScreenHeader
        title="Transactions"
        subtitle={derived && !derived.empty ? derived.period.label : undefined}
        back={false}
        right={
          <Link to="/audit/upload" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-card px-3 text-[13px] font-medium hover:bg-[#F8F9F7]">
            <Upload size={15} aria-hidden /> Upload
          </Link>
        }
      />
      <DataGate>
        {!data || !derived || derived.empty ? (
          <EmptyState title="No transactions yet" body="Upload a transactions export (CSV) from your provider, gateway or POS." action={{ to: '/audit/upload', label: 'Upload transactions' }} />
        ) : (
          <div className="space-y-4">
            <PeriodSelector />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Transactions', count(derived.now.transactions)],
                ['Payment volume', money(derived.now.value)],
                ['Average sale', money(derived.now.value / Math.max(derived.now.transactions, 1), { exact: true })],
                ['Cost per transaction', `${((derived.now.cost / Math.max(derived.now.transactions, 1)) * 100).toFixed(1)}¢`],
              ].map(([l, v]) => (
                <Card key={l} as="div" className="!p-4">
                  <p className="text-[12px] text-subtle">{l}</p>
                  <p className="mt-1 text-[20px] font-semibold tracking-[-0.02em]">{v}</p>
                </Card>
              ))}
            </div>
            <Card labelledBy="bytype">
              <CardHeader id="bytype" title="By card type" subtitle="Share of payment volume and what each costs." />
              <Table caption="Transactions by card type" head={['Card type', 'Txns', 'Volume', 'Share', 'Cost rate']}>
                {segs.map((s) => {
                  const x = summarise(data.ledger.filter((r) => r.segment === s), derived.period.current);
                  return <tr key={s}><Td first>{SEGMENTS[s].label}</Td><Td>{count(x.transactions)}</Td><Td>{money(x.value)}</Td><Td>{pct((x.value / derived.now.value) * 100, 1)}</Td><Td strong>{pct(x.rate)}</Td></tr>;
                })}
              </Table>
            </Card>
            <Card labelledBy="byprov">
              <CardHeader id="byprov" title="By provider" />
              <Table caption="Transactions by provider" head={['Provider', 'Txns', 'Volume', 'Avg sale']}>
                {data.providers.map((p) => {
                  const x = summarise(data.ledger.filter((r) => r.provider === p.id), derived.period.current);
                  return <tr key={p.id}><Td first>{p.name}<span className="block text-[11px] text-subtle">{p.role}</span></Td><Td>{count(x.transactions)}</Td><Td>{money(x.value)}</Td><Td>{x.transactions ? money(x.value / x.transactions, { exact: true }) : '—'}</Td></tr>;
                })}
              </Table>
            </Card>
            <Provenance />
          </div>
        )}
      </DataGate>
    </>
  );
}
