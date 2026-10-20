import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Button, Card, Note, Screen, Tap, Text } from '../components/ui';
import { fmtMoney, fmtPeriod } from '../lib/format';
import { deleteCheck, listChecks } from '../lib/storage';
import { useVisit } from '../lib/store';
import { C } from '../lib/theme';
import type { SavedCheck } from '../lib/types';

export default function Statements() {
  const { reset, update } = useVisit();
  const [checks, setChecks] = useState<SavedCheck[]>([]);
  useFocusEffect(useCallback(() => { listChecks().then(setChecks); }, []));

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
    <Screen>
      <Button label="Photograph a new statement" onPress={() => { reset(); router.push('/capture'); }} />
      <Card title="Checked on this phone">
        {checks.length === 0 ? (
          <Note>Statements you check are saved on this phone so you can show them again on a follow-up visit.</Note>
        ) : (
          checks.map((c, i) => (
            <Tap key={c.id} onPress={() => open(c)} onLongPress={() => remove(c)} label={`${c.report.merchant_name || 'Unnamed merchant'}. Long-press to delete.`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{c.report.merchant_name || 'Unnamed merchant'}</Text>
                <Text style={{ fontSize: 12, color: C.subtle }} numberOfLines={1}>{fmtPeriod(c.report.period_start, c.report.period_end)} · {c.report.acquirer || 'Acquirer not set'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: C.brand }}>{c.report.reform ? `${fmtMoney(c.report.reform.saving)}/mo` : '—'}</Text>
                <Text style={{ fontSize: 12, color: C.subtle }}>1 Oct saving</Text>
              </View>
            </Tap>
          ))
        )}
        {checks.length ? <Note>Press and hold a check to delete it.</Note> : null}
      </Card>
    </Screen>
  );
}
