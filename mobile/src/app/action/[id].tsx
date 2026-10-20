import type { ActionStatus } from '@shared/lib/actions';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { STATUS_LABEL } from '../../components/dashboard';
import { DataGate } from '../../components/data-ui';
import { Badge, Button, Card, EmptyState, Screen, Segmented, Text, cap, confidenceTone, priorityTone } from '../../components/ui';
import { useData } from '../../lib/data';
import { C } from '../../lib/theme';

export default function ActionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { derived, actionStatus, setActionStatus } = useData();
  const idx = derived?.actions.findIndex((a) => a.id === id) ?? -1;
  const a = idx >= 0 ? derived!.actions[idx] : null;
  return (
    <Screen>
      <Stack.Screen options={{ title: a?.title ?? 'Action' }} />
      <DataGate>
        {!a ? (
          <EmptyState title="Action not found" body="It may no longer apply to the selected period." action={{ label: 'All actions', onPress: () => router.replace('/actions') }} />
        ) : (
          <View style={{ gap: 16 }}>
            <Text style={{ fontSize: 14, color: C.subtle }}>Rank {idx + 1} of {derived!.actions.length}</Text>
            <Card>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <Badge tone={priorityTone(a.priority)} label={`${cap(a.priority)} priority`} />
                <Badge tone={confidenceTone(a.confidence)} label={`${cap(a.confidence)} confidence`} />
              </View>
              <View>
                <Text style={{ fontSize: 12, color: C.subtle }}>Why</Text>
                <Text style={{ fontSize: 14, lineHeight: 21 }}>{a.reason}</Text>
              </View>
              <View>
                <Text style={{ fontSize: 12, color: C.subtle }}>Estimated impact</Text>
                <Text style={{ fontSize: 14, lineHeight: 21 }}>{a.impact ?? 'Not estimated: the data doesn\'t support a dollar figure yet.'}</Text>
              </View>
              <Button kind="secondary" label={`Open ${a.linkLabel.toLowerCase()}`} onPress={() => router.navigate(a.link === '/costs' ? '/costs' : a.link === '/october' ? '/october' : '/audit')} />
            </Card>
            <Card title="Status">
              <Segmented<ActionStatus>
                label="Action status"
                options={(Object.keys(STATUS_LABEL) as ActionStatus[]).map((s) => ({ key: s, label: STATUS_LABEL[s] }))}
                value={actionStatus[a.id] ?? 'open'}
                onChange={(s) => setActionStatus(a.id, s)}
              />
              <Text style={{ fontSize: 12, color: C.subtle }}>Saved on this phone.</Text>
            </Card>
          </View>
        )}
      </DataGate>
    </Screen>
  );
}
