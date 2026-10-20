import { CircleCheck, Download, FileText, TriangleAlert } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { DataGate } from '../components/layout/DataGate';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { CsvError, importTransactions, TEMPLATE_CSV, type CsvImport } from '@shared/lib/csv';
import { count, money, monthMid, rangeLabel } from '@shared/lib/format';
import { sortedMonths } from '@shared/lib/periods';
import { useData } from '../state/DataContext';

const field = 'mt-1 block min-h-11 w-full rounded-xl border border-line bg-card px-3 text-[14px]';

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'paynavigate-transactions-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function TransactionsUpload() {
  const { uploaded, setUploadedData } = useData();
  const [preview, setPreview] = useState<{ fileName: string; result: CsvImport } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = useId();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      if (file.size > 25 * 1024 * 1024) throw new CsvError('The file is over 25 MB. Export a single month or quarter.');
      setPreview({ fileName: file.name, result: importTransactions(await file.text()) });
    } catch (e) {
      setError(e instanceof CsvError ? e.message : 'The file couldn\'t be read as CSV.');
    } finally {
      setBusy(false);
    }
  };

  const months = preview ? sortedMonths(preview.result.records.map((r) => r.month)) : [];
  const value = preview ? preview.result.records.reduce((a, r) => a + r.value, 0) : 0;

  return (
    <Card labelledBy="tx-up">
      <CardHeader id="tx-up" title="Transactions file" subtitle="CSV export from your provider, gateway or POS. Needs date, amount and card scheme; fee columns make the audit more accurate." />
      {uploaded ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-soft p-3 text-[13px]">
          <span className="inline-flex items-center gap-2"><CircleCheck size={16} className="text-brand" aria-hidden /> Dashboard is using <strong>{uploaded.fileName}</strong></span>
          <Button kind="ghost" className="!min-h-9" onClick={() => setUploadedData(null)}>Switch back to demo data</Button>
        </div>
      ) : null}
      <label htmlFor={inputId} className="block text-[13px] font-medium">Choose a CSV file</label>
      <input id={inputId} type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])}
        className="mt-1 block w-full text-[13px] file:mr-3 file:min-h-10 file:rounded-xl file:border-0 file:bg-sage file:px-4 file:font-medium file:text-brand-dark" />
      <button type="button" onClick={downloadTemplate} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand hover:text-brand-dark">
        <Download size={14} aria-hidden /> Download the column template
      </button>
      {busy ? <p role="status" className="mt-3 text-[13px] text-subtle">Reading the file…</p> : null}
      {error ? (
        <p role="alert" className="mt-3 flex gap-2 rounded-xl bg-danger-soft p-3 text-[13px] text-danger"><TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />{error}</p>
      ) : null}
      {preview ? (
        <div className="mt-4 rounded-xl border border-line p-3 text-[13px]">
          <p className="font-semibold">{preview.fileName}</p>
          <ul className="mt-2 space-y-1 text-subtle">
            <li>{count(preview.result.rowsUsed)} of {count(preview.result.rowsRead)} rows used · {money(value)} in sales · {rangeLabel(months)}</li>
            {preview.result.skipped.map((s) => <li key={s.reason}>Skipped {count(s.count)}: {s.reason.toLowerCase()}</li>)}
            <li>Columns matched: {Object.entries(preview.result.mapping).map(([k, v]) => `${k} → "${v}"`).join(', ')}</li>
          </ul>
          {!preview.result.hasFees ? <p className="mt-2 text-amber">No fee columns found: costs will show as $0 and the audit can't check fees.</p> : null}
          <p className="mt-2 text-subtle">Contracted rates aren't in a transactions file, so fee discrepancies and pricing changes can't be separated until a fee schedule is added.</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => { setUploadedData({ fileName: preview.fileName, records: preview.result.records }); setPreview(null); }}>Use in dashboard</Button>
            <Button kind="secondary" onClick={() => setPreview(null)}>Cancel</Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function InvoiceUpload() {
  const { data, addInvoice } = useData();
  const [file, setFile] = useState<File | null>(null);
  const [provider, setProvider] = useState('');
  const [month, setMonth] = useState('');
  const [total, setTotal] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const ids = { file: useId(), provider: useId(), month: useId(), total: useId() };
  if (!data) return null;
  const months = sortedMonths(data.ledger.map((r) => r.month)).reverse();
  const prov = provider || data.providers[0]?.id || '';
  const mon = month || months[0] || '';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!file) return setMsg('Choose an invoice file first.');
    const t = Number(total.replace(/[$,\s]/g, ''));
    const hasTotal = total.trim() !== '' && Number.isFinite(t) && t > 0;
    addInvoice({ id: `upload-${prov}-${mon}-${file.name}`, provider: prov, month: mon, total: hasTotal ? t : 0, fileName: file.name, status: hasTotal ? 'extracted' : 'awaiting-extraction' });
    setMsg(hasTotal ? `Added. ${file.name} is now part of the invoice reconciliation.` : `Added ${file.name}. Enter its total to reconcile it, or connect the invoice reader.`);
    setFile(null);
    setTotal('');
  };

  return (
    <Card labelledBy="inv-up">
      <CardHeader id="inv-up" title="Fee invoice" subtitle="A provider's monthly invoice or statement (PDF, image or CSV). Enter its total fees to reconcile it against transaction-level fees." />
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor={ids.file} className="block text-[13px] font-medium">Invoice file</label>
          <input id={ids.file} type="file" accept=".pdf,.csv,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-[13px] file:mr-3 file:min-h-10 file:rounded-xl file:border-0 file:bg-sage file:px-4 file:font-medium file:text-brand-dark" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor={ids.provider} className="block text-[13px] font-medium">Provider</label>
            <select id={ids.provider} className={field} value={prov} onChange={(e) => setProvider(e.target.value)}>
              {data.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={ids.month} className="block text-[13px] font-medium">Month</label>
            <select id={ids.month} className={field} value={mon} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => <option key={m} value={m}>{monthMid(m)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={ids.total} className="block text-[13px] font-medium">Total fees (optional)</label>
            <input id={ids.total} inputMode="decimal" placeholder="$0.00" className={field} value={total} onChange={(e) => setTotal(e.target.value)} />
          </div>
        </div>
        <Button type="submit">Add invoice</Button>
        {msg ? <p role="status" className="text-[13px] text-subtle">{msg}</p> : null}
      </form>
      {data.invoices.length ? (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {data.invoices.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-2.5 text-[13px]">
              <FileText size={16} className="shrink-0 text-subtle" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{i.fileName}<span className="block text-[12px] text-subtle">{data.providers.find((p) => p.id === i.provider)?.name ?? i.provider} · {monthMid(i.month)}{i.status === 'extracted' ? ` · ${money(i.total, { exact: true })}` : ''}</span></span>
              <Badge tone={i.status === 'extracted' ? 'brand' : 'amber'}>{i.status === 'extracted' ? 'Ready' : 'Awaiting total'}</Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

export default function AuditUpload() {
  return (
    <>
      <ScreenHeader title="Upload data" subtitle="Files stay in this browser. Nothing is sent to a server." />
      <DataGate>
        <div className="space-y-4">
          <TransactionsUpload />
          <InvoiceUpload />
        </div>
      </DataGate>
    </>
  );
}
