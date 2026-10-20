import type { Applicability, ChangeStatus } from '@shared/data/types';
import type { NextAction } from '@shared/lib/actions';
import type { Finding } from '@shared/lib/audit';
import { count, dateLong, money, pct } from '@shared/lib/format';
import { pctChange, ppChange, type Change } from '@shared/lib/metrics';
import { router } from 'expo-router';
import { CalendarDays, ChevronRight, CircleCheck, CircleHelp, CreditCard, FileText, Route, Sparkles, TrendingUp, TriangleAlert } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useData } from '../lib/data';
import { C, shadow } from '../lib/theme';
import { CostTrendChart, DriversDonut, DriversLegend } from './charts';
import { Delta, PeriodSelector } from './data-ui';
import { Badge, Card, CardHeader, Tap, Text, TextLink, cap, priorityTone, type Tone } from './ui';

export function SummaryCard() {
  const { derived } = useData();
  if (!derived) return null;
  const { now, before, period, series } = derived;
  const metrics: { label: string; value: string; change: Change | null; upIsGood: boolean }[] = [
    { label: 'Total transactions', value: count(now.transactions), change: before ? pctChange(now.transactions, before.transactions) : null, upIsGood: true },
    { label: 'Payment volume', value: money(now.value), change: before ? pctChange(now.value, before.value) : null, upIsGood: true },
    { label: 'Total payment costs', value: money(now.cost), change: before ? pctChange(now.cost, before.cost) : null, upIsGood: false },
    { label: 'Effective cost rate', value: pct(now.rate), change: before ? ppChange(now.rate, before.rate) : null, upIsGood: false },
  ];
  return (
    <Card>
      <CardHeader title="Transaction & cost summary" link="/costs" linkLabel="View details" />
      <View style={st.metrics}>
        {metrics.map((m, i) => (
          <View key={m.label} style={[st.metric, i % 2 === 1 ? st.metricRight : null]}>
            <Text style={{ fontSize: 13, color: C.subtle }}>{m.label}</Text>
            <Text style={{ fontSize: 22, fontWeight: '600', letterSpacing: -0.4, marginTop: 4 }}>{m.value}</Text>
            <Delta change={m.change} upIsGood={m.upIsGood} compareLabel={period.comparisonLabel} />
          </View>
        ))}
      </View>
      <View style={{ borderTopWidth: 1, borderColor: C.line, paddingTop: 14, gap: 10 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: C.subtle }}>Total payment costs (AUD)</Text>
          <PeriodSelector />
        </View>
        <CostTrendChart series={series} current={period.current} />
      </View>
    </Card>
  );
}

function IconTile({ bg, children }: { bg: string; children: ReactNode }) {
  return <View style={[st.iconTile, { backgroundColor: bg }]}>{children}</View>;
}

