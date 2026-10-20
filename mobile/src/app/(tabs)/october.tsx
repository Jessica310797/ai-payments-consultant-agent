import { dateLong, pct } from '@shared/lib/format';
import { router } from 'expo-router';
import { ChevronRight, TrendingUp } from 'lucide-react-native';
import { View } from 'react-native';
import { APPLIES, CHANGE_STATUS } from '../../components/dashboard';
import { DataGate, Provenance } from '../../components/data-ui';
import { Badge, EmptyState, PageTitle, Screen, Tap, Text } from '../../components/ui';
import { useData } from '../../lib/data';
import { C, shadow } from '../../lib/theme';

const CATEGORY = { regulation: 'Regulation', 'provider-pricing': 'Provider pricing', scheme: 'Scheme fees' };
const box = { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, ...shadow };

export default function October() {
  const { data, derived } = useData();
  const up = derived?.before && derived.before.cost ? ((derived.now.cost - derived.before.cost) / derived.before.cost) * 100 : null;
  return (
    <Screen tabs>
      <PageTitle title="October changes" subtitle="Regulation, surcharging and cost updates" />
      <DataGate>
        {!data?.changes.length ? (
          <EmptyState title="No changes logged" body="Changes from regulators, schemes and providers will appear here." />
        ) : (
          <View style={{ gap: 16 }}>
            <View style={{ backgroundColor: C.sage, borderRadius: 16, padding: 14 }}>
              <Text style={{ fontSize: 13, lineHeight: 19 }}>
                Items marked <Text style={{ fontSize: 13, fontWeight: '600' }}>To confirm</Text> haven't been checked against the official source yet. Open each one to see the source, whether it applies to this merchant and what to do next.
              </Text>
            </View>
            {up != null ? (
              <Tap onPress={() => router.push('/costs')} label="Payment cost increases" style={[box, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.dangerSoft, alignItems: 'center', justifyContent: 'center' }}><TrendingUp size={20} color={C.danger} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600' }}>Payment cost increases</Text>
                  <Text style={{ fontSize: 13, color: C.subtle, lineHeight: 19 }}>Costs {up >= 0 ? 'up' : 'down'} {pct(Math.abs(up), 1)} in {derived!.period.label} vs {derived!.period.comparisonLabel}. See what drove it.</Text>
                </View>
                <ChevronRight size={18} color={C.muted} />
              </Tap>
            ) : null}
            <Text style={{ fontSize: 15, fontWeight: '600' }} accessibilityRole="header">Change log</Text>
            {data.changes.map((c) => (
              <Tap key={c.id} onPress={() => router.push({ pathname: '/change/[id]', params: { id: c.id } })} label={c.title} style={[box, { gap: 6 }]}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: C.subtle }}>{CATEGORY[c.category]}</Text>
                    <Text style={{ fontSize: 15, fontWeight: '600' }}>{c.title}</Text>
                  </View>
                  <ChevronRight size={18} color={C.muted} style={{ marginTop: 10 }} />
                </View>
                <Text style={{ fontSize: 13, lineHeight: 19, color: C.subtle }}>{c.summary}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Badge tone={CHANGE_STATUS[c.status].tone} label={CHANGE_STATUS[c.status].label} />
                  <Badge tone={APPLIES[c.applicability].tone} label={APPLIES[c.applicability].label} />
                  <Text style={{ fontSize: 12, color: C.subtle }}>Effective {c.effectiveDate ? dateLong(c.effectiveDate) : 'not set'}{c.effectiveDateVerified ? '' : ' (to confirm)'}</Text>
                </View>
              </Tap>
            ))}
            <Provenance />
          </View>
        )}
      </DataGate>
    </Screen>
  );
}
