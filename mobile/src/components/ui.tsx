import { router, type Href } from 'expo-router';
import { ArrowRight, CircleAlert, Inbox, RefreshCw } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, shadow } from '../lib/theme';
import type { Check } from '../lib/types';

/** Text in Inter: picks the font family from fontWeight, since custom fonts don't synthesise weights. */
export function Text({ style, ...rest }: TextProps) {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const w = flat.fontWeight === 'bold' ? 700 : Number(flat.fontWeight) || 400;
  const fontFamily = w >= 700 ? F.bold : w >= 600 ? F.semibold : w >= 500 ? F.medium : F.regular;
  return <RNText {...rest} style={[{ color: C.ink, fontSize: 14 }, flat, { fontFamily, fontWeight: 'normal' }]} />;
}

/** Scrolling page with the standard gutter and room for the tab bar / home indicator. */
export function Screen({ children, tabs, ...rest }: { children: ReactNode; tabs?: boolean } & ScrollViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: tabs ? insets.top + 12 : 16, paddingBottom: (tabs ? 24 : insets.bottom + 32), gap: 16 }}
      keyboardShouldPersistTaps="handled"
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

export function PageTitle({ title, subtitle, eyebrow, right }: { title: string; subtitle?: string; eyebrow?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
        <Text style={s.pageTitle} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={s.pageSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** White card. A title, when given, sits at the top as a compact heading. */
export function Card({ title, children, style, right }: { title?: string; children: ReactNode; style?: StyleProp<ViewStyle>; right?: ReactNode }) {
  return (
    <View style={[s.card, style]}>
      {title ? <CardHeader title={title} right={right} /> : null}
      {children}
    </View>
  );
}

export function CardHeader({ title, subtitle, link, linkLabel, right }: { title: string; subtitle?: string; link?: Href; linkLabel?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={s.cardTitle} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={s.cardSub}>{subtitle}</Text> : null}
      </View>
      {right}
      {link ? <TextLink to={link} label={linkLabel ?? 'View details'} /> : null}
    </View>
  );
}

export function TextLink({ to, label, style }: { to: Href; label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => router.push(to)} hitSlop={10} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 }, style]}>
      <Text style={{ color: C.brand, fontSize: 13, fontWeight: '500' }}>{label}</Text>
      <ArrowRight size={14} color={C.brand} />
    </Pressable>
  );
}

export type Tone = 'danger' | 'amber' | 'brand' | 'neutral' | 'info';
const TONES: Record<Tone, { bg: string; fg: string }> = {
  danger: { bg: C.dangerSoft, fg: C.danger },
  amber: { bg: C.amberSoft, fg: C.amber },
  brand: { bg: C.brandSoft, fg: C.brandDark },
  neutral: { bg: '#EEF0EC', fg: C.subtle },
  info: { bg: C.infoSoft, fg: C.info },
};
export function Badge({ tone = 'neutral', label }: { tone?: Tone; label: string }) {
  return (
    <View style={[s.badge, { backgroundColor: TONES[tone].bg }]}>
      <Text style={{ color: TONES[tone].fg, fontSize: 12, fontWeight: '500' }}>{label}</Text>
    </View>
  );
}
export const priorityTone = (p: 'high' | 'medium' | 'low'): Tone => (p === 'high' ? 'danger' : p === 'medium' ? 'amber' : 'neutral');
export const confidenceTone = (c: 'high' | 'medium' | 'low'): Tone => (c === 'high' ? 'brand' : c === 'medium' ? 'amber' : 'neutral');
export const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/** Pressable row/card with a pressed state; used for every tappable list item. */
export function Tap({ onPress, onLongPress, children, style, label }: { onPress: () => void; onLongPress?: () => void; children: ReactNode; style?: StyleProp<ViewStyle>; label?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [style, pressed ? { opacity: 0.7 } : null]}>
      {children}
    </Pressable>
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
  icon?: ReactNode;
}) {
  const filled = kind === 'primary' || kind === 'accent';
  const fg = filled ? '#FFFFFF' : kind === 'ghost' ? C.brand : C.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        s.button,
        filled ? { backgroundColor: pressed ? C.brandDark : C.brand } : kind === 'secondary' ? { backgroundColor: C.card, borderWidth: 1, borderColor: C.line } : { backgroundColor: pressed ? C.brandSoft : 'transparent' },
        { opacity: disabled ? 0.45 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {typeof icon === 'string' ? <Text style={[s.buttonText, { color: fg }]}>{icon}</Text> : icon}
          <Text style={[s.buttonText, { color: fg }]}>{label}</Text>
        </View>
      )}
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
        accessibilityLabel={label}
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
    <View style={s.chips} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
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