export function OctoberPanel() {
  const { data, derived } = useData();
  if (!data || !derived) return null;
  const surcharge = data.changes.find((c) => c.id === 'surcharging');
  const unverified = data.changes.filter((c) => c.status === 'unverified').length;
  const { now, before } = derived;
  const costUp = before && before.cost ? ((now.cost - before.cost) / before.cost) * 100 : null;
  const rows: { onPress: () => void; icon: ReactNode; title: string; summary: string; action: string; tone: Tone; meta: string }[] = [
    {
      onPress: () => (surcharge ? router.push({ pathname: '/change/[id]', params: { id: surcharge.id } }) : router.navigate('/october')),
      icon: <IconTile bg="#EAF1EC"><CreditCard size={20} color={C.brandDark} /></IconTile>,
      title: 'Surcharge applicability',
      summary: 'Check which rules apply to your payment methods and customer charges.',
      action: 'Assess applicability', tone: 'amber',
      meta: surcharge
        ? `${surcharge.status === 'unverified' ? 'Unverified' : 'Confirmed'} · Effective ${surcharge.effectiveDate ? dateLong(surcharge.effectiveDate) : 'not set'}${surcharge.effectiveDateVerified ? '' : ' (to confirm)'}`
        : 'Not assessed',
    },
    {
      onPress: () => router.push('/costs'),
      icon: <IconTile bg={C.dangerSoft}><TrendingUp size={20} color={C.danger} /></IconTile>,
      title: 'Payment cost increases',
      summary: 'Investigate changes in processor fees, scheme fees, interchange and effective rates.',
      action: 'Investigate costs', tone: costUp != null && costUp > 0 ? 'danger' : 'neutral',
      meta: costUp != null ? `Seen in your data · Costs ${costUp >= 0 ? 'up' : 'down'} ${Math.abs(costUp).toFixed(1)}% vs ${derived.period.comparisonLabel}` : 'No comparison period',
    },
    {
      onPress: () => router.navigate('/october'),
      icon: <IconTile bg={C.infoSoft}><FileText size={20} color={C.info} /></IconTile>,
      title: 'Regulatory change log',
      summary: 'Review confirmed changes, effective dates, affected merchants and required actions.',
      action: 'View October updates', tone: 'neutral',
      meta: `${data.changes.length} items · ${unverified} to confirm against the source`,
    },
  ];
  const needsAction = unverified > 0 || (costUp ?? 0) > 0;
  return (
    <View style={st.sagePanel}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 4 }}>
        <View style={st.calendar}><CalendarDays size={22} color="#FFFFFF" /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '600' }} accessibilityRole="header">October changes</Text>
          <Text style={{ fontSize: 13, color: C.subtle }}>Regulation, surcharging and cost updates</Text>
        </View>
        {needsAction ? (
          <Tap onPress={() => router.navigate('/october')} style={st.actionRequired} label="Action required: open October changes">
            <Text style={{ fontSize: 12, fontWeight: '500', color: C.danger }}>Action required</Text>
            <ChevronRight size={14} color={C.danger} />
          </Tap>
        ) : null}
      </View>
      <View style={st.rowsCard}>
        {rows.map((r, i) => (
          <Tap key={r.title} onPress={r.onPress} label={r.title} style={[st.panelRow, i ? { borderTopWidth: 1, borderColor: C.line } : null]}>
            {r.icon}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 15, fontWeight: '600' }}>{r.title}</Text>
              <Badge tone={r.tone} label={r.action} />
              <Text style={{ fontSize: 13, lineHeight: 19, color: C.subtle }}>{r.summary}</Text>
              <Text style={{ fontSize: 12, color: C.muted }}>{r.meta}</Text>
            </View>
            <ChevronRight size={18} color={C.muted} style={{ marginTop: 2 }} />
          </Tap>
        ))}
      </View>
      <TextLink to="/october" label="See all October updates" style={{ paddingHorizontal: 6, paddingTop: 4 }} />
    </View>
  );
}

export function CostDriversCard() {
  const { derived } = useData();
  if (!derived) return null;
  return (
    <Card>
      <CardHeader title="Top cost drivers" link="/drivers" linkLabel="View detail" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <DriversDonut drivers={derived.drivers} total={derived.now.cost} />
        <DriversLegend drivers={derived.drivers} />
      </View>
    </Card>
  );
}

export const KIND: Record<Finding['kind'], { label: string; tone: Tone }> = {
  confirmed: { label: 'Confirmed', tone: 'danger' },
  potential: { label: 'Opportunity', tone: 'amber' },
  clear: { label: 'No issue', tone: 'brand' },
  'needs-data': { label: 'Needs data', tone: 'neutral' },
};

export function FindingIcon({ f }: { f: Finding }) {
  const [bg, fg, Icon] =
    f.kind === 'confirmed' ? [C.dangerSoft, C.danger, TriangleAlert]
    : f.kind === 'potential' ? [C.amberSoft, C.amber, f.id === 'routing' ? Route : CircleHelp]
    : f.kind === 'clear' ? [C.brandSoft, C.brand, CircleCheck]
    : ['#EEF0EC', C.subtle, CircleHelp];
  return <View style={[st.round, { backgroundColor: bg }]}><Icon size={19} color={fg} /></View>;
}

export const openFinding = (id: string) => router.push({ pathname: '/finding/[id]', params: { id } });

export function FindingRow({ f, boxed }: { f: Finding; boxed?: boolean }) {
  return (
    <Tap onPress={() => openFinding(f.id)} label={`${f.title}: ${f.headline}`} style={[st.findingRow, boxed ? st.boxed : null]}>
      <FindingIcon f={f} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: '600' }}>{f.title}</Text>
          <Badge tone={KIND[f.kind].tone} label={KIND[f.kind].label} />
        </View>
        <Text style={{ fontSize: 13, lineHeight: 19, color: C.subtle }}>{f.headline}</Text>
      </View>
      <ChevronRight size={18} color={C.muted} style={{ marginTop: 10 }} />
    </Tap>
  );
}

