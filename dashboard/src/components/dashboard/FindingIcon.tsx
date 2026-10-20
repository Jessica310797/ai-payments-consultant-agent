import { CircleCheck, CircleHelp, Route, TriangleAlert } from 'lucide-react';
import type { Finding } from '@shared/lib/audit';
import { Badge, type Tone } from '../ui/Badge';

export const KIND: Record<Finding['kind'], { label: string; tone: Tone }> = {
  confirmed: { label: 'Confirmed', tone: 'danger' },
  potential: { label: 'Opportunity', tone: 'amber' },
  clear: { label: 'No issue', tone: 'brand' },
  'needs-data': { label: 'Needs data', tone: 'neutral' },
};

export function FindingIcon({ f }: { f: Finding }) {
  const cls = 'grid h-10 w-10 shrink-0 place-items-center rounded-full';
  if (f.kind === 'confirmed') return <span className={`${cls} bg-danger-soft text-danger`}><TriangleAlert size={19} aria-hidden /></span>;
  if (f.kind === 'potential') return <span className={`${cls} bg-amber-soft text-amber`}>{f.id === 'routing' ? <Route size={19} aria-hidden /> : <CircleHelp size={19} aria-hidden />}</span>;
  if (f.kind === 'clear') return <span className={`${cls} bg-brand-soft text-brand`}><CircleCheck size={19} aria-hidden /></span>;
  return <span className={`${cls} bg-[#EEF0EC] text-subtle`}><CircleHelp size={19} aria-hidden /></span>;
}

export const KindBadge = ({ f }: { f: Finding }) => <Badge tone={KIND[f.kind].tone}>{KIND[f.kind].label}</Badge>;
