import { money, monthLong, monthShort, pct } from '@shared/lib/format';
import type { Driver, MonthPoint } from '@shared/lib/metrics';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { C, DRIVER_COLOURS, F, SCHEME_COLOURS } from '../lib/theme';
import type { RoutingRow } from '../lib/types';
import { Text } from './ui';

/** Monthly total payment costs. Tap the chart to read a month; the selected reporting period is shaded. */
export function CostTrendChart({ series, current, height = 176 }: { series: MonthPoint[]; current: string[]; height?: number }) {
  const [width, setWidth] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  if (series.length < 2) return <Text style={{ textAlign: 'center', color: C.muted, paddingVertical: 24 }}>Not enough months to show a trend.</Text>;
  const left = 48, right = 30, top = 30, bottom = 22;
  const max = Math.max(...series.map((s) => s.cost)), min = Math.min(...series.map((s) => s.cost));
  const pad = (max - min) * 0.25 || max * 0.1;
  const lo = Math.max(0, Math.floor((min - pad) / 1e4) * 1e4), hi = Math.ceil((max + pad) / 1e4) * 1e4;
  const w = Math.max(width - left - right, 1), h = height - top - bottom;
  const x = (i: number) => left + (i / (series.length - 1)) * w;
  const y = (v: number) => top + h - ((v - lo) / (hi - lo || 1)) * h;
  const ticks = [0, 1, 2, 3].map((k) => lo + ((hi - lo) * k) / 3);
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.cost)}`).join(' ');
  const area = `${line} L${x(series.length - 1)},${top + h} L${x(0)},${top + h} Z`;
  const i0 = series.findIndex((p) => p.month === current[0]);
  const i1 = series.findIndex((p) => p.month === current[current.length - 1]);
  const last = series.length - 1;
  const shown = sel ?? last;
  const p = series[shown];
  const summary = `Total payment costs by month, ${monthLong(series[0].month)} to ${monthLong(series[last].month)}: from ${money(series[0].cost)} to ${money(series[last].cost)}.`;
  const pick = (px: number) => setSel(Math.max(0, Math.min(last, Math.round(((px - left) / w) * last))));
  const labelEvery = series.length > 8 ? 2 : 1;

  return (
    <View>
      <Text style={{ fontSize: 12, color: C.subtle }} accessibilityLiveRegion="polite">
        {monthLong(p.month)} · <Text style={{ fontSize: 12, fontWeight: '600' }}>{money(p.cost, { exact: true })}</Text> · {pct(p.rate)} effective rate
      </Text>
      <Pressable
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onPress={(e) => pick(e.nativeEvent.locationX)}
        accessibilityRole="adjustable"
        accessibilityLabel={summary}
        accessibilityValue={{ text: `${monthLong(p.month)}: ${money(p.cost)}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => setSel(Math.max(0, Math.min(last, shown + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}
        style={{ height }}
      >
        {width > 0 ? (
          <Svg width={width} height={height}>
            {i0 >= 0 && i1 > i0 ? <Rect x={x(i0)} y={top} width={x(i1) - x(i0)} height={h} fill={C.sage} opacity={0.6} /> : null}
            {ticks.map((t) => (
              <Line key={t} x1={left} x2={left + w} y1={y(t)} y2={y(t)} stroke="#EDEFEB" strokeWidth={1} />
            ))}
            {ticks.map((t) => (
              <SvgText key={`l${t}`} x={left - 8} y={y(t) + 4} fontSize={11} fill={C.subtle} textAnchor="end" fontFamily={F.regular}>{money(t)}</SvgText>
            ))}
            <Path d={area} fill={C.brand} opacity={0.06} />
            <Path d={line} stroke={C.brand} strokeWidth={2} fill="none" />
            {series.map((pt, i) => (
              <Circle key={pt.month} cx={x(i)} cy={y(pt.cost)} r={i === shown ? 5 : 3} fill={C.brand} stroke={i === shown ? '#FFFFFF' : 'none'} strokeWidth={2} />
            ))}
            {series.map((pt, i) =>
              i % labelEvery === 0 || i === last ? (
                <SvgText key={`m${pt.month}`} x={x(i)} y={height - 4} fontSize={11} fill={C.subtle} textAnchor="middle" fontFamily={F.regular}>{monthShort(pt.month)}</SvgText>
              ) : null,
            )}
            <Rect x={x(last) - 30} y={y(series[last].cost) - 30} width={60} height={22} rx={6} fill="#FFFFFF" stroke="#C9D7CC" />
            <SvgText x={x(last)} y={y(series[last].cost) - 15} fontSize={12} fill={C.brandDark} textAnchor="middle" fontFamily={F.semibold}>{money(series[last].cost)}</SvgText>
          </Svg>
        ) : null}
      </Pressable>
    </View>
  );
}

