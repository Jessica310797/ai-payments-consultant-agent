import { CsvError, importTransactions, type CsvImport } from '@shared/lib/csv';
import { count, money, monthMid, rangeLabel } from '@shared/lib/format';
import { sortedMonths } from '@shared/lib/periods';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { Camera, CircleCheck, FileText, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { DataGate } from '../components/data-ui';
import { Badge, Button, Card, CardHeader, Chips, NumField, Screen, Text, TextLink } from '../components/ui';
import { useData } from '../lib/data';
import { useVisit } from '../lib/store';
import { C } from '../lib/theme';

async function readText(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web' && asset.file) return asset.file.text();
  return new File(asset.uri).text();
}

function StatementSection() {
  const { reset } = useVisit();
  return (
    <Card>
      <CardHeader title="Card statement or invoice" subtitle="Photograph each page of your latest statement, or choose the PDF your provider emailed you. Claude reads the fees, you check the figures, then see the 1 October impact and add it to your dashboard." />
      <Button
        label="Photograph a statement"
        icon={<Camera size={18} color="#FFFFFF" />}
        onPress={() => {
          reset();
          router.push('/capture');
        }}
      />
      <TextLink to="/statements" label="Statements checked on this phone" />
    </Card>
  );
}

function TransactionsSection() {
  const { uploaded, setUploadedData } = useData();
  const [preview, setPreview] = useState<{ fileName: string; result: CsvImport } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    setError(null);
    setPreview(null);
    const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel'], copyToCacheDirectory: true });
    if (res.canceled) return;
    const asset = res.assets[0];
    setBusy(true);
    try {
      if ((asset.size ?? 0) > 25 * 1024 * 1024) throw new CsvError('The file is over 25 MB. Export a single month or quarter.');
      setPreview({ fileName: asset.name, result: importTransactions(await readText(asset)) });
    } catch (e) {
      setError(e instanceof CsvError ? e.message : 'The file couldn\'t be read as CSV.');
    } finally {
      setBusy(false);
    }
  };

  const months = preview ? sortedMonths(preview.result.records.map((r) => r.month)) : [];
  const value = preview ? preview.result.records.reduce((a, r) => a + r.value, 0) : 0;
  return (
    <Card>
      <CardHeader title="Transactions file" subtitle="CSV export from your provider, gateway or POS. Needs date, amount and card scheme; fee columns make the audit more accurate." />
      {uploaded ? (
        <View style={{ backgroundColor: C.brandSoft, borderRadius: 12, padding: 12, gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <CircleCheck size={16} color={C.brand} />
            <Text style={{ flex: 1, fontSize: 13 }}>Dashboard is using <Text style={{ fontSize: 13, fontWeight: '600' }}>{uploaded.source}</Text></Text>
          </View>
          <Button kind="ghost" label="Remove this data" onPress={() => setUploadedData(null)} />
        </View>
      ) : null}
      <Button kind="secondary" label="Choose a CSV file" icon={<FileText size={16} color={C.ink} />} onPress={choose} busy={busy} />
      {error ? (
        <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 8, backgroundColor: C.dangerSoft, borderRadius: 12, padding: 12 }}>
          <TriangleAlert size={16} color={C.danger} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, fontSize: 13, color: C.danger, lineHeight: 19 }}>{error}</Text>
        </View>
      ) : null}
      {preview ? (
        <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, gap: 6 }}>
          <Text style={{ fontWeight: '600' }}>{preview.fileName}</Text>
          <Text style={{ fontSize: 13, color: C.subtle }}>{count(preview.result.rowsUsed)} of {count(preview.result.rowsRead)} rows used · {money(value)} in sales · {rangeLabel(months)}</Text>
          {preview.result.skipped.map((s) => <Text key={s.reason} style={{ fontSize: 13, color: C.subtle }}>Skipped {count(s.count)}: {s.reason.toLowerCase()}</Text>)}
          <Text style={{ fontSize: 13, color: C.subtle }}>Columns matched: {Object.entries(preview.result.mapping).map(([k, v]) => `${k} → "${v}"`).join(', ')}</Text>
          {!preview.result.hasFees ? <Text style={{ fontSize: 13, color: C.amber }}>No fee columns found: costs will show as $0 and the audit can't check fees.</Text> : null}
          <Button label="Use in dashboard" onPress={() => { setUploadedData({ source: `Uploaded file: ${preview.fileName}`, records: preview.result.records }); setPreview(null); router.navigate('/'); }} />
          <Button kind="ghost" label="Cancel" onPress={() => setPreview(null)} />
        </View>
      ) : null}
      <Text style={{ fontSize: 12, color: C.subtle }}>Expected headers like: date, amount, scheme, card_type, provider, status, interchange, scheme_fee, acquiring, processing. Files are read on this phone.</Text>
    </Card>
  );
}

