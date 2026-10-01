import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Checks, Chips, Note, NumField, TextField, s as ui } from '../components/ui';
import { ApiError, buildReport, checkDraft } from '../lib/api';
import { newId, saveCheck } from '../lib/storage';
import { useVisit } from '../lib/store';
import { fmtMoney, fmtNumber } from '../lib/format';
import { C, SCHEME_COLOURS } from '../lib/theme';
import type { CardType, Draft, Line, Scheme } from '../lib/types';

const SCHEMES: readonly Scheme[] = ['Visa', 'Mastercard', 'Eftpos', 'Amex', 'Other'];
const CARD_TYPES: readonly CardType[] = ['debit', 'credit', 'all'];
const MODELS = ['interchange_plus_plus', 'blended', 'unknown'] as const;
const MODEL_LABELS = { interchange_plus_plus: 'Interchange++', blended: 'Blended MSF', unknown: 'Not clear' };
const TOTALS: [keyof Draft, string, boolean?][] = [
  ['total_card_value', 'Card sales'],
  ['total_transactions', 'Transactions', true],
  ['interchange_fees', 'Interchange'],
  ['scheme_fees', 'Scheme fees'],
  ['acquiring_fees', 'Acquiring / processing'],
  ['other_fees', 'Other fees'],
  ['total_fees', 'Total fees'],
];

// Dates are stored as YYYY-MM-DD (like the API) and typed as DD/MM/YYYY.
const toDisplay = (iso: string | null) => {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso ?? '';
};
const toIso = (text: string) => {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : text.trim() || null;
};

