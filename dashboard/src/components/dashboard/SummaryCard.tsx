import { count, money, pct } from '../../lib/format';
import { pctChange, ppChange, type Change } from '../../lib/metrics';
import { useData } from '../../state/DataContext';
import { Card, CardHeader } from '../ui/Card';
import { Delta } from '../ui/Delta';
import { PeriodSelector } from '../ui/PeriodSelector';
import { CostTrendChart } from './CostTrendChart';

export function SummaryCard() {
  const { derived } = useData();
  if (!derived) return null;
  const { now, before, period, series } = derived;
  const metrics: { label: string; value: string; change: Change | null; upIsGood: boolean }[] = [
    { label: 'Total transactions', value: count(now.transactions), change: before ? pctChange(now.transactions, before.transactions) : null, upIsGood: true },
    { label: 'Payment volume', value: money(now.value), change: before ? pctChange(now.value, before.value) : null, upIsGood: true },
    { label: 'Total payment costs', value: money(now.cost), change: before ? pctChange(now.cost, before.cost) : null, upIsGood: false },
    { label: 'Effective cost rate', value: pct(now.rate), change: before ? ppChange(now.rate, before.rate) : null, upIsGood: false },
  ];
  return (
    <Card labelledBy="summary-title">
      <CardHeader id="summary-title" title="Transaction & cost summary" link="/costs" linkLabel="View details" />
      <dl className="grid grid-cols-2 gap-y-4 sm:grid-cols-4">
        {metrics.map((m, i) => (
          <div key={m.label} className={`min-w-0 border-line pr-3 ${i % 2 === 1 ? 'border-l pl-4' : ''} sm:border-l sm:pl-4 ${i === 0 ? 'sm:border-l-0 sm:pl-0' : ''}`}>
            <dt className="text-[13px] text-subtle">{m.label}</dt>
            <dd>
              <p className="mt-1 text-[22px] font-semibold leading-7 tracking-[-0.02em]">{m.value}</p>
              <Delta change={m.change} upIsGood={m.upIsGood} compareLabel={period.comparisonLabel} />
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[13px] font-medium text-subtle">Total payment costs (AUD)</h3>
          <PeriodSelector />
        </div>
        <CostTrendChart series={series} current={period.current} />
      </div>
    </Card>
  );
}
