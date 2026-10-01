import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Donut, Legend, RoutingBars } from '../components/charts';
import { Button, Card, Checks, Highlight, Note, NumField, Row } from '../components/ui';
import { fmtMoney, fmtNumber, fmtPct, fmtPeriod } from '../lib/format';
import { useVisit } from '../lib/store';
import { C } from '../lib/theme';
import type { Stage } from '../lib/types';

export default function Results() {
  const insets = useSafeAreaInsets();
  const { visit, update } = useVisit();
  const [surcharging, setSurcharging] = useState(true);
  const [rate, setRate] = useState<number | null>(1);
  const r = visit.report;

  if (!r) {
    return (
      <View style={{ padding: 16 }}>
        <Card>
          <Note>No results yet.</Note>
          <Button label="Back to start" onPress={() => router.replace('/')} />
        </Card>
      </View>
    );
  }

  const h = r.headline;
  const saving = r.reform?.saving ?? 0;
  const base = r.surcharge_base ?? 0;
  const lost = surcharging ? (base * (rate ?? 0)) / 100 : 0;
  const net = saving - lost;
  const priceRise = net < 0 && h.revenue ? (-net / h.revenue) * 100 : 0;
  const schemesShown = Array.from(new Set(r.mix.flatMap((m) => m.schemes.map((x) => x.scheme))));

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
      <View style={st.head}>
        <Text style={st.merchant}>{r.merchant_name || 'Merchant'}</Text>
        <Text style={st.sub}>
          {fmtPeriod(r.period_start, r.period_end)} · {r.acquirer || 'Acquirer not set'} · per month
        </Text>
      </View>

      <Card title="Key Metrics">
        <View style={st.tiles}>
          <Tile label="Revenue" value={fmtMoney(h.revenue)} unit="/ mo" />
          <Tile label="Volume" value={fmtNumber(h.volume)} unit="txns / mo" />
          <Tile label="ATV" value={h.atv != null ? `$${h.atv.toFixed(2)}` : '—'} unit="avg sale" />
          <Tile label="Total cost" value={fmtMoney(h.total_cost)} unit="/ mo" />
        </View>
        <View style={st.divider} />
        <Row label="Interchange" value={fmtMoney(h.interchange)} />
        <Row label="Scheme fees" value={fmtMoney(h.scheme_fees)} />
        <Row label="Acquiring / processing" value={fmtMoney(h.acquiring)} />
        {h.other ? <Row label="Other" value={fmtMoney(h.other)} /> : null}
        <Row label="Effective rate" value={h.effective_rate != null ? `${fmtPct(h.effective_rate)} of revenue` : '—'} bold />
      </Card>

      <Card title="Payment Mix">
        {r.mix.length === 0 ? (
          <Note>The statement doesn't split sales by card scheme.</Note>
        ) : (
          <>
            <View style={st.donuts}>
              {r.mix.map((m) => (
                <Donut
                  key={m.card_type}
                  title={m.card_type === 'all' ? 'All cards' : m.card_type === 'debit' ? 'Debit' : 'Credit'}
                  subtitle={`${m.share.toFixed(0)}%`}
                  parts={m.schemes.map((x) => ({ label: x.scheme, share: x.share }))}
                />
              ))}
            </View>
            <Legend items={schemesShown} />
            {r.mix.map((m) => (
              <Note key={m.card_type}>
                {m.card_type === 'all' ? 'All cards' : m.card_type === 'debit' ? 'Debit' : 'Credit'}:{' '}
                {m.schemes.map((x) => `${x.scheme === 'Eftpos' ? 'eftpos' : x.scheme} ${x.share.toFixed(0)}%`).join(' · ')}
              </Note>
            ))}
          </>
        )}
      </Card>

      <Card title="Debit Routing Today">
        {r.routing_now.length ? (
          <>
            <RoutingBars rows={r.routing_now} valueLabel={(v) => `${fmtMoney(v)}/mo`} />
            <Highlight label="Debit sales via eftpos today" value={`${(r.eftpos_share_now ?? 0).toFixed(0)}%`} />
          </>
        ) : (
          <Note>Routing needs debit sales split by network - a statement that itemises eftpos, Visa debit and Mastercard debit.</Note>
        )}
      </Card>

      <Card title="From 1 October">
        {r.reform ? (
          <>
            {r.routing_suggested.length ? <RoutingBars rows={r.routing_suggested} valueLabel={(v) => `${fmtMoney(v)}/mo`} /> : null}
            <ReformTable today={r.reform.stages.today} after={r.reform.stages.after} lcr={r.reform.stages.lcr} />
            <Highlight label="Fee saving from 1 Oct" value={`${fmtMoney(r.reform.saving)}/mo`} />
            <Note>
              "1 Oct" is the saving from the new interchange caps alone. "+ routing" adds least-cost routing: sending dual-network
              debit cards through eftpos where that's cheaper ({fmtMoney(r.reform.routing_saving)}/mo of the saving).
            </Note>
            {r.reform.notes.map((n, i) => (
              <Note key={i}>{n}</Note>
            ))}
          </>
        ) : (
          <Note>Not enough fee detail on the statement to work out the reform's effect.</Note>
        )}
      </Card>

      <Card title="Surcharge Impact">
        <View style={st.switchRow}>
          <Text style={{ fontSize: 15, color: C.ink, flex: 1 }}>Merchant surcharges today</Text>
          <Switch
            value={surcharging}
            onValueChange={setSurcharging}
            trackColor={{ true: C.teal, false: C.line }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Merchant surcharges today"
          />
        </View>
        {surcharging ? <NumField label="Current surcharge %" value={rate} onChange={setRate} /> : null}
        <Row label="Sales covered by the ban (eftpos, Visa, Mastercard)" value={`${fmtMoney(base)}/mo`} />
        <Row label="Surcharge income lost" value={`−${fmtMoney(lost)}/mo`} tone="bad" />
        <Row label="Fee saving from 1 Oct" value={`+${fmtMoney(saving)}/mo`} tone="good" />
        <Highlight label="Net impact from 1 Oct" value={`${net < 0 ? '−' : '+'}${fmtMoney(Math.abs(net))}/mo`} />
        {priceRise > 0 ? <Note>≈ {priceRise.toFixed(2)}% price rise needed to offset. Amex surcharges aren't covered by the ban.</Note> : null}
      </Card>

      {r.checks.length ? (
        <Card title="Things to Note">
          <Checks checks={r.checks} />
        </Card>
      ) : null}

      <Note>
        {'\n'}Estimates from the statement figures you confirmed; actual savings depend on the merchant's acquirer passing on the
        lower interchange and on how routing is set up on their terminals.
      </Note>

      <View style={{ marginTop: 18, gap: 10 }}>
        <Button
          label="Edit figures"
          kind="secondary"
          onPress={() => {
            update({ checks: r.checks });
            router.push('/check');
          }}
        />
        <Button label="Done" onPress={() => router.dismissTo('/')} />
      </View>
    </ScrollView>
  );
}

function Tile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={st.tile}>
      <Text style={st.tileLabel}>{label}</Text>
      <Text style={st.tileValue} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </Text>
      <Text style={st.tileUnit}>{unit}</Text>
    </View>
  );
}

