import { Tabs } from 'expo-router/js-tabs';
import { CalendarDays, CreditCard, House, Menu, ScanSearch } from 'lucide-react-native';
import { C, F } from '../../lib/theme';

const ICONS = { index: House, transactions: CreditCard, audit: ScanSearch, october: CalendarDays, more: Menu };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: C.bg },
        tabBarActiveTintColor: C.brandDark,
        tabBarInactiveTintColor: C.subtle,
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.line },
        tabBarLabelStyle: { fontFamily: F.medium, fontSize: 11 },
        tabBarIcon: ({ color, focused }) => {
          const Icon = ICONS[route.name as keyof typeof ICONS] ?? House;
          return <Icon size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} fill={focused && route.name === 'index' ? color : 'none'} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transactions' }} />
      <Tabs.Screen name="audit" options={{ title: 'Audit' }} />
      <Tabs.Screen name="october" options={{ title: 'October' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
