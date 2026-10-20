import type { Fees, LedgerRecord, SegmentId } from '../data/types';

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const FIELDS: Record<string, string[]> = {
  date: ['date', 'transactiondate', 'txndate', 'settlementdate', 'datetime'],
  amount: ['amount', 'value', 'saleamount', 'transactionamount', 'gross'],
  scheme: ['scheme', 'cardscheme', 'network', 'cardbrand', 'brand', 'paymentmethod', 'cardtype'],
  cardType: ['debitcredit', 'fundingsource', 'funding', 'cardproduct', 'accounttype', 'drcr'],
  provider: ['provider', 'acquirer', 'processor', 'merchantfacility'],
  status: ['status', 'result', 'outcome'],
  interchange: ['interchange', 'interchangefee'],
  scheme_fee: ['schemefee', 'schemefees', 'networkfee'],
  acquiring: ['acquiring', 'acquiringfee', 'msf', 'merchantfee', 'merchantservicefee', 'margin'],
  processor: ['processing', 'processingfee', 'processorfee', 'transactionfee'],
  other: ['otherfee', 'otherfees', 'terminalrental', 'gatewayfee'],
  total_fee: ['totalfee', 'totalfees', 'fee', 'fees'],
};

export interface CsvImport {
  records: LedgerRecord[];
  rowsRead: number;
  rowsUsed: number;
  skipped: { reason: string; count: number }[];
  mapping: Record<string, string>;
  hasFees: boolean;
}

export class CsvError extends Error {}

function toAmount(s: string): number | null {
  const t = s.replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Australian day-first dates (31/10/2026), or ISO (2026-10-31). Returns YYYY-MM. */
function toMonth(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const mo = Number(m[2]);
    return mo >= 1 && mo <= 12 ? `${y}-${String(mo).padStart(2, '0')}` : null;
  }
  return null;
}

function toSegment(scheme: string, cardType: string): SegmentId {
  const s = ` ${scheme.toLowerCase()} `, c = cardType.toLowerCase();
  const credit = /credit|\bcr\b|\bc\b/.test(c) || /credit/.test(s);
  if (/eftpos|\bep\b|\bchq\b|\bsav\b/.test(s)) return 'eftpos_debit';
  if (/amex|american express|\bax\b/.test(s)) return 'amex_credit';
  if (/visa|\bvi\b/.test(s)) return credit ? 'visa_credit' : 'visa_debit';
  if (/master|\bmc\b|m\/c/.test(s)) return credit ? 'mc_credit' : 'mc_debit';
  return 'other';
}

export function importTransactions(text: string): CsvImport {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new CsvError('The file has no data rows.');
  const header = rows[0].map(norm);
  const mapping: Record<string, string> = {};
  const idx: Record<string, number> = {};
  for (const [field, names] of Object.entries(FIELDS)) {
    const i = header.findIndex((h, j) => names.includes(h) && !Object.values(idx).includes(j));
    if (i >= 0) { idx[field] = i; mapping[field] = rows[0][i]; }
  }
  const missing = ['date', 'amount', 'scheme'].filter((f) => idx[f] == null);
  if (missing.length) throw new CsvError(`Couldn't find a ${missing.join(', ')} column. Expected headers like: date, amount, scheme, card_type, interchange, scheme_fee, acquiring, processing.`);

  const feeCols = ['interchange', 'scheme_fee', 'acquiring', 'processor', 'other'].filter((f) => idx[f] != null);
  const useTotal = !feeCols.length && idx.total_fee != null;
  const groups = new Map<string, LedgerRecord>();
  const skip: Record<string, number> = {};
  let used = 0;
  for (const r of rows.slice(1)) {
    const get = (f: string) => (idx[f] != null ? (r[idx[f]] ?? '').trim() : '');
    const status = get('status').toLowerCase();
    if (status && !/approv|success|settled|complete|captur|paid/.test(status)) { skip['Not approved'] = (skip['Not approved'] ?? 0) + 1; continue; }
    const month = toMonth(get('date')), amount = toAmount(get('amount'));
    if (!month) { skip['Unreadable date'] = (skip['Unreadable date'] ?? 0) + 1; continue; }
    if (amount == null || amount <= 0) { skip['Refund, zero or unreadable amount'] = (skip['Refund, zero or unreadable amount'] ?? 0) + 1; continue; }
    const segment = toSegment(get('scheme'), get('cardType'));
    const provider = get('provider') || 'Uploaded';
    const key = `${month}|${provider}|${segment}`;
    const g = groups.get(key) ?? { month, provider, segment, transactions: 0, value: 0, fees: { acquiring: 0, interchange: 0, scheme: 0, processor: 0, other: 0 } };
    const fee = (f: string) => Math.abs(toAmount(get(f)) ?? 0);
    const add: Fees = useTotal
      ? { acquiring: fee('total_fee'), interchange: 0, scheme: 0, processor: 0, other: 0 }
      : { acquiring: fee('acquiring'), interchange: fee('interchange'), scheme: fee('scheme_fee'), processor: fee('processor'), other: fee('other') };
    g.transactions += 1;
    g.value += amount;
    for (const k of Object.keys(add) as (keyof Fees)[]) g.fees[k] += add[k];
    groups.set(key, g);
    used++;
  }
  if (!used) throw new CsvError('No approved sales could be read from the file.');
  return {
    records: Array.from(groups.values()),
    rowsRead: rows.length - 1,
    rowsUsed: used,
    skipped: Object.entries(skip).map(([reason, count]) => ({ reason, count })),
    mapping,
    hasFees: feeCols.length > 0 || useTotal,
  };
}

export const TEMPLATE_CSV = 'date,amount,scheme,card_type,provider,status,interchange,scheme_fee,acquiring,processing\n'
  + '01/10/2026,54.20,Visa,debit,Provider A,approved,0.12,0.10,0.31,0.12\n'
  + '01/10/2026,212.00,Mastercard,credit,Provider A,approved,1.31,0.72,1.23,0.12\n';