function ReformTable({ today, after, lcr }: { today: Stage; after: Stage; lcr: Stage }) {
  const rows: [string, keyof Stage][] = [
    ['Interchange', 'interchange'],
    ['Scheme fees', 'scheme'],
    ['Processing', 'processing'],
    ['Total', 'total'],
  ];
  const cell = (v: number, prev?: number) => (
    <Text style={[st.td, prev !== undefined && Math.abs(v - prev) < 0.5 ? { color: C.muted } : null]}>{fmtMoney(v)}</Text>
  );
  return (
    <View style={st.table} accessibilityLabel="Monthly fees today, from 1 October, and with routing">
      <View style={st.tr}>
        <Text style={[st.th, { flex: 1.4, textAlign: 'left' }]} />
        <Text style={st.th}>Today</Text>
        <Text style={st.th}>1 Oct</Text>
        <Text style={st.th}>+ routing</Text>
      </View>
      {rows.map(([label, k]) => (
        <View key={k} style={[st.tr, k === 'total' ? st.trTotal : null]}>
          <Text style={[st.td, { flex: 1.4, textAlign: 'left' }, k === 'total' ? { fontWeight: '800' } : null]}>{label}</Text>
          {cell(today[k])}
          {cell(after[k], today[k])}
          {cell(lcr[k], after[k])}
        </View>
      ))}
      <View style={st.tr}>
        <Text style={[st.td, { flex: 1.4, textAlign: 'left', color: C.orange, fontWeight: '700' }]}>Effective rate</Text>
        {[today, after, lcr].map((x, i) => (
          <Text key={i} style={[st.td, { color: C.orange, fontWeight: '700' }]}>
            {fmtPct(x.rate)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  head: { alignItems: 'center', marginTop: 4 },
  merchant: { fontSize: 24, fontWeight: '800', color: C.ink, textAlign: 'center' },
  sub: { fontSize: 13, color: C.muted, marginTop: 4, textAlign: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#F6EFE2', borderRadius: 14, padding: 12 },
  tileLabel: { fontSize: 12, fontWeight: '700', color: C.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
  tileValue: { fontSize: 26, fontWeight: '800', color: C.orange, marginTop: 2 },
  tileUnit: { fontSize: 12, color: C.ink },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 2 },
  donuts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: 12 },
  table: { borderTopWidth: 1, borderColor: C.line },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: C.line, paddingVertical: 8, alignItems: 'center' },
  trTotal: { backgroundColor: '#F6EFE2' },
  th: { flex: 1, fontSize: 12, fontWeight: '700', color: C.muted, textAlign: 'right' },
  td: { flex: 1, fontSize: 13, color: C.ink, textAlign: 'right' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});

