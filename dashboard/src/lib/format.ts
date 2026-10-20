const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function money(v: number | null | undefined, opts: { exact?: boolean } = {}): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (opts.exact) return `${sign}$${a.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}m`;
  if (a >= 1e4) return `${sign}$${Math.round(a / 1e3)}k`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}k`;
  return `${sign}$${Math.round(a)}`;
}

export const count = (v: number | null | undefined) => (v == null ? '—' : Math.round(v).toLocaleString('en-AU'));
export const pct = (v: number | null | undefined, dp = 2) => (v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(dp)}%`);
export const pp = (v: number) => `${Math.abs(v).toFixed(2)} pp`;

export const monthShort = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1];
export const monthLong = (m: string) => `${LONG[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
export const monthMid = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

export function rangeLabel(months: string[]): string {
  if (!months.length) return '—';
  if (months.length === 1) return monthLong(months[0]);
  const a = months[0], b = months[months.length - 1];
  return a.slice(0, 4) === b.slice(0, 4) ? `${monthShort(a)}–${monthShort(b)} ${b.slice(0, 4)}` : `${monthMid(a)}–${monthMid(b)}`;
}

export function dateLong(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`;
}
