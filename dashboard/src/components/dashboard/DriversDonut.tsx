import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { money } from '@shared/lib/format';
import type { Driver } from '@shared/lib/metrics';

// Sequential greens, darkest for the largest driver
export const DRIVER_COLOURS = ['#1D5C3D', '#2F7D55', '#5E9C7A', '#93BBA3', '#C7D9CC'];

export function DriversDonut({ drivers, total, size = 132 }: { drivers: Driver[]; total: number; size?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Total costs ${money(total)}: ${drivers.map((d) => `${d.label} ${d.share.toFixed(0)}%`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={drivers} dataKey="amount" nameKey="label" innerRadius="66%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
            {drivers.map((d, i) => <Cell key={d.component} fill={DRIVER_COLOURS[i % DRIVER_COLOURS.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => money(Number(v), { exact: true })} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[17px] font-semibold leading-5">{money(total)}</p>
          <p className="text-[11px] text-subtle">total costs</p>
        </div>
      </div>
    </div>
  );
}

export function DriversLegend({ drivers }: { drivers: Driver[] }) {
  return (
    <ol className="min-w-0 flex-1 space-y-2.5" aria-label="Cost drivers, largest first">
      {drivers.map((d, i) => (
        <li key={d.component} className="flex items-center gap-2 text-[13px]">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DRIVER_COLOURS[i % DRIVER_COLOURS.length] }} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{d.label}</span>
          <span className="tabular-nums text-subtle">{d.share.toFixed(0)}%</span>
        </li>
      ))}
    </ol>
  );
}
