import { dateLong, money } from '@shared/lib/format';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ExternalLink } from 'lucide-react-native';
import { Linking, View } from 'react-native';
import { APPLIES, CHANGE_STATUS } from '../../components/dashboard';
import { DataGate } from '../../components/data-ui';
import { Badge, Bullets, Card, CardHeader, EmptyState, Screen, Tap, Text, TextLink } from '../../components/ui';
import { useData } from '../../lib/data';
import { C } from '../../lib/theme';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 4 }}>
      <Text style={{ width: 104, fontSize: 13, color: C.subtle }}>{label}</Text>
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <Text style={{ fontSize: 13 }}>{children}</Text> : children}</View>
    </View>
  );
}

export default function ChangeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, derived } = useData();
  const c = data?.changes.find((x) => x.id === id);
  const surchargeBase = c?.id === 'surcharging' && data && derived
    ? data.ledger.filter((r) => derived.period.current.includes(r.month) && r.segment !== 'amex_credit').reduce((a, r) => a + r.value, 0) / Math.max(derived.now.months, 1)
    : null;
  return (
    <Screen>
      <Stack.Screen options={{ title: c?.title ?? 'Change' }} />
      <DataGate>
        {!c || !data ? (
          <EmptyState title="Change not found" body="It may have been removed from the log." action={{ label: 'Back to October changes', onPress: () => router.navigate('/october') }} />
        ) : (
          <View style={{ gap: 16 }}>
            <Card>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <Badge tone={CHANGE_STATUS[c.status].tone} label={CHANGE_STATUS[c.status].label} />
                <Badge tone={APPLIES[c.applicability].tone} label={APPLIES[c.applicability].label} />
              </View>
              <Text style={{ fontSize: 15, lineHeight: 22 }}>{c.summary}</Text>
              <Text style={{ fontSize: 13, color: C.subtle }}>{CHANGE_STATUS[c.status].help}</Text>
              <View style={{ borderTopWidth: 1, borderColor: C.line, paddingTop: 10 }}>
                <Field label="Effective date">{`${c.effectiveDate ? dateLong(c.effectiveDate) : 'Not set'}${c.effectiveDateVerified ? '' : ' (to confirm)'}`}</Field>
                <Field label="Affects">{c.affected}</Field>
                <Field label="Source">
                  {c.source.url ? (
                    <Tap onPress={() => Linking.openURL(c.source.url!)} label={`${c.source.label}, opens in browser`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: C.brand, flexShrink: 1 }}>{c.source.label}</Text>
                      <ExternalLink size={13} color={C.brand} />
                    </Tap>
                  ) : c.source.label}
                </Field>
                <Field label="Last checked">{dateLong(c.lastChecked)}</Field>
              </View>
            </Card>
            <Card>
              <CardHeader title="Does it apply to this merchant?" right={<Badge tone={APPLIES[c.applicability].tone} label={APPLIES[c.applicability].label} />} />
              <Text style={{ fontSize: 14, lineHeight: 21 }}>{c.applicabilityReason}</Text>
              {surchargeBase && data.merchant.surchargesToday ? (
                <Text style={{ fontSize: 13, color: C.subtle, lineHeight: 19 }}>
                  Surcharges today at {data.merchant.surchargeRatePct}% on about {money(surchargeBase)} a month of eftpos, Visa and Mastercard sales (≈ {money((surchargeBase * data.merchant.surchargeRatePct) / 100)} a month in surcharge income).
                </Text>
              ) : null}
            </Card>
            <Card title="Recommended next steps" style={{ backgroundColor: C.sage, borderColor: C.sage }}>
              <Bullets numbered items={c.nextSteps} />
              {c.category !== 'regulation' ? <TextLink to="/costs" label="See the cost impact" /> : null}
            </Card>
          </View>
        )}
      </DataGate>
    </Screen>
  );
}