export function AuditCard() {
  const { derived } = useData();
  if (!derived) return null;
  const open = derived.findings.filter((f) => f.kind === 'confirmed' || f.kind === 'potential');
  return (
    <Card>
      <CardHeader title="Audit analysis" right={open.length ? <Badge tone="danger" label={`${open.length} finding${open.length > 1 ? 's' : ''}`} /> : <Badge tone="brand" label="No issues" />} />
      <View>
        {derived.findings.map((f, i) => (
          <View key={f.id} style={i ? { borderTopWidth: 1, borderColor: C.line } : null}>
            <FindingRow f={f} />
          </View>
        ))}
      </View>
      <TextLink to="/audit" label="View full audit" />
    </Card>
  );
}

export const STATUS_LABEL = { open: 'Not started', 'in-progress': 'In progress', done: 'Done' } as const;

export function ActionCard({ a, rank }: { a: NextAction; rank: number }) {
  const { actionStatus } = useData();
  const status = actionStatus[a.id] ?? 'open';
  return (
    <Tap onPress={() => router.push({ pathname: '/action/[id]', params: { id: a.id } })} label={`Rank ${rank}: ${a.title}`} style={[st.boxed, { gap: 8 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={[st.rank, rank === 1 ? { backgroundColor: C.brandDark } : null]}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: rank === 1 ? '#FFFFFF' : C.brandDark }}>{rank}</Text>
        </View>
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '600' }}>{a.title}</Text>
        <ChevronRight size={16} color={C.muted} />
      </View>
      <Text style={{ fontSize: 13, lineHeight: 19, color: C.subtle }}>{a.reason}</Text>
      {a.impact ? <Text style={{ fontSize: 12, fontWeight: '500' }}>Impact: {a.impact}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Badge tone={priorityTone(a.priority)} label={`${cap(a.priority)} priority`} />
        <Badge label={`${cap(a.confidence)} confidence`} />
        <Badge tone={status === 'done' ? 'brand' : status === 'in-progress' ? 'info' : 'neutral'} label={STATUS_LABEL[status]} />
      </View>
    </Tap>
  );
}

export function NextActions() {
  const { derived } = useData();
  if (!derived) return null;
  return (
    <View style={st.sagePanel}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 4 }}>
        <Sparkles size={22} color={C.brandDark} style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600' }} accessibilityRole="header">Recommended next actions</Text>
          <Text style={{ fontSize: 13, color: C.subtle }}>Prioritised by potential impact and urgency</Text>
        </View>
        <TextLink to="/actions" label="View all" style={{ marginTop: 2 }} />
      </View>
      <View style={{ gap: 10 }}>
        {derived.actions.slice(0, 3).map((a, i) => <ActionCard key={a.id} a={a} rank={i + 1} />)}
      </View>
    </View>
  );
}

export const CHANGE_STATUS: Record<ChangeStatus, { label: string; tone: Tone; help: string }> = {
  confirmed: { label: 'Confirmed', tone: 'brand', help: 'Confirmed from the source shown.' },
  observed: { label: 'Seen in your data', tone: 'info', help: 'Visible in this merchant\'s fees; the cause isn\'t confirmed yet.' },
  unverified: { label: 'To confirm', tone: 'amber', help: 'Not yet confirmed against the official source. Don\'t rely on it until it is.' },
};
export const APPLIES: Record<Applicability, { label: string; tone: Tone }> = {
  applies: { label: 'Applies', tone: 'danger' },
  likely: { label: 'Likely applies', tone: 'amber' },
  'not-assessed': { label: 'Not assessed', tone: 'neutral' },
  'does-not-apply': { label: 'Doesn\'t apply', tone: 'brand' },
};

const st = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  metric: { width: '50%', paddingRight: 12 },
  metricRight: { borderLeftWidth: 1, borderColor: C.line, paddingLeft: 14 },
  sagePanel: { backgroundColor: C.sage, borderRadius: 16, padding: 12, gap: 10 },
  calendar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.brandDark, alignItems: 'center', justifyContent: 'center' },
  actionRequired: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: C.dangerSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  rowsCard: { backgroundColor: C.card, borderRadius: 12, overflow: 'hidden' },
  panelRow: { flexDirection: 'row', gap: 12, padding: 14 },
  iconTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  findingRow: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  boxed: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, ...shadow },
  rank: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.sage, alignItems: 'center', justifyContent: 'center' },
});
