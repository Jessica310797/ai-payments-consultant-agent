import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { C } from '../lib/theme';
import type { Check } from '../lib/types';

/** Cream card with the teal pill title sitting on its top edge, like the dashboard. */
export function Card({ title, children, style }: { title?: string; children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[s.card, title ? s.cardWithTitle : null, style]}>
      {title ? (
        <View style={s.pillWrap} pointerEvents="none">
          <Text style={s.pill}>{title}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  busy,
  icon,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'accent' | 'ghost';
  disabled?: boolean;
  busy?: boolean;
  icon?: string;
}) {
  const bg = { primary: C.teal, accent: C.orange, secondary: C.card, ghost: 'transparent' }[kind];
  const fg = kind === 'primary' || kind === 'accent' ? '#FFFFFF' : C.teal;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: bg, borderColor: kind === 'ghost' ? 'transparent' : C.teal, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.buttonText, { color: fg }]}>{icon ? `${icon}  ` : ''}{label}</Text>}
    </Pressable>
  );
}

/** Text box for a number: keeps what's typed while editing and reports a number (or null when empty). */
export function NumField({
  label,
  value,
  onChange,
  prefix,
  integer,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  prefix?: string;
  integer?: boolean;
}) {
  const raw = (v: number | null) => (v === null || v === undefined ? '' : String(integer ? Math.round(v) : v));
  // Commas while not editing (1,540,000), plain digits while typing.
  const pretty = (v: number | null) =>
    v === null || v === undefined ? '' : v.toLocaleString('en-AU', { maximumFractionDigits: integer ? 0 : 2 });
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(raw(value));
  useEffect(() => {
    const parsed = text.trim() === '' ? null : Number(text.replace(/[,$\s]/g, ''));
    if (parsed !== value) setText(raw(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.inputRow}>
        {prefix ? <Text style={s.prefix}>{prefix}</Text> : null}
        <TextInput
          style={s.input}
          value={focused ? text : pretty(value)}
          onFocus={() => {
            setText(raw(value));
            setFocused(true);
          }}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          inputMode={integer ? 'numeric' : 'decimal'}
          keyboardType={integer ? 'number-pad' : 'decimal-pad'}
          placeholder="—"
          placeholderTextColor={C.muted}
          onChangeText={(t) => {
            setText(t);
            const clean = t.replace(/[,$\s]/g, '');
            if (clean === '') onChange(null);
            else if (!Number.isNaN(Number(clean))) onChange(Number(clean));
          }}
        />
      </View>
    </View>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  secure,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, s.inputBox]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={secure}
      />
    </View>
  );
}

/** One-of-many choice shown as pills. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <View style={s.chips}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o)}
            style={[s.chip, on ? s.chipOn : null]}
          >
            <Text style={[s.chipText, on ? s.chipTextOn : null]}>{labels?.[o] ?? o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Checks({ checks }: { checks: Check[] }) {
  if (!checks.length) {
    return (
      <View style={[s.notice, { backgroundColor: '#E6F3EA' }]}>
        <Text style={[s.noticeText, { color: C.good }]}>✓  The totals and scheme lines agree with each other.</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {checks.map((c, i) => (
        <View key={i} style={[s.notice, { backgroundColor: c.level === 'warn' ? C.warnBg : C.infoBg }]}>
          <Text style={s.noticeText}>
            {c.level === 'warn' ? '⚠️  ' : 'ℹ️  '}
            {c.message}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Orange call-out with a label and a big number. */
export function Highlight({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.highlight}>
      <Text style={s.highlightLabel}>{label}</Text>
      <Text style={s.highlightValue} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function Row({ label, value, tone, bold }: { label: string; value: string; tone?: 'good' | 'bad'; bold?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, bold ? { fontWeight: '700' } : null]}>{label}</Text>
      <Text style={[s.rowValue, tone ? { color: tone === 'good' ? C.good : C.bad } : null, bold ? { fontWeight: '800' } : null]}>
        {value}
      </Text>
    </View>
  );
}

export const Note = ({ children }: { children: ReactNode }) => <Text style={s.note}>{children}</Text>;

export const s = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderColor: C.teal,
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 16,
    marginTop: 14,
    gap: 10,
  },
  cardWithTitle: { marginTop: 30, paddingTop: 28 },
  pillWrap: { position: 'absolute', top: -16, left: 0, right: 0, alignItems: 'center' },
  pill: {
    backgroundColor: C.teal,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 26,
    overflow: 'hidden',
  },
  button: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  field: { flex: 1, minWidth: 140, gap: 4 },
  label: { fontSize: 13, color: C.muted, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2EEE6',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  prefix: { color: C.muted, fontSize: 16, marginRight: 2 },
  input: { flex: 1, fontSize: 16, color: C.ink, paddingVertical: 12, minHeight: 46 },
  inputBox: { backgroundColor: '#F2EEE6', borderRadius: 10, paddingHorizontal: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: C.teal,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: C.teal },
  chipText: { color: C.teal, fontWeight: '600', fontSize: 14 },
  chipTextOn: { color: '#FFFFFF' },
  notice: { borderRadius: 12, padding: 12 },
  noticeText: { color: C.ink, fontSize: 14, lineHeight: 20 },
  highlight: {
    backgroundColor: C.orange,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  highlightLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 15, flexShrink: 1 },
  highlightValue: { color: '#FFFFFF', fontWeight: '800', fontSize: 28, flexShrink: 0, maxWidth: '60%' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: 12 },
  rowLabel: { color: C.ink, fontSize: 14, flexShrink: 1 },
  rowValue: { color: C.ink, fontSize: 14, fontWeight: '600' },
  note: { color: C.muted, fontSize: 12, lineHeight: 18 },
  h2: { fontSize: 15, fontWeight: '700', color: C.ink },
});