export default function CheckFigures() {
  const insets = useSafeAreaInsets();
  const { visit, update } = useVisit();
  const [draft, setDraft] = useState<Draft | null>(visit.draft);
  const [dates, setDates] = useState({ start: toDisplay(visit.draft?.period_start ?? null), end: toDisplay(visit.draft?.period_end ?? null) });
  const [busy, setBusy] = useState<'check' | 'confirm' | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!draft) {
    return (
      <View style={{ padding: 16 }}>
        <Card>
          <Note>No statement has been read yet.</Note>
          <Button label="Back to start" onPress={() => router.replace('/')} />
        </Card>
      </View>
    );
  }

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const setLine = (i: number, patch: Partial<Line>) =>
    set({ lines: draft.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const current = (): Draft => ({ ...draft, period_start: toIso(dates.start), period_end: toIso(dates.end) });

  const recheck = async () => {
    setBusy('check');
    setError(null);
    try {
      const out = await checkDraft(current());
      update({ draft: current(), checks: out.checks });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Couldn\'t re-check the figures.');
    } finally {
      setBusy(null);
    }
  };

  const confirm = async () => {
    setBusy('confirm');
    setError(null);
    try {
      const confirmed = current();
      const report = await buildReport(confirmed);
      const id = visit.id ?? newId();
      await saveCheck({ id, savedAt: new Date().toISOString(), draft: confirmed, report });
      update({ id, draft: confirmed, report, checks: report.checks });
      router.replace('/results');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Couldn\'t work out the results.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
      <Text style={st.lead}>
        Check these figures against the statement and fix anything that's wrong. Results only use what you confirm.
      </Text>

      <Card title="Checks">
        <Checks checks={visit.checks} />
        {visit.notes ? <Note>Claude's note: {visit.notes}</Note> : null}
      </Card>

      <Card title="Merchant">
        <TextField label="Merchant" value={draft.merchant_name ?? ''} onChange={(v) => set({ merchant_name: v || null })} />
        <TextField label="Acquirer / provider" value={draft.acquirer ?? ''} onChange={(v) => set({ acquirer: v || null })} />
        <View style={st.grid}>
          <TextField label="Period from" value={dates.start} placeholder="DD/MM/YYYY" onChange={(v) => setDates({ ...dates, start: v })} />
          <TextField label="Period to" value={dates.end} placeholder="DD/MM/YYYY" onChange={(v) => setDates({ ...dates, end: v })} />
        </View>
        <Text style={ui.label}>Pricing</Text>
        <Chips options={MODELS} labels={MODEL_LABELS} value={draft.pricing_model ?? 'unknown'} onChange={(v) => set({ pricing_model: v })} />
      </Card>

      <Card title="Statement Totals">
        <View style={st.grid}>
          {TOTALS.map(([key, label, integer]) => (
            <NumField
              key={key}
              label={label}
              prefix={integer ? undefined : '$'}
              integer={integer}
              value={draft[key] as number | null}
              onChange={(v) => set({ [key]: v } as Partial<Draft>)}
            />
          ))}
        </View>
      </Card>

      <Card title="Scheme Lines">
        <Note>One line per scheme and card type on the statement. Fees in dollars.</Note>
        {draft.lines.map((l, i) => {
          const fees = [l.interchange, l.scheme_fees, l.acquiring].reduce<number>((a, v) => a + (v ?? 0), 0);
          const name = `${l.scheme === 'Eftpos' ? 'eftpos' : l.scheme}${l.card_type === 'all' ? '' : ` ${l.card_type}`}`;
          if (open !== i) {
            return (
              <Pressable
                key={i}
                onPress={() => setOpen(i)}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${name}`}
                style={[st.line, st.lineHead, { borderLeftColor: SCHEME_COLOURS[l.scheme] ?? C.muted }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={ui.h2}>{name}</Text>
                  <Text style={st.lineSub}>
                    {fmtMoney(l.value)} sales · {fmtNumber(l.transactions)} txns · {fmtMoney(fees)} fees
                  </Text>
                </View>
                <Text style={{ color: C.teal, fontWeight: '700' }}>Edit ›</Text>
              </Pressable>
            );
          }
          return (
            <View key={i} style={[st.line, { borderLeftColor: SCHEME_COLOURS[l.scheme] ?? C.muted }]}>
              <View style={st.lineHead}>
                <Text style={ui.h2}>{name}</Text>
                <View style={{ flexDirection: 'row', gap: 18 }}>
                  <Pressable
                    onPress={() => {
                      set({ lines: draft.lines.filter((_, j) => j !== i) });
                      setOpen(null);
                    }}
                    accessibilityLabel={`Remove ${name}`}
                    hitSlop={10}
                  >
                    <Text style={{ color: C.bad, fontWeight: '700' }}>Remove</Text>
                  </Pressable>
                  <Pressable onPress={() => setOpen(null)} accessibilityLabel="Done editing this line" hitSlop={10}>
                    <Text style={{ color: C.teal, fontWeight: '700' }}>Done</Text>
                  </Pressable>
                </View>
              </View>
              <Chips options={SCHEMES} value={l.scheme} onChange={(v) => setLine(i, { scheme: v })} labels={{ Eftpos: 'eftpos' }} />
              <Chips options={CARD_TYPES} value={l.card_type} onChange={(v) => setLine(i, { card_type: v })} labels={{ all: 'not split' }} />
              <View style={st.grid}>
                <NumField label="Sales" prefix="$" value={l.value} onChange={(v) => setLine(i, { value: v })} />
                <NumField label="Transactions" integer value={l.transactions} onChange={(v) => setLine(i, { transactions: v })} />
                <NumField label="Interchange" prefix="$" value={l.interchange} onChange={(v) => setLine(i, { interchange: v })} />
                <NumField label="Scheme fees" prefix="$" value={l.scheme_fees} onChange={(v) => setLine(i, { scheme_fees: v })} />
                <NumField label="Acquiring" prefix="$" value={l.acquiring} onChange={(v) => setLine(i, { acquiring: v })} />
              </View>
            </View>
          );
        })}
        <Button
          label="Add a line"
          icon="＋"
          kind="secondary"
          onPress={() => {
            setOpen(draft.lines.length);
            set({
              lines: [
                ...draft.lines,
                { scheme: 'Visa', card_type: 'debit', value: null, transactions: null, interchange: null, scheme_fees: null, acquiring: null },
              ],
            });
          }}
        />
      </Card>

      {error ? (
        <View style={st.error}>
          <Text style={{ color: C.bad, fontSize: 14, lineHeight: 20 }}>{error}</Text>
        </View>
      ) : null}

      <View style={{ marginTop: 18, gap: 10 }}>
        <Button label="Re-check" kind="secondary" onPress={recheck} busy={busy === 'check'} disabled={busy !== null} />
        <Button label="Confirm figures" onPress={confirm} busy={busy === 'confirm'} disabled={busy !== null} />
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  lead: { fontSize: 15, color: C.ink, lineHeight: 21, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  line: { borderLeftWidth: 5, paddingLeft: 12, gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  lineHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  lineSub: { fontSize: 13, color: C.muted, marginTop: 2 },
  error: { marginTop: 14, backgroundColor: '#FBE9E2', borderRadius: 12, padding: 12 },
});
