import { money, pct } from '@shared/lib/format';
import { summarise } from '@shared/lib/metrics';
import { router } from 'expo-router';
import { View } from 'react-native';
import { DriversDonut, DriversLegend } from '../components/charts';
import { DataGate, PeriodSelector, Provenance } from '../components/data-ui';
import { Card, CardHeader, EmptyState, Screen, Table } from '../components/ui';
import { useData } from '../lib/data';

export default function Drivers() {
  const { data, derived } = useData();
  return (
    <Screen>
      <DataGate>
        {!data || !derived || derived.empty ? (
          <EmptyState title="No cost data" body="Add a statement, transactions or invoices to see what drives payment costs." action={{ label: 'Upload data', onPress: () => router.push('/upload') }} />
        ) : (
          <View style={{ gap: 16 }}>
            <PeriodSelector />
            <Card>
              <View style={{ alignItems: 'center', gap: 16 }}>
                <DriversDonut drivers={derived.drivers} total={derived.now.cost} size={170} />
                <View style={{ alignSelf: 'stretch' }}><DriversLegend drivers={derived.drivers} /></View>
              </View>
            </Card>
            <Card>
              <CardHeader title="Ranked by amount" subtitle="Share of total payment costs, and as a % of payment volume now and before." />
              <Table
                label="Cost drivers ranked"
                head={['Fee type', 'Amount', 'Share', '% vol.', 'Before']}
                flex={[1.5, 1.1, 0.8, 0.9, 0.9]}
                rows={derived.drivers.map((d) => [
                  d.label.replace(' fees', ''),
                  { text: money(d.amount), bold: true },
                  pct(d.share, 0),
                  pct((d.amount / derived.now.value) * 100, 2),
                  derived.before ? pct((derived.before.fees[d.component] / derived.before.value) * 100, 2) : '—',
                ])}
              />
            </Card>
            {data.providers.map((p) => {
              const s = summarise(data.ledger.filter((r) => r.provider === p.id), derived.period.current);
              return (
                <Card key={p.id} title={`${p.name} · ${money(s.cost)}`}>
                  <Table label={`Fee types for ${p.name}`} head={['Fee type', 'Amount', 'Share']} rows={derived.drivers.map((d) => [d.label, money(s.fees[d.component]), pct(s.cost ? (s.fees[d.component] / s.cost) * 100 : 0, 0)])} />
                </Card>
              );
            })}
            <Provenance />
          </View>
        )}
      </DataGate>
    </Screen>
  );
}
