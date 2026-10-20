import { DataGate } from '../components/layout/DataGate';
import { DriversDonut, DriversLegend } from '../components/dashboard/DriversDonut';
import { Card, CardHeader } from '../components/ui/Card';
import { PeriodSelector } from '../components/ui/PeriodSelector';
import { Provenance } from '../components/ui/Provenance';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { EmptyState } from '../components/ui/States';
import { Table, Td } from '../components/ui/Table';
import { money, pct } from '../lib/format';
import { summarise } from '../lib/metrics';
import { useData } from '../state/DataContext';

export default function Drivers() {
  const { data, derived } = useData();
  return (
    <>
      <ScreenHeader title="Cost drivers" subtitle={derived?.period.label} />
      <DataGate>
        {!data || !derived || derived.empty ? (
          <EmptyState title="No cost data" body="Upload transactions or invoices to see what drives payment costs." action={{ to: '/audit/upload', label: 'Upload data' }} />
        ) : (
          <div className="space-y-4">
            <PeriodSelector />
            <Card>
              <div className="flex flex-col items-center gap-5 sm:flex-row">
                <DriversDonut drivers={derived.drivers} total={derived.now.cost} size={170} />
                <DriversLegend drivers={derived.drivers} />
              </div>
            </Card>
            <Card labelledBy="ranked">
              <CardHeader id="ranked" title="Ranked by amount" subtitle="Share of total payment costs, and each as a % of payment volume." />
              <Table caption="Cost drivers ranked" head={['Fee type', 'Amount', 'Share', '% of vol.', 'Before']}>
                {derived.drivers.map((d) => (
                  <tr key={d.component}>
                    <Td first>{d.label}</Td><Td strong>{money(d.amount, { exact: true })}</Td><Td>{pct(d.share, 1)}</Td>
                    <Td>{pct((d.amount / derived.now.value) * 100, 3)}</Td>
                    <Td>{derived.before ? pct((derived.before.fees[d.component] / derived.before.value) * 100, 3) : '—'}</Td>
                  </tr>
                ))}
              </Table>
            </Card>
            <Card labelledBy="byprov">
              <CardHeader id="byprov" title="By provider" />
              <Table caption="Fee types by provider" head={['Provider', ...derived.drivers.map((d) => d.label.replace(' fees', ''))]}>
                {data.providers.map((p) => {
                  const s = summarise(data.ledger.filter((r) => r.provider === p.id), derived.period.current);
                  return <tr key={p.id}><Td first>{p.name}</Td>{derived.drivers.map((d) => <Td key={d.component}>{money(s.fees[d.component])}</Td>)}</tr>;
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