/** Segmented control (the period selector and similar). */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <View style={s.segmented} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(o.key)} style={[s.segment, on ? s.segmentOn : null]}>
            <Text style={{ fontSize: 13, fontWeight: '500', color: on ? C.ink : C.subtle }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Checks({ checks }: { checks: Check[] }) {
  if (!checks.length) {
    return (
      <View style={[s.notice, { backgroundColor: C.brandSoft }]}>
        <Text style={[s.noticeText, { color: C.brandDark }]}>✓  The totals and scheme lines agree with each other.</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {checks.map((c, i) => (
        <View key={i} style={[s.notice, { backgroundColor: c.level === 'warn' ? C.amberSoft : C.infoSoft }]}>
          <Text style={[s.noticeText, { color: c.level === 'warn' ? C.amber : C.info }]}>
            {c.level === 'warn' ? '⚠  ' : 'ⓘ  '}
            {c.message}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Sage call-out with a label and a big number. */
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
      <Text style={[s.rowLabel, bold ? { fontWeight: '600' } : null]}>{label}</Text>
      <Text style={[s.rowValue, tone ? { color: tone === 'good' ? C.brand : C.danger } : null, bold ? { fontWeight: '700' } : null]}>
        {value}
      </Text>
    </View>
  );
}

/** A table as rows of cells; first column left-aligned, the rest right-aligned. */
export function Table({ head, rows, label, flex }: { head: string[]; rows: (string | { text: string; tone?: 'good' | 'bad'; bold?: boolean; sub?: string })[][]; label: string; flex?: number[] }) {
  const f = (i: number) => flex?.[i] ?? (i === 0 ? 1.4 : 1);
  return (
    <View accessibilityLabel={label}>
      <View style={[s.tr, { paddingTop: 0 }]}>
        {head.map((h, i) => (
          <Text key={i} style={[s.th, { flex: f(i), textAlign: i ? 'right' : 'left' }]}>{h}</Text>
        ))}
      </View>
      {rows.map((r, j) => (
        <View key={j} style={[s.tr, j === rows.length - 1 ? { borderBottomWidth: 0 } : null]}>
          {r.map((c, i) => {
            const cell = typeof c === 'string' ? { text: c } : c;
            return (
              <View key={i} style={{ flex: f(i) }}>
                <Text style={[s.td, { textAlign: i ? 'right' : 'left' }, cell.bold ? { fontWeight: '600' } : null, cell.tone ? { color: cell.tone === 'good' ? C.brand : C.danger } : null]}>{cell.text}</Text>
                {cell.sub ? <Text style={{ fontSize: 11, color: C.subtle }}>{cell.sub}</Text> : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function Bullets({ items, muted, numbered }: { items: string[]; muted?: boolean; numbered?: boolean }) {
  return (
    <View style={{ gap: 8 }}>
      {items.map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={{ color: muted ? C.subtle : C.ink, fontSize: 14, lineHeight: 21 }}>{numbered ? `${i + 1}.` : '•'}</Text>
          <Text style={{ flex: 1, color: muted ? C.subtle : C.ink, fontSize: 14, lineHeight: 21 }}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={[s.card, { borderStyle: 'dashed', borderColor: '#CDD3CB', alignItems: 'center', paddingVertical: 24 }]}>
      <Inbox size={28} color={C.muted} />
      <Text style={{ fontSize: 16, fontWeight: '600', textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontSize: 14, color: C.subtle, textAlign: 'center', lineHeight: 20 }}>{body}</Text>
      {action ? <View style={{ alignSelf: 'stretch' }}><Button label={action.label} onPress={action.onPress} /></View> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={[s.card, { alignItems: 'center', paddingVertical: 24 }]} accessibilityRole="alert">
      <CircleAlert size={28} color={C.danger} />
      <Text style={{ fontSize: 17, fontWeight: '600' }}>Couldn't load payments data</Text>
      <Text style={{ fontSize: 14, color: C.subtle, textAlign: 'center' }}>{message}</Text>
      {onRetry ? <View style={{ alignSelf: 'stretch' }}><Button label="Try again" icon={<RefreshCw size={16} color="#FFFFFF" />} onPress={onRetry} /></View> : null}
    </View>
  );
}

export function LoadingState() {
  return (
    <View style={{ gap: 12 }} accessibilityRole="progressbar" accessibilityLabel="Loading payments data">
      {[220, 170, 150, 150].map((h, i) => (
        <View key={i} style={{ height: h, borderRadius: 16, backgroundColor: '#E9ECE7' }} />
      ))}
    </View>
  );
}

export const Note = ({ children }: { children: ReactNode }) => <Text style={s.note}>{children}</Text>;

export const s = StyleSheet.create({
  eyebrow: { fontSize: 12, fontWeight: '500', color: C.subtle, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 4 },
  pageTitle: { fontSize: 26, fontWeight: '600', letterSpacing: -0.4, lineHeight: 32 },
  pageSub: { fontSize: 15, color: C.subtle, marginTop: 2 },
  card: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 16, padding: 16, gap: 12, ...shadow },
  cardTitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  cardSub: { fontSize: 13, color: C.subtle, marginTop: 2, lineHeight: 18 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  button: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonText: { fontSize: 15, fontWeight: '500' },
  field: { flex: 1, minWidth: 140, gap: 4 },
  label: { fontSize: 13, color: C.subtle, fontWeight: '500' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.field, borderRadius: 10, paddingHorizontal: 12 },
  prefix: { color: C.muted, fontSize: 16, marginRight: 2 },
  input: { flex: 1, fontSize: 16, color: C.ink, paddingVertical: 12, minHeight: 46, fontFamily: F.regular },
  inputBox: { backgroundColor: C.field, borderRadius: 10, paddingHorizontal: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.card, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  chipOn: { backgroundColor: C.brandSoft, borderColor: C.brand },
  chipText: { color: C.subtle, fontWeight: '500', fontSize: 14 },
  chipTextOn: { color: C.brandDark },
  segmented: { flexDirection: 'row', backgroundColor: '#ECEEEA', borderRadius: 12, padding: 4, alignSelf: 'flex-start' },
  segment: { minHeight: 36, paddingHorizontal: 12, borderRadius: 9, justifyContent: 'center' },
  segmentOn: { backgroundColor: C.card, ...shadow },
  notice: { borderRadius: 12, padding: 12 },
  noticeText: { fontSize: 14, lineHeight: 20 },
  highlight: { backgroundColor: C.sage, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  highlightLabel: { color: C.brandDark, fontWeight: '600', fontSize: 15, flexShrink: 1 },
  highlightValue: { color: C.brandDark, fontWeight: '700', fontSize: 26, flexShrink: 0, maxWidth: '60%' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: 12 },
  rowLabel: { fontSize: 14, flexShrink: 1 },
  rowValue: { fontSize: 14, fontWeight: '600' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.line },
  th: { fontSize: 12, color: C.subtle, fontWeight: '500' },
  td: { fontSize: 13 },
  note: { color: C.subtle, fontSize: 12, lineHeight: 18 },
  h2: { fontSize: 15, fontWeight: '600' },
});
