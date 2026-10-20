import type { SegmentId } from '@shared/data/types';
import { count, money, pct } from '@shared/lib/format';
import { summarise } from '@shared/lib/metrics';
import { SEGMENTS } from '@shared/lib/segments';
import { router } from 'expo-router';
import { Upload } from 'lucide-react-native';
import { View } from 'react-native';
import { DataGate, PeriodSelector, Provenance } from '../../components/data-ui';
import { Card, EmptyState, PageTitle, Screen, Table, Tap, Text } from '../../components/ui';
import { useData } from '../../lib/data';
import { C } from '../../lib/theme';

export default function Transactions() {
  const { data, derived } = useData();
  const segs = data ? (Object.keys(SEGMENTS) as SegmentId[]).filter((s) => data.ledger.some((r) => r.segment === s)) : [];
  return (
    <Screen tabs>
      <PageTitle
        title="Transactions"
        subtitle={derived && !derived.empty ? derived.period.label : undefined}
        right={
          <Tap onPress={() => router.push('/upload')} label="Upload data" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, minHeight: 40 }}>
            <Upload size={15} color={C.ink} />
            <Text style={{ fontSize: 13, fontWeight: '500' }}>Upload</Text>
          </Tap>
        }
      />
      <DataGate>
        {!data || !derived || derived.empty ? (
          <EmptyState title="No transactions yet" body="Photograph a statement or upload a transactions export (CSV) from your provider, gateway or POS." action={{ label: 'Upload data', onPress: () => router.push('/upload') }} />
        ) : (
          <View style={{ gap: 16 }}>
            <PeriodSelector />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[
                ['Transactions', count(derived.now.transactions)],
                ['Payment volume', money(derived.now.value)],
                ['Average sale', money(derived.now.value / Math.max(derived.now.transactions, 1), { exact: true })],
                ['Cost per transaction', `${((derived.now.cost / Math.max(derived.now.transactions, 1)) * 100).toFixed(1)}¢`],
              ].map(([l, v]) => (
                <Card key={l} style={{ flexBasis: '47%', flexGrow: 1, padding: 14, gap: 2 }}>
                  <Text style={{ fontSize: 12, color: C.subtle }}>{l}</Text>
                  <Text style={{ fontSize: 20, fontWeight: '600' }}>{v}</Text>
                </Card>
              ))}
            </View>
            <Card title="By card type">
              <Table
                label="Transactions by card type"
                head={['Card type', 'Volume', 'Share', 'Rate']}
                rows={segs.map((s) => {
                  const x = summarise(data.ledger.filter((r) => r.segment === s), derived.period.current);
                  return [{ text: SEGMENTS[s].label, sub: `${count(x.transactions)} txns` }, money(x.value), pct((x.value / derived.now.value) * 100, 1), { text: pct(x.rate), bold: true }];
                })}
              />
            </Card>
            <Card title="By provider">
              <Table
                label="Transactions by provider"
                head={['Provider', 'Txns', 'Volume', 'Avg sale']}
                rows={data.providers.map((p) => {
                  const x = summarise(data.ledger.filter((r) => r.provider === p.id), derived.period.current);
                  return [{ text: p.name, sub: p.role }, count(x.transactions), money(x.value), x.transactions ? money(x.value / x.transactions, { exact: true }) : '—'];
                })}
              />
            </Card>
            <Provenance />
          </View>
        )}
      </DataGate>
    </Screen>
  );
}
