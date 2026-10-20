import { DataGate } from '../components/layout/DataGate';
import { Card, CardHeader } from '../components/ui/Card';
import { PeriodSelector } from '../components/ui/PeriodSelector';
import { Provenance } from '../components/ui/Provenance';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { EmptyState } from '../components/ui/States';
import { Table, Td } from '../components/ui/Table';
import { CostTrendChart } from '../components/dashboard/CostTrendChart';
import { count, money, monthMid, pct } from '@shared/lib/format';
import { summarise } from '@shared/lib/metrics';
import { COMPONENTS } from '@shared/lib/segments';
import { useData } from '../state/DataContext';

const signed = (v: number) => `${v >= 0 ? '+' : '−'}${money(Math.abs(v), { exact: true })}`;

function VarianceBars() {
  const { derived } = useData();
  const v = derived!.variance;
  if (!v) return <p className="text-[13px] text-muted">There's no earlier period of the same length to compare with.</p>;
  const parts = [
    { label: 'Transaction volume', help: 'More or fewer sales, at the previous average rate', value: v.volume },
    { label: 'Card mix', help: 'Shift between card types and providers, at previous rates', value: v.mix },
    ...(v.pricing != null
      ? [
          { label: 'Provider pricing changes', help: 'Contracted or published rate changes', value: v.pricing },
          { label: 'Unexplained', help: 'Charges that volume, mix and contracted pricing don\'t explain', value: v.unexplained! },
        ]
      : [{ label: 'Rate changes', help: 'Pricing and unexplained changes - add contracted rates to split them', value: v.rateChange }]),
  ];
  const max = Math.max(...parts.map((p) => Math.abs(p.value)), 1);
  return (
    <div>
      <p className="mb-3 text-[14px]">
        Costs went from <strong>{money(v.before, { exact: true })}</strong> to <strong>{money(v.after, { exact: true })}</strong> ({signed(v.after - v.before)}).
      </p>
      <ul className="space-y-3">
        {parts.map((p) => (
          <li key={p.label}>
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="font-medium">{p.label}</span>
              <span className={`tabular-nums font-semibold ${p.value > 0 ? 'text-danger' : 'text-brand'}`}>{signed(p.value)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-[#EEF0EC]" aria-hidden>
              <div className={`h-2 rounded-full ${p.value > 0 ? 'bg-danger' : 'bg-brand'}`} style={{ width: `${(Math.abs(p.value) / max) * 100}%` }} />
            </div>
            <p className="mt-1 text-[12px] text-subtle">{p.help}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Costs() {
  const { data, derived } = useData();
  return (
    <>
      <ScreenHeader title="Payment costs" subtitle={derived ? `${derived.period.label} vs ${derived.period.comparisonLabel}` : undefined} />
      <DataGate>
        {derived?.empty || !data || !derived ? (
          <EmptyState title="No cost data" body="Upload transactions or invoices to see payment costs." action={{ to: '/audit/upload', label: 'Upload data' }} />
        ) : (
          <div className="space-y-4">
            <PeriodSelector />
            <Card labelledBy="cmp">
              <CardHeader id="cmp" title="Period comparison" subtitle={`Now = ${derived.period.label}. Before = ${derived.period.comparisonLabel}, the period of the same length just before. Effective cost rate = total payment costs ÷ payment volume.`} />
              <Table caption="Current period compared with the comparison period" head={['', 'Now', 'Before', 'Change']}>
                {[
                  ['Transactions', count(derived.now.transactions), derived.before ? count(derived.before.transactions) : '—', derived.before ? pct(((derived.now.transactions - derived.before.transactions) / derived.before.transactions) * 100, 1) : '—', undefined],
                  ['Volume', money(derived.now.value), derived.before ? money(derived.before.value) : '—', derived.before ? pct(((derived.now.value - derived.before.value) / derived.before.value) * 100, 1) : '—', undefined],
                  ['Payment costs', money(derived.now.cost), derived.before ? money(derived.before.cost) : '—', derived.before ? pct(((derived.now.cost - derived.before.cost) / derived.before.cost) * 100, 1) : '—', 'bad'],
                  ['Effective rate', pct(derived.now.rate), derived.before ? pct(derived.before.rate) : '—', derived.before && derived.now.rate != null && derived.before.rate != null ? `${(derived.now.rate - derived.before.rate).toFixed(2)} pp` : '—', 'bad'],
                ].map(([l, a, b, c, tone]) => (
                  <tr key={l}><Td first>{l}</Td><Td strong>{a}</Td><Td>{b}</Td><Td tone={tone as 'bad' | undefined}>{c}</Td></tr>
                ))}
              </Table>
            </Card>
            <Card labelledBy="why">
              <CardHeader id="why" title="What changed the cost" subtitle="The four parts add up to the total change." />
              <VarianceBars />
            </Card>
            <Card labelledBy="comp">
              <CardHeader id="comp" title="By fee type" />
              <Table caption="Fees by type" head={['Fee type', 'Now', 'Before', 'Change']}>
                {COMPONENTS.map((c) => {
                  const a = derived.now.fees[c.id], b = derived.before?.fees[c.id];
                  return <tr key={c.id}><Td first>{c.label}</Td><Td strong>{money(a, { exact: true })}</Td><Td>{b != null ? money(b, { exact: true }) : '—'}</Td><Td tone={b != null && a > b ? 'bad' : 'good'}>{b ? pct(((a - b) / b) * 100, 1) : '—'}</Td></tr>;
                })}
              </Table>
            </Card>
            <Card labelledBy="prov">
              <CardHeader id="prov" title="By provider" />
              <Table caption="Effective rate by provider" head={['Provider', 'Costs', 'Rate', 'Before']}>
                {data.providers.map((p) => {
                  const rs = data.ledger.filter((r) => r.provider === p.id);
                  const a = summarise(rs, derived.period.current), b = derived.period.comparison.length ? summarise(rs, derived.period.comparison) : null;
                  return <tr key={p.id}><Td first>{p.name}<span className="block text-[11px] text-subtle">{p.role}</span></Td><Td>{money(a.cost)}</Td><Td strong>{pct(a.rate)}</Td><Td>{b ? pct(b.rate) : '—'}</Td></tr>;
                })}
              </Table>
            </Card>
            <Card labelledBy="trend">
              <CardHeader id="trend" title="Monthly trend" />
              <CostTrendChart series={derived.series} current={derived.period.current} />
              <Table className="mt-3" caption="Monthly totals" head={['Month', 'Volume', 'Costs', 'Rate']}>
                {[...derived.series].reverse().map((s) => <tr key={s.month}><Td first>{monthMid(s.month)}</Td><Td>{money(s.value)}</Td><Td>{money(s.cost, { exact: true })}</Td><Td strong>{pct(s.rate)}</Td></tr>)}
              </Table>
            </Card>
            <Provenance />
          </div>
        )}
      </DataGate>
    </>
  );
}
