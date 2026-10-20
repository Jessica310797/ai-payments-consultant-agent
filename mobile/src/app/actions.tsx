import { View } from 'react-native';
import { ActionCard } from '../components/dashboard';
import { DataGate } from '../components/data-ui';
import { EmptyState, Screen, Text } from '../components/ui';
import { useData } from '../lib/data';
import { C } from '../lib/theme';

export default function ActionsList() {
  const { derived } = useData();
  return (
    <Screen>
      <Text style={{ fontSize: 14, color: C.subtle }}>Ranked by priority, then potential impact.</Text>
      <DataGate>
        {!derived?.actions.length ? (
          <EmptyState title="Nothing to do right now" body="Actions appear when costs move, changes need checking or the audit finds something." />
        ) : (
          <View style={{ gap: 12 }}>{derived.actions.map((a, i) => <ActionCard key={a.id} a={a} rank={i + 1} />)}</View>
        )}
      </DataGate>
    </Screen>
  );
}
