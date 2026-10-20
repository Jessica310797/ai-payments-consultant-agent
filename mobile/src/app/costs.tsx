import { count, money, monthMid, pct } from '@shared/lib/format';
import { summarise } from '@shared/lib/metrics';
import { COMPONENTS } from '@shared/lib/segments';
import { router } from 'expo-router';
import { View } from 'react-native';
import { CostTrendChart } from '../components/charts';
import { DataGate, PeriodSelector, Provenance } from '../components/data-ui';
import { Card, CardHeader, EmptyState, Screen, Table, Text } from '../components/ui';
import { useData } from '../lib/data';
import { C } from '../lib/theme';

const signed = (v: number) => `${v >= 0 ? '+' : '−'}${money(Math.abs(v), { exact: true })}`;
const change = (a: number, b: number | undefined) => (b ? pct(((a - b) / b) * 100, 1) : '—');

function VarianceBars() {
  const { derived } = useData();
  const v = derived!.variance;
  if (!v) return <Text style={{ fontSize: 13, color: C.subtle }}>There's no earlier period of the same length to compare with.</Text>;
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
    <View style={{ gap: 14 }}>
      <Text style={{ fontSize: 14, lineHeight: 20 }}>
        Costs went from <Text style={{ fontWeight: '600' }}>{money(v.before, { exact: true })}</Text> to <Text style={{ fontWeight: '600' }}>{money(v.after, { exact: true })}</Text> ({signed(v.after - v.before)}).
      </Text>
      {parts.map((p) => (
        <View key={p.label} accessible accessibilityLabel={`${p.label}: ${signed(p.value)}. ${p.help}`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '500' }}>{p.label}</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: p.value > 0 ? C.danger : C.brand }}>{signed(p.value)}</Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: '#EEF0EC', marginTop: 4 }}>
            <View style={{ height: 8, borderRadius: 4, width: `${(Math.abs(p.value) / max) * 100}%`, backgroundColor: p.value > 0 ? C.danger : C.brand }} />
          </View>
          <Text style={{ fontSize: 12, color: C.subtle, marginTop: 4 }}>{p.help}</Text>
        </View>
      ))}
    </View>
  );
}

export default function Costs() {
  const { data, derived } = useData();
  return (
    <Screen>
      <DataGate>
        {!data || !derived || derived.empty ? (
          <EmptyState title="No cost data" body="Add a statement, transactions or invoices to see payment costs." action={{ label: 'Upload data', onPress: () => router.push('/upload') }} />
        ) : (
          <View style={{ gap: 16 }}>
            <PeriodSelector />
            <Card>
              <CardHeader title="Period comparison" subtitle={`Now = ${derived.period.label}. Before = ${derived.period.comparisonLabel}, the period of the same length just before. Effective rate = total payment costs ÷ payment volume.`} />
              <Table
                label="Current period compared with the comparison period"
                head={['', 'Now', 'Before', 'Change']}
                rows={[
                  ['Transactions', { text: count(derived.now.transactions), bold: true }, derived.before ? count(derived.before.transactions) : '—', change(derived.now.transactions, derived.before?.transactions)],
                  ['Volume', { text: money(derived.now.value), bold: true }, derived.before ? money(derived.before.value) : '—', change(derived.now.value, derived.before?.value)],
                  ['Payment costs', { text: money(derived.now.cost), bold: true }, derived.before ? money(derived.before.cost) : '—', { text: change(derived.now.cost, derived.before?.cost), tone: 'bad' }],
                  ['Effective rate', { text: pct(derived.now.rate), bold: true }, derived.before ? pct(derived.before.rate) : '—',
                    { text: derived.before && derived.now.rate != null && derived.before.rate != null ? `${(derived.now.rate - derived.before.rate).toFixed(2)} pp` : '—', tone: 'bad' }],
                ]}
              />
            </Card>
            <Card>
              <CardHeader title="What changed the cost" subtitle="The four parts add up to the total change." />
              <VarianceBars />
            </Card>
            <Card title="By fee type">
              <Table
                label="Fees by type"
                head={['Fee type', 'Now', 'Before', 'Change']}
                rows={COMPONENTS.map((c) => {
                  const a = derived.now.fees[c.id], b = derived.before?.fees[c.id];
                  return [c.label, { text: money(a), bold: true }, b != null ? money(b) : '—', { text: change(a, b), tone: b != null && a > b ? 'bad' : 'good' }];
                })}
              />
            </Card>
            <Card title="By provider">
              <Table
                label="Effective rate by provider"
                head={['Provider', 'Costs', 'Rate', 'Before']}
                rows={data.providers.map((p) => {
                  const rs = data.ledger.filter((r) => r.provider === p.id);
                  const a = summarise(rs, derived.period.current), b = derived.period.comparison.length ? summarise(rs, derived.period.comparison) : null;
                  return [{ text: p.name, sub: p.role }, money(a.cost), { text: pct(a.rate), bold: true }, b ? pct(b.rate) : '—'];
                })}
              />
            </Card>
            <Card title="Monthly trend">
              <CostTrendChart series={derived.series} current={derived.period.current} />
              <Table
                label="Monthly totals"
                head={['Month', 'Volume', 'Costs', 'Rate']}
                rows={[...derived.series].reverse().map((s) => [monthMid(s.month), money(s.value), money(s.cost), { text: pct(s.rate), bold: true }])}
              />
            </Card>
            <Provenance />
          </View>
        )}
      </DataGate>
    </Screen>
  );
}
