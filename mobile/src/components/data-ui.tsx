import { dateTime } from '@shared/lib/format';
import type { Change } from '@shared/lib/metrics';
import { PERIOD_OPTIONS } from '@shared/lib/periods';
import { ArrowDown, ArrowUp, Database } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useData } from '../lib/data';
import { C } from '../lib/theme';
import { ErrorState, LoadingState, Segmented, Text } from './ui';

/** Shows the loading and error states; renders children once data is ready. */
export function DataGate({ children }: { children: ReactNode }) {
  const { status, error, retry } = useData();
  if (status === 'loading') return <LoadingState />;
  if (status === 'error') return <ErrorState message={error ?? 'Unknown error'} onRetry={retry} />;
  return <>{children}</>;
}

export function PeriodSelector() {
  const { periodKey, setPeriodKey } = useData();
  return <Segmented label="Reporting period" options={PERIOD_OPTIONS.map((o) => ({ key: o.key, label: o.label }))} value={periodKey} onChange={setPeriodKey} />;
}

/** Where the numbers come from, which period they cover and when they were last updated. */
export function Provenance() {
  const { data, derived } = useData();
  if (!data || !derived) return null;
  const cmp = derived.period.comparison.length ? ` · compared with ${derived.period.comparisonLabel}` : '';
  return (
    <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 2 }}>
      <Database size={13} color={C.subtle} style={{ marginTop: 3 }} />
      <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: C.subtle }}>
        {data.meta.source} · Reporting period {derived.period.label}
        {cmp} · Updated {dateTime(data.meta.lastUpdated)}
      </Text>
    </View>
  );
}

/** Change vs the comparison period. `upIsGood` sets the colour: more sales is good, more cost is bad. */
export function Delta({ change, upIsGood, compareLabel }: { change: Change | null; upIsGood: boolean; compareLabel: string }) {
  if (!change || change.delta == null) return <Text style={{ fontSize: 12, color: C.subtle, marginTop: 4 }}>No comparison</Text>;
  const d = change.delta;
  const up = d >= 0;
  const colour = up === upIsGood ? C.brand : C.danger;
  const text = change.unit === 'pp' ? `${Math.abs(d).toFixed(2)} pp` : `${Math.abs(d).toFixed(1)}%`;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <View style={{ marginTop: 4 }} accessible accessibilityLabel={`${up ? 'Up' : 'Down'} ${text} vs ${compareLabel}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <Icon size={14} color={colour} />
        <Text style={{ fontSize: 13, fontWeight: '500', color: colour }}>{text}</Text>
      </View>
      <Text style={{ fontSize: 11, color: C.subtle }}>vs {compareLabel}</Text>
    </View>
  );
}
