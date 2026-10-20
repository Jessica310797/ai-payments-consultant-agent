import type { Finding } from '@shared/lib/audit';
import { money } from '@shared/lib/format';
import { router } from 'expo-router';
import { Upload } from 'lucide-react-native';
import { View } from 'react-native';
import { FindingIcon, KIND, openFinding } from '../../components/dashboard';
import { DataGate, PeriodSelector, Provenance } from '../../components/data-ui';
import { Badge, Button, Card, Note, PageTitle, Screen, Tap, Text, cap, confidenceTone } from '../../components/ui';
import { useData } from '../../lib/data';
import { C, shadow } from '../../lib/theme';

function Group({ title, help, items }: { title: string; help: string; items: Finding[] }) {
  if (!items.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <View>
        <Text style={{ fontSize: 15, fontWeight: '600' }} accessibilityRole="header">{title}</Text>
        <Text style={{ fontSize: 13, color: C.subtle }}>{help}</Text>
      </View>
      {items.map((f) => (
        <Tap key={f.id} onPress={() => openFinding(f.id)} label={`${f.title}: ${f.headline}`} style={{ flexDirection: 'row', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, ...shadow }}>
          <FindingIcon f={f} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 15, fontWeight: '600' }}>{f.title}</Text>
              <Badge tone={KIND[f.kind].tone} label={KIND[f.kind].label} />
            </View>
            <Text style={{ fontSize: 13, lineHeight: 19, color: C.subtle }}>{f.headline}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {f.variance ? <Badge label={`${money(Math.abs(f.variance))} ${f.varianceBasis === 'a year' ? 'a year' : `in ${f.varianceBasis}`}`} /> : null}
              <Badge tone={confidenceTone(f.confidence)} label={`${cap(f.confidence)} confidence`} />
            </View>
          </View>
        </Tap>
      ))}
    </View>
  );
}

export default function Audit() {
  const { derived } = useData();
  const f = derived?.findings ?? [];
  return (
    <Screen tabs>
      <PageTitle title="Audit" subtitle={derived && !derived.empty ? `Checks for ${derived.period.label}` : undefined} />
      <Button label="Upload data or photograph a statement" icon={<Upload size={16} color="#FFFFFF" />} onPress={() => router.push('/upload')} />
      <DataGate>
        <View style={{ gap: 20 }}>
          <PeriodSelector />
          <Group title="Confirmed discrepancies" help="Charged differently from the contract or invoice. Money you can ask for back." items={f.filter((x) => x.kind === 'confirmed')} />
          <Group title="Potential opportunities" help="Estimates based on assumptions. Worth checking, not yet owed to you." items={f.filter((x) => x.kind === 'potential')} />
          <Group title="Other checks" help="Checks that found nothing, or need more data." items={f.filter((x) => x.kind === 'clear' || x.kind === 'needs-data')} />
          <Card>
            <Note>Fee checks compare each provider's charges with the contracted rates on file. Add a statement, transactions file or invoice to extend the audit.</Note>
          </Card>
          <Provenance />
        </View>
      </DataGate>
    </Screen>
  );
}
