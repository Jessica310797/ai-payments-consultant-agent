import type { DemoState } from '@shared/data/source';
import { dateTime } from '@shared/lib/format';
import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { ChevronRight, UserRound } from 'lucide-react-native';
import { Switch, View } from 'react-native';
import { Bullets, Button, Card, PageTitle, Row, Screen, Segmented, Tap, Text } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useData } from '../../lib/data';
import { C } from '../../lib/theme';

const LINKS: { to: Href; label: string; help: string }[] = [
  { to: '/costs', label: 'Payment costs', help: 'Period comparison and what changed the cost' },
  { to: '/drivers', label: 'Cost drivers', help: 'Fees by type and provider' },
  { to: '/actions', label: 'Recommended actions', help: 'Ranked next steps' },
  { to: '/upload', label: 'Upload data', help: 'Statement photos, transactions CSV, invoices' },
  { to: '/statements', label: 'Statement checks', help: 'Statements read on this phone' },
  { to: '/notifications', label: 'Notifications', help: 'Alerts from your data' },
  { to: '/account', label: 'Account', help: 'Log out or delete your account' },
  { to: '/settings', label: 'Settings', help: 'Server address and privacy' },
];

export default function More() {
  const { data, uploaded, setUploadedData, demoState, setDemoState, showDemo, setShowDemo } = useData();
  const { profile } = useAuth();
  return (
    <Screen tabs>
      <PageTitle title="More" />
      <Tap onPress={() => router.push('/account')} label="Account" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.sage, alignItems: 'center', justifyContent: 'center' }}>
          <UserRound size={20} color={C.brandDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{profile?.merchant.name ?? 'Account'}</Text>
          <Text style={{ fontSize: 13, color: C.subtle }} numberOfLines={1}>{profile?.email}</Text>
        </View>
        <ChevronRight size={18} color={C.muted} />
      </Tap>
      <Card style={{ padding: 0, gap: 0 }}>
        {LINKS.map((l, i) => (
          <Tap key={String(l.to)} onPress={() => router.push(l.to)} label={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '500' }}>{l.label}</Text>
              <Text style={{ fontSize: 13, color: C.subtle }}>{l.help}</Text>
            </View>
            <ChevronRight size={18} color={C.muted} />
          </Tap>
        ))}
      </Card>
      <Card title="Data source">
        {data ? (
          <View>
            <Row label="Merchant" value={data.merchant.name} />
            <Row label="Source" value={data.meta.source} />
            <Row label="Updated" value={dateTime(data.meta.lastUpdated)} />
          </View>
        ) : <Text style={{ color: C.subtle }}>Not loaded.</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '500' }}>Show demo data</Text>
            <Text style={{ fontSize: 12, color: C.subtle }}>A fictional merchant, to explore what PayNavigate shows</Text>
          </View>
          <Switch value={showDemo} onValueChange={setShowDemo} trackColor={{ true: C.brand, false: C.line }} thumbColor="#FFFFFF" accessibilityLabel="Show demo data" />
        </View>
        {uploaded && !showDemo ? <Button kind="secondary" label="Remove the data added on this phone" onPress={() => setUploadedData(null)} /> : null}
      </Card>
      <Card title="How the numbers are worked out">
        <Bullets muted items={[
          'Effective cost rate = total payment costs ÷ payment volume.',
          'Changes compare the selected period with the period of the same length just before it.',
          'What changed the cost splits the change into transaction volume, card mix, contracted pricing changes and an unexplained remainder. The four parts add up to the total.',
          'Confirmed discrepancies are charges above the contracted rates, or invoices that don\'t match transactions. Opportunities are estimates and list their assumptions.',
          'Regulatory items stay To confirm until checked against the official source.',
        ]} />
      </Card>
      <Card title="Preview states">
        <Text style={{ fontSize: 13, color: C.subtle }}>See how screens look while loading, with no data, or when the data service fails.</Text>
        <Segmented<DemoState>
          label="Preview state"
          options={[{ key: 'normal', label: 'Demo data' }, { key: 'loading', label: 'Loading' }, { key: 'empty', label: 'Empty' }, { key: 'error', label: 'Error' }]}
          value={demoState}
          onChange={setDemoState}
        />
      </Card>
      <Text style={{ fontSize: 12, color: C.subtle, paddingHorizontal: 2 }}>
        PayNavigate {Constants.expoConfig?.version ?? ''} · Demo figures are generated for a fictional merchant.
      </Text>
    </Screen>
  );
}
