import { Search as SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useData } from '../state/DataContext';

interface Hit { to: string; title: string; kind: string; text: string }

export default function Search() {
  const { data, derived } = useData();
  const [q, setQ] = useState('');
  const index = useMemo<Hit[]>(() => {
    const out: Hit[] = [
      { to: '/costs', title: 'Payment costs', kind: 'Screen', text: 'costs effective rate volume transactions comparison variance mix pricing' },
      { to: '/drivers', title: 'Cost drivers', kind: 'Screen', text: 'acquiring interchange scheme processor other fees' },
      { to: '/transactions', title: 'Transactions', kind: 'Screen', text: 'card type provider volume average sale' },
      { to: '/audit/upload', title: 'Upload data', kind: 'Screen', text: 'csv invoice upload file' },
    ];
    for (const c of data?.changes ?? []) out.push({ to: `/october/${c.id}`, title: c.title, kind: 'October change', text: `${c.summary} ${c.affected}` });
    for (const f of derived?.findings ?? []) out.push({ to: `/audit/${f.id}`, title: f.title, kind: 'Audit finding', text: `${f.headline} ${f.evidence.join(' ')}` });
    for (const a of derived?.actions ?? []) out.push({ to: `/actions/${a.id}`, title: a.title, kind: 'Action', text: a.reason });
    for (const p of data?.providers ?? []) out.push({ to: '/costs', title: p.name, kind: 'Provider', text: p.role });
    return out;
  }, [data, derived]);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = terms.length ? index.filter((h) => terms.every((t) => `${h.title} ${h.kind} ${h.text}`.toLowerCase().includes(t))) : [];
  return (
    <>
      <ScreenHeader title="Search" />
      <label className="relative block">
        <span className="sr-only">Search payments, changes and findings</span>
        <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search fees, providers, changes…"
          className="block min-h-12 w-full rounded-xl border border-line bg-card pl-10 pr-3 text-[15px]" />
      </label>
      <div aria-live="polite" className="mt-4">
        {terms.length && !hits.length ? <p className="text-[14px] text-subtle">No results for "{q}".</p> : null}
        <ul className="space-y-2">
          {hits.map((h) => (
            <li key={h.to + h.title}>
              <Link to={h.to} className="block rounded-xl border border-line bg-card px-4 py-3 hover:border-[#CBD3C9]">
                <span className="block text-[12px] text-subtle">{h.kind}</span>
                <span className="block text-[15px] font-medium">{h.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
