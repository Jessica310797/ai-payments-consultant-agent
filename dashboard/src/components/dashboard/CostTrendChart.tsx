import { Area, AreaChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import { money, monthLong, monthShort, pct } from '@shared/lib/format';
import type { MonthPoint } from '@shared/lib/metrics';

const BRAND = '#26734D';

function Tip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as MonthPoint;
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2 text-[12px] shadow-md">
      <p className="font-semibold">{monthLong(p.month)}</p>
      <p>Total costs <span className="font-semibold">{money(p.cost, { exact: true })}</span></p>
      <p className="text-subtle">Effective rate {pct(p.rate)} · Volume {money(p.value)}</p>
    </div>
  );
}

/** Monthly total payment costs. The selected reporting period is shaded. */
export function CostTrendChart({ series, current }: { series: MonthPoint[]; current: string[] }) {
  if (series.length < 2) return <p className="py-8 text-center text-[13px] text-muted">Not enough months to show a trend.</p>;
  const last = series[series.length - 1];
  const max = Math.max(...series.map((s) => s.cost));
  const min = Math.min(...series.map((s) => s.cost));
  const pad = (max - min) * 0.25 || max * 0.1;
  const shade = current.length > 1 ? [current[0], current[current.length - 1]] : null;
  const summary = `Total payment costs by month, ${monthLong(series[0].month)} to ${monthLong(last.month)}: from ${money(series[0].cost)} to ${money(last.cost)}.`;
  return (
    <figure>
      <div className="h-44 w-full" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 34, right: 24, bottom: 0, left: -4 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="#EDEFEB" />
            {shade ? <ReferenceArea x1={shade[0]} x2={shade[1]} fill="#E5EAE2" fillOpacity={0.6} ifOverflow="extendDomain" /> : null}
            <XAxis dataKey="month" tickFormatter={monthShort} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#5F665F' }} interval="preserveStartEnd" />
            <YAxis
              domain={[Math.max(0, Math.floor((min - pad) / 1e4) * 1e4), Math.ceil((max + pad) / 1e4) * 1e4]}
              tickFormatter={(v: number) => money(v)}
              tickLine={false}
              axisLine={false}
              width={52}
              tickCount={4}
              tick={{ fontSize: 12, fill: '#5F665F' }}
            />
            <Tooltip content={<Tip />} cursor={{ stroke: '#C9D0C7' }} />
            <Area
              type="linear"
              dataKey="cost"
              name="Total costs"
              stroke={BRAND}
              strokeWidth={2}
              fill={BRAND}
              fillOpacity={0.05}
              activeDot={{ r: 5, fill: BRAND, stroke: '#fff', strokeWidth: 2 }}
              dot={({ cx, cy, index }: { cx?: number; cy?: number; index?: number }) => (
                <g key={index}>
                  <circle cx={cx} cy={cy} r={3} fill={BRAND} />
                  {index === series.length - 1 ? (
                    <>
                      <rect x={Number(cx) - 30} y={Number(cy) - 32} width={60} height={22} rx={6} fill="#fff" stroke="#C9D7CC" />
                      <text x={Number(cx)} y={Number(cy) - 17} textAnchor="middle" fontSize={12} fontWeight={600} fill="#1D5C3D">{money(last.cost)}</text>
                    </>
                  ) : null}
                </g>
              )}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        <table>
          <caption>{summary}</caption>
          <thead><tr><th>Month</th><th>Total costs</th><th>Effective rate</th></tr></thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.month}><td>{monthLong(s.month)}</td><td>{money(s.cost, { exact: true })}</td><td>{pct(s.rate)}</td></tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
