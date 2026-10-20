import { money } from '@shared/lib/format';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { FindingIcon, KIND } from '../../components/dashboard';
import { DataGate, Provenance } from '../../components/data-ui';
import { Badge, Bullets, Button, Card, EmptyState, Screen, Text, cap, confidenceTone } from '../../components/ui';
import { useData } from '../../lib/data';
import { C } from '../../lib/theme';

const KIND_HELP = {
  confirmed: 'Confirmed: the data shows a charge that differs from the contract or invoice.',
  potential: 'Opportunity: an estimate that depends on the assumptions below. Not money owed.',
  clear: 'No issue found for this period.',
  'needs-data': 'This check needs more data before it can run.',
};

export default function FindingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { derived } = useData();
  const f = derived?.findings.find((x) => x.id === id);
  return (
    <Screen>
      <Stack.Screen options={{ title: f?.title ?? 'Finding' }} />
      <DataGate>
        {!f ? (
          <EmptyState title="Finding not found" body="It may not apply to the selected period." action={{ label: 'Back to audit', onPress: () => router.navigate('/audit') }} />
        ) : (
          <View style={{ gap: 16 }}>
            <Card>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <FindingIcon f={f} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    <Badge tone={KIND[f.kind].tone} label={KIND[f.kind].label} />
                    <Badge tone={confidenceTone(f.confidence)} label={`${cap(f.confidence)} confidence`} />
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: '600', lineHeight: 23 }}>{f.headline}</Text>
                  {f.variance != null ? (
                    <Text style={{ fontSize: 14, color: C.subtle }}>
                      Variance: <Text style={{ fontSize: 14, fontWeight: '600', color: f.kind === 'confirmed' ? C.danger : C.ink }}>{money(f.variance, { exact: true })}</Text>{' '}
                      {f.varianceBasis === 'a year' ? 'a year (estimate)' : `in ${f.varianceBasis}`}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 13, color: C.subtle, lineHeight: 19 }}>{KIND_HELP[f.kind]}</Text>
                </View>
              </View>
            </Card>
            {f.evidence.length ? <Card title="Evidence"><Bullets items={f.evidence} /></Card> : null}
            {f.assumptions.length ? <Card title="Assumptions"><Bullets muted items={f.assumptions} /></Card> : null}
            <Card title="Next action" style={{ backgroundColor: C.sage, borderColor: C.sage }}>
              <Text style={{ fontSize: 14, lineHeight: 21 }}>{f.nextAction}</Text>
              {f.kind === 'needs-data' ? <Button label="Upload data" onPress={() => router.push('/upload')} /> : null}
            </Card>
            <Provenance />
          </View>
        )}
      </DataGate>
    </Screen>
  );
}
