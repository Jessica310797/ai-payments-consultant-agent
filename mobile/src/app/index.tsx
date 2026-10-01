import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Note } from '../components/ui';
import { fmtMoney, fmtPeriod } from '../lib/format';
import { deleteCheck, listChecks } from '../lib/storage';
import { useVisit } from '../lib/store';
import { C, reformPill } from '../lib/theme';
import type { SavedCheck } from '../lib/types';

export default function Home() {
  const insets = useSafeAreaInsets();
  const { reset, update } = useVisit();
  const [checks, setChecks] = useState<SavedCheck[]>([]);

  useFocusEffect(
    useCallback(() => {
      listChecks().then(setChecks);
    }, []),
  );

  const open = (c: SavedCheck) => {
    update({ id: c.id, pages: [], draft: c.draft, report: c.report, checks: c.report.checks, notes: '' });
    router.push('/results');
  };

  const remove = (c: SavedCheck) => {
    const go = () => deleteCheck(c.id).then(() => listChecks().then(setChecks));
    const name = c.report.merchant_name || 'this merchant';
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm(`Delete the check for ${name}?`)) go();
    } else {
      Alert.alert('Delete check?', `Delete the check for ${name} from this phone?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: go },
      ]);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: C.cream }} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      <View style={[st.hero, { paddingTop: insets.top + 36 }]}>
        <Text style={st.title}>Payments Consultant</Text>
        <Text style={st.subtitle}>See what a merchant pays for card payments, and what changes from 1 October.</Text>
        <Text style={st.pill}>{reformPill()}</Text>
      </View>

      <View style={st.body}>
        <Button
          label="New merchant check"
          icon="＋"
          kind="accent"
          onPress={() => {
            reset();
            router.push('/capture');
          }}
        />

        <Card title="Recent Checks">
          {checks.length === 0 ? (
            <Note>Checks you complete are saved on this phone so you can show them again on a follow-up visit.</Note>
          ) : (
            checks.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => open(c)}
                onLongPress={() => remove(c)}
                accessibilityRole="button"
                accessibilityHint="Opens the results. Long-press to delete."
                style={({ pressed }) => [st.item, pressed ? { opacity: 0.7 } : null]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={st.itemTitle} numberOfLines={1}>
                    {c.report.merchant_name || 'Unnamed merchant'}
                  </Text>
                  <Text style={st.itemSub} numberOfLines={1}>
                    {fmtPeriod(c.report.period_start, c.report.period_end)} · {c.report.acquirer || 'Acquirer not set'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={st.itemSaving}>{c.report.reform ? `${fmtMoney(c.report.reform.saving)}/mo` : '—'}</Text>
                  <Text style={st.itemSub}>saving</Text>
                </View>
              </Pressable>
            ))
          )}
          {checks.length > 0 ? <Note>Long-press a check to delete it.</Note> : null}
        </Card>

        <View style={{ marginTop: 18 }}>
          <Button label="Settings" kind="ghost" onPress={() => router.push('/settings')} />
        </View>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  hero: {
    backgroundColor: C.teal,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: 22,
    paddingBottom: 28,
    alignItems: 'center',
  },
  title: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: C.tealSoft, fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 21 },
  pill: {
    marginTop: 16,
    backgroundColor: C.orange,
    color: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 16,
    fontWeight: '700',
    fontSize: 13,
    overflow: 'hidden',
  },
  body: { paddingHorizontal: 16, paddingTop: 22 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  itemTitle: { fontSize: 16, fontWeight: '700', color: C.ink },
  itemSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  itemSaving: { fontSize: 16, fontWeight: '800', color: C.orange },
});
