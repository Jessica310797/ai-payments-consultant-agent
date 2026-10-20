import type { Applicability, ChangeStatus } from '@shared/data/types';
import { Badge, type Tone } from '../ui/Badge';

export const STATUS: Record<ChangeStatus, { label: string; tone: Tone; help: string }> = {
  confirmed: { label: 'Confirmed', tone: 'brand', help: 'Confirmed from the source shown.' },
  observed: { label: 'Seen in your data', tone: 'info', help: 'Visible in this merchant\'s fees; the cause isn\'t confirmed yet.' },
  unverified: { label: 'To confirm', tone: 'amber', help: 'Not yet confirmed against the official source. Don\'t rely on it until it is.' },
};
export const APPLIES: Record<Applicability, { label: string; tone: Tone }> = {
  applies: { label: 'Applies', tone: 'danger' },
  likely: { label: 'Likely applies', tone: 'amber' },
  'not-assessed': { label: 'Not assessed', tone: 'neutral' },
  'does-not-apply': { label: 'Doesn\'t apply', tone: 'brand' },
};

export const StatusBadge = ({ s }: { s: ChangeStatus }) => <Badge tone={STATUS[s].tone}>{STATUS[s].label}</Badge>;
export const AppliesBadge = ({ a }: { a: Applicability }) => <Badge tone={APPLIES[a].tone}>{APPLIES[a].label}</Badge>;
