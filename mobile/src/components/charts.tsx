import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { C, SCHEME_COLOURS } from '../lib/theme';
import type { RoutingRow } from '../lib/types';

/** Donut of scheme shares with the card type and its share of sales in the middle. */
export function Donut({
  parts,
  title,
  subtitle,
  size = 132,
}: {
  parts: { label: string; share: number }[];
  title: string;
  subtitle: string;
  size?: number;
}) {
  const stroke = 22;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <View style={{ alignItems: 'center' }} accessible accessibilityLabel={`${title} ${subtitle}: ${parts.map((p) => `${p.label} ${p.share.toFixed(0)}%`).join(', ')}`}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.line} strokeWidth={stroke} fill="none" />
          {parts.map((p) => {
            const len = (p.share / 100) * circ;
            const el = (
              <Circle
                key={p.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={SCHEME_COLOURS[p.label] ?? C.muted}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${Math.max(len - 2, 0)} ${circ}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </Svg>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontWeight: '700', color: C.ink, fontSize: 14 }}>{title}</Text>
          <Text style={{ color: C.ink, fontSize: 13 }}>{subtitle}</Text>
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
          <Text style={{ color: C.ink, fontSize: 13 }}>{m === 'Eftpos' ? 'eftpos' : m}</Text>
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
              <Text style={{ fontWeight: '700', color: C.ink }}>{row.scheme === 'Eftpos' ? 'eftpos' : row.scheme} debit</Text>
              <Text style={{ color: C.muted, fontSize: 13 }}>{valueLabel(row.value)}</Text>
            </View>
            <View style={{ flexDirection: 'row', height: 12, borderRadius: 999, overflow: 'hidden', backgroundColor: C.line, gap: 2 }}>
              {shares.map(([n, v]) => (
                <View key={n} style={{ width: `${v}%`, backgroundColor: SCHEME_COLOURS[n] ?? C.muted }} />
              ))}
            </View>
            <Text style={{ color: C.ink, fontSize: 13 }}>
              {shares.map(([n, v]) => `→ ${n === 'Eftpos' ? 'eftpos' : n} ${v.toFixed(0)}%`).join('   ')}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
