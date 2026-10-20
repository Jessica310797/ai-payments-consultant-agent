import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useData } from '../../state/DataContext';
import { Badge } from '../ui/Badge';
import { Card, TextLink } from '../ui/Card';
import { FindingIcon, KindBadge } from './FindingIcon';

export function AuditCard() {
  const { derived } = useData();
  if (!derived) return null;
  const open = derived.findings.filter((f) => f.kind === 'confirmed' || f.kind === 'potential');
  return (
    <Card labelledBy="audit-title" className="flex h-full flex-col">
      <div className="mb-1 flex items-start justify-between gap-3">
        <h2 id="audit-title" className="text-[17px] font-semibold leading-6">Audit analysis</h2>
        {open.length ? <Badge tone="danger">{open.length} finding{open.length > 1 ? 's' : ''}</Badge> : <Badge tone="brand">No issues</Badge>}
      </div>
      <ul className="-mx-2 flex-1 divide-y divide-line">
        {derived.findings.map((f) => (
          <li key={f.id}>
            <Link to={`/audit/${f.id}`} className="flex items-start gap-3 rounded-xl px-2 py-3 hover:bg-[#FAFBF9]">
              <FindingIcon f={f} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[14px] font-semibold">{f.title}</span>
                  <KindBadge f={f} />
                </span>
                <span className="mt-0.5 block text-[13px] leading-5 text-subtle">{f.headline}</span>
              </span>
              <ChevronRight size={18} className="mt-2.5 shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <TextLink to="/audit" className="mt-2">View full audit</TextLink>
    </Card>
  );
}
