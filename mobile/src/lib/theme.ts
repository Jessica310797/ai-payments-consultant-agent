// Same palette as the Streamlit dashboard.
export const C = {
  teal: '#1D4B45',
  tealSoft: '#D5E3E0',
  cream: '#FBF4E6',
  card: '#FFFDF8',
  ink: '#1D2B29',
  muted: '#6B6A63',
  line: '#E6DCCB',
  orange: '#E07B0E',
  orangeSoft: '#FBE3C6',
  magenta: '#C8338F',
  blue: '#3F87D4',
  aqua: '#1BAF7A',
  violet: '#4A3AA7',
  good: '#1D6B3A',
  bad: '#A4502F',
  warnBg: '#FDF0DC',
  infoBg: '#E7EFF6',
};

export const SCHEME_COLOURS: Record<string, string> = {
  Eftpos: C.orange,
  Visa: C.blue,
  Mastercard: C.magenta,
  Amex: C.aqua,
  Other: C.muted,
};

export const REFORM_DATE = new Date(2026, 9, 1);

export function reformPill(today = new Date()): string {
  const days = Math.ceil((REFORM_DATE.getTime() - new Date(today.toDateString()).getTime()) / 86400000);
  if (days > 1) return `RBA reform in ${days} days`;
  if (days === 1) return 'RBA reform starts tomorrow';
  return 'RBA reform in effect since 1 Oct 2026';
}