function Ring({ parts, size, stroke, colour }: { parts: { key: string; share: number }[]; size: number; stroke: number; colour: (k: string, i: number) => string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const lengths = parts.map((p) => (p.share / 100) * circ);
  const offsets = lengths.map((_, i) => lengths.slice(0, i).reduce((a, l) => a + l, 0));
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.line} strokeWidth={stroke} fill="none" />
      {parts.map((p, i) => (
        <Circle key={p.key} cx={size / 2} cy={size / 2} r={r} stroke={colour(p.key, i)} strokeWidth={stroke} fill="none"
          strokeDasharray={`${Math.max(lengths[i] - 2, 0)} ${circ}`} strokeDashoffset={-offsets[i]} />
      ))}
    </Svg>
  );
}

/** Fee drivers doughnut with the total in the middle. */
export function DriversDonut({ drivers, total, size = 128 }: { drivers: Driver[]; total: number; size?: number }) {
  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={`Total costs ${money(total)}: ${drivers.map((d) => `${d.label} ${d.share.toFixed(0)}%`).join(', ')}`}>
      <Ring parts={drivers.map((d) => ({ key: d.component, share: d.share }))} size={size} stroke={size * 0.17} colour={(_, i) => DRIVER_COLOURS[i % DRIVER_COLOURS.length]} />
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 17, fontWeight: '600' }}>{money(total)}</Text>
        <Text style={{ fontSize: 11, color: C.subtle }}>total costs</Text>
      </View>
    </View>
  );
}

export function DriversLegend({ drivers }: { drivers: Driver[] }) {
  return (
    <View style={{ flex: 1, gap: 9 }}>
      {drivers.map((d, i) => (
        <View key={d.component} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: DRIVER_COLOURS[i % DRIVER_COLOURS.length] }} />
          <Text style={{ flex: 1, fontSize: 13 }} numberOfLines={1}>{d.label}</Text>
          <Text style={{ fontSize: 13, color: C.subtle }}>{d.share.toFixed(0)}%</Text>
        </View>
      ))}
    </View>
  );
}

/** Donut of scheme shares with the card type and its share of sales in the middle (statement results). */
export function Donut({ parts, title, subtitle, size = 132 }: { parts: { label: string; share: number }[]; title: string; subtitle: string; size?: number }) {
  return (
    <View style={{ alignItems: 'center' }} accessible accessibilityLabel={`${title} ${subtitle}: ${parts.map((p) => `${p.label} ${p.share.toFixed(0)}%`).join(', ')}`}>
      <View style={{ width: size, height: size }}>
        <Ring parts={parts.map((p) => ({ key: p.label, share: p.share }))} size={size} stroke={22} colour={(k) => SCHEME_COLOURS[k] ?? C.muted} />
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontWeight: '600', fontSize: 14 }}>{title}</Text>
          <Text style={{ fontSize: 13 }}>{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

export function Legend({ items }: { items: string[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
      {items.map((m) => (
        <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: SCHEME_COLOURS[m] ?? C.muted }} />
          <Text style={{ fontSize: 13 }}>{m === 'Eftpos' ? 'eftpos' : m}</Text>
        </View>
      ))}
    </View>
  );
}

/** One debit scheme: a stacked bar of which network its sales run on, eftpos first. */
export function RoutingBars({ rows, valueLabel }: { rows: RoutingRow[]; valueLabel: (v: number) => string }) {
  return (
    <View style={{ gap: 14 }}>
      {rows.map((row) => {
        const shares = Object.entries(row.shares)
          .filter(([, v]) => v >= 0.5)
          .sort(([a], [b]) => (a === 'Eftpos' ? -1 : b === 'Eftpos' ? 1 : 0));
        return (
          <View key={row.scheme} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '600' }}>{row.scheme === 'Eftpos' ? 'eftpos' : row.scheme} debit</Text>
              <Text style={{ color: C.subtle, fontSize: 13 }}>{valueLabel(row.value)}</Text>
            </View>
            <View style={{ flexDirection: 'row', height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: C.line, gap: 2 }}>
              {shares.map(([n, v]) => (
                <View key={n} style={{ width: `${v}%`, backgroundColor: SCHEME_COLOURS[n] ?? C.muted }} />
              ))}
            </View>
            <Text style={{ fontSize: 13, color: C.subtle }}>
              {shares.map(([n, v]) => `→ ${n === 'Eftpos' ? 'eftpos' : n} ${v.toFixed(0)}%`).join('   ')}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