function InvoiceSection() {
  const { data, addInvoice } = useData();
  const [file, setFile] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (!data) return null;
  const months = sortedMonths(data.ledger.map((r) => r.month)).reverse().slice(0, 6);
  const prov = provider ?? data.providers[0]?.id ?? null;
  const mon = month ?? months[0] ?? null;

  const choose = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*', 'text/csv'], copyToCacheDirectory: true });
    if (!res.canceled) setFile(res.assets[0].name);
  };
  const add = () => {
    if (!file || !prov || !mon) return setMsg('Choose an invoice file first.');
    const ready = total != null && total > 0;
    addInvoice({ id: `upload-${prov}-${mon}-${file}`, provider: prov, month: mon, total: ready ? total : 0, fileName: file, status: ready ? 'extracted' : 'awaiting-extraction' });
    setMsg(ready ? `Added. ${file} is now part of the invoice reconciliation.` : `Added ${file}. Enter its total to reconcile it.`);
    setFile(null);
    setTotal(null);
  };

  return (
    <Card>
      <CardHeader title="Fee invoice" subtitle="Add a provider's invoice and its total fees to reconcile it against transaction-level fees." />
      <Button kind="secondary" label={file ?? 'Choose an invoice file'} icon={<FileText size={16} color={C.ink} />} onPress={choose} />
      {data.providers.length ? (
        <>
          <Text style={{ fontSize: 13, color: C.subtle, fontWeight: '500' }}>Provider</Text>
          <Chips options={data.providers.map((p) => p.id)} labels={Object.fromEntries(data.providers.map((p) => [p.id, p.name]))} value={prov} onChange={setProvider} />
        </>
      ) : null}
      {months.length ? (
        <>
          <Text style={{ fontSize: 13, color: C.subtle, fontWeight: '500' }}>Month</Text>
          <Chips options={months} labels={Object.fromEntries(months.map((m) => [m, monthMid(m)]))} value={mon} onChange={setMonth} />
        </>
      ) : null}
      <NumField label="Total fees (optional)" prefix="$" value={total} onChange={setTotal} />
      <Button label="Add invoice" onPress={add} />
      {msg ? <Text style={{ fontSize: 13, color: C.subtle }} accessibilityLiveRegion="polite">{msg}</Text> : null}
      {data.invoices.map((i) => (
        <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderColor: C.line, paddingTop: 10 }}>
          <FileText size={16} color={C.subtle} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13 }} numberOfLines={1}>{i.fileName}</Text>
            <Text style={{ fontSize: 12, color: C.subtle }}>{data.providers.find((p) => p.id === i.provider)?.name ?? i.provider} · {monthMid(i.month)}{i.status === 'extracted' ? ` · ${money(i.total, { exact: true })}` : ''}</Text>
          </View>
          <Badge tone={i.status === 'extracted' ? 'brand' : 'amber'} label={i.status === 'extracted' ? 'Ready' : 'Awaiting total'} />
        </View>
      ))}
    </Card>
  );
}

export default function Upload() {
  return (
    <Screen>
      <StatementSection />
      <DataGate>
        <View style={{ gap: 16 }}>
          <TransactionsSection />
          <InvoiceSection />
        </View>
      </DataGate>
    </Screen>
  );
}
