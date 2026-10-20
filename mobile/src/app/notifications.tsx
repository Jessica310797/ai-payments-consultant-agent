import { router } from 'expo-router';
import { Bell, TriangleAlert } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import { DataGate } from '../components/data-ui';
import { EmptyState, Screen, Tap, Text } from '../components/ui';
import { noticeHref, notificationsFor, useData } from '../lib/data';
import { C } from '../lib/theme';

export default function Notifications() {
  const { data, derived, read, markNotificationsRead } = useData();
  const items = data && derived ? notificationsFor(data, derived) : [];
  useEffect(() => {
    if (!items.length) return;
    const t = setTimeout(markNotificationsRead, 1500);
    return () => clearTimeout(t);
  }, [items.length, markNotificationsRead]);
  return (
    <Screen>
      <DataGate>
        {!items.length ? (
          <EmptyState title="You're all caught up" body="Alerts appear here when costs rise, the audit finds something or a change needs checking." />
        ) : (
          <View style={{ gap: 8 }}>
            {items.map((n) => (
              <Tap key={n.id} onPress={() => router.push(noticeHref(n))} label={`${n.title}. ${n.body}`} style={{ flexDirection: 'row', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 14 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: n.tone === 'warning' ? C.dangerSoft : C.infoSoft }}>
                  {n.tone === 'warning' ? <TriangleAlert size={17} color={C.danger} /> : <Bell size={17} color={C.info} />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', flexShrink: 1 }}>{n.title}</Text>
                    {!read.includes(n.id) ? <View accessibilityLabel="Unread" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.brand }} /> : null}
                  </View>
                  <Text style={{ fontSize: 13, color: C.subtle, lineHeight: 19 }}>{n.body}</Text>
                </View>
              </Tap>
            ))}
          </View>
        )}
      </DataGate>
    </Screen>
  );
}
