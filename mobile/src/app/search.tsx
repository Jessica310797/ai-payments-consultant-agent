import { router, type Href } from 'expo-router';
import { Search as SearchIcon } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Screen, Tap, Text } from '../components/ui';
import { useData } from '../lib/data';
import { C, F } from '../lib/theme';

interface Hit { to: Href; key: string; title: string; kind: string; text: string }

export default function Search() {
  const { data, derived } = useData();
  const [q, setQ] = useState('');
  const index = useMemo<Hit[]>(() => {
    const out: Hit[] = [
      { to: '/costs', key: 'costs', title: 'Payment costs', kind: 'Screen', text: 'costs effective rate volume transactions comparison variance mix pricing' },
      { to: '/drivers', key: 'drivers', title: 'Cost drivers', kind: 'Screen', text: 'acquiring interchange scheme processor other fees' },
      { to: '/transactions', key: 'tx', title: 'Transactions', kind: 'Screen', text: 'card type provider volume average sale' },
      { to: '/upload', key: 'upload', title: 'Upload data', kind: 'Screen', text: 'csv invoice upload file statement photo camera pdf' },
    ];
    for (const c of data?.changes ?? []) out.push({ to: { pathname: '/change/[id]', params: { id: c.id } }, key: `c${c.id}`, title: c.title, kind: 'October change', text: `${c.summary} ${c.affected}` });
    for (const f of derived?.findings ?? []) out.push({ to: { pathname: '/finding/[id]', params: { id: f.id } }, key: `f${f.id}`, title: f.title, kind: 'Audit finding', text: `${f.headline} ${f.evidence.join(' ')}` });
    for (const a of derived?.actions ?? []) out.push({ to: { pathname: '/action/[id]', params: { id: a.id } }, key: `a${a.id}`, title: a.title, kind: 'Action', text: a.reason });
    for (const p of data?.providers ?? []) out.push({ to: '/costs', key: `p${p.id}`, title: p.name, kind: 'Provider', text: p.role });
    return out;
  }, [data, derived]);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = terms.length ? index.filter((h) => terms.every((t) => `${h.title} ${h.kind} ${h.text}`.toLowerCase().includes(t))) : [];
  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12 }}>
        <SearchIcon size={18} color={C.muted} />
        <TextInput autoFocus value={q} onChangeText={setQ} placeholder="Search fees, providers, changes…" placeholderTextColor={C.muted} accessibilityLabel="Search payments, changes and findings"
          returnKeyType="search" style={{ flex: 1, minHeight: 48, fontSize: 15, color: C.ink, fontFamily: F.regular }} />
      </View>
      {terms.length && !hits.length ? <Text style={{ color: C.subtle }}>No results for "{q}".</Text> : null}
      <View style={{ gap: 8 }}>
        {hits.map((h) => (
          <Tap key={h.key} onPress={() => router.push(h.to)} label={`${h.kind}: ${h.title}`} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
            <Text style={{ fontSize: 12, color: C.subtle }}>{h.kind}</Text>
            <Text style={{ fontSize: 15, fontWeight: '500' }}>{h.title}</Text>
          </Tap>
        ))}
      </View>
    </Screen>
  );
}
