import { router } from 'expo-router';
import { Bell, ChartColumn, Search } from 'lucide-react-native';
import { View } from 'react-native';
import { AuditCard, CostDriversCard, NextActions, OctoberPanel, SummaryCard } from '../../components/dashboard';
import { DataGate, Provenance } from '../../components/data-ui';
import { Button, EmptyState, PageTitle, Screen, Tap, Text } from '../../components/ui';
import { notificationsFor, useData } from '../../lib/data';
import { C } from '../../lib/theme';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function Header() {
  const { data, derived, read } = useData();
  const unread = data && derived ? notificationsFor(data, derived).filter((n) => !read.includes(n.id)).length : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.brandDark, alignItems: 'center', justifyContent: 'center' }}>
        <ChartColumn size={22} color="#FFFFFF" strokeWidth={2.5} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 19, fontWeight: '600', letterSpacing: -0.2 }}>PayNavigate</Text>
        <Text style={{ fontSize: 13, color: C.subtle }}>Payments Intelligence</Text>
      </View>
      <Tap onPress={() => router.push('/search')} label="Search" style={{ padding: 10 }}>
        <Search size={22} color={C.ink} />
      </Tap>
      <Tap onPress={() => router.push('/notifications')} label={unread ? `Notifications, ${unread} unread` : 'Notifications'} style={{ padding: 10 }}>
        <Bell size={22} color={C.ink} />
        {unread ? <View style={{ position: 'absolute', right: 9, top: 9, width: 10, height: 10, borderRadius: 5, backgroundColor: C.brand, borderWidth: 2, borderColor: C.bg }} /> : null}
      </Tap>
    </View>
  );
}

function DemoBanner() {
  const { showDemo, setShowDemo } = useData();
  if (!showDemo) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.amberSoft, borderRadius: 12, paddingVertical: 8, paddingLeft: 12, paddingRight: 4 }}>
      <Text style={{ flex: 1, fontSize: 13, color: C.amber }}>You're looking at demo data for a fictional merchant.</Text>
      <Tap onPress={() => setShowDemo(false)} label="Switch to your data" style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: C.amber }}>Show mine</Text>
      </Tap>
    </View>
  );
}

export default function Home() {
  const { data, derived, setShowDemo } = useData();
  return (
    <Screen tabs>
      <Header />
      <PageTitle
        eyebrow={greeting()}
        title="Payments overview"
        subtitle={data && derived ? `${derived.empty ? 'No reporting period' : derived.period.label} · ${data.merchant.name}` : undefined}
      />
      <DemoBanner />
      <DataGate>
        {derived?.empty ? (
          <View style={{ gap: 16 }}>
            <EmptyState title="No payment data yet" body="Photograph your latest card statement, or upload a transactions file, to see your costs, audit findings and recommended actions." action={{ label: 'Add your data', onPress: () => router.push('/upload') }} />
            <Button kind="secondary" label="Explore with demo data" onPress={() => setShowDemo(true)} />
            <OctoberPanel />
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <SummaryCard />
            <OctoberPanel />
            <CostDriversCard />
            <AuditCard />
            <NextActions />
            <Provenance />
          </View>
        )}
      </DataGate>
    </Screen>
  );
}
