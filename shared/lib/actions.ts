import type { Dataset } from '../data/types';
import type { Finding } from './audit';
import { money, pct } from './format';
import type { Summary, Variance } from './metrics';

export type Priority = 'high' | 'medium' | 'low';
export type ActionStatus = 'open' | 'in-progress' | 'done';

export interface NextAction {
  id: 'rising-costs' | 'october-changes' | 'payment-audit';
  title: string;
  priority: Priority;
  reason: string;
  impact: string | null; // null when it can't be supported by the data
  confidence: 'high' | 'medium' | 'low';
  link: string;
  linkLabel: string;
}

const RANK: Record<Priority, number> = { high: 3, medium: 2, low: 1 };

export function recommendActions(d: Dataset, now: Summary, before: Summary | null, variance: Variance | null, findings: Finding[], periodLabel: string): NextAction[] {
  const out: NextAction[] = [];

  if (before && before.cost) {
    const up = ((now.cost - before.cost) / before.cost) * 100;
    const ppUp = now.rate != null && before.rate != null ? now.rate - before.rate : null;
    out.push({
      id: 'rising-costs',
      title: up > 0 ? 'Investigate rising costs' : 'Review cost movement',
      priority: up >= 10 ? 'high' : up > 0 ? 'medium' : 'low',
      reason: `Costs ${up >= 0 ? 'up' : 'down'} ${pct(Math.abs(up), 1)} vs the previous period${ppUp != null ? `; effective rate ${ppUp >= 0 ? '+' : '−'}${Math.abs(ppUp).toFixed(2)} pp` : ''}.`,
      impact: variance?.unexplained != null && variance.unexplained > 0
        ? `${money(variance.unexplained)} of the change isn't explained by volume, card mix or contracted pricing`
        : null,
      confidence: variance?.unexplained != null ? 'medium' : 'low',
      link: '/costs',
      linkLabel: 'Cost breakdown',
    });
  }

  const toCheck = d.changes.filter((c) => c.status === 'unverified' || c.applicability === 'likely' || c.applicability === 'applies');
  if (toCheck.length) {
    out.push({
      id: 'october-changes',
      title: 'Review October changes',
      priority: toCheck.some((c) => c.status === 'unverified' && c.applicability === 'likely') ? 'medium' : 'low',
      reason: `${toCheck.length} change${toCheck.length > 1 ? 's' : ''} may affect this merchant; ${d.changes.filter((c) => c.status === 'unverified').length} still need confirming against the source.`,
      impact: null,
      confidence: 'low',
      link: '/october',
      linkLabel: 'October changes',
    });
  }

  const confirmed = findings.filter((f) => f.kind === 'confirmed').reduce((a, f) => a + Math.max(f.variance ?? 0, 0), 0);
  const potential = findings.filter((f) => f.kind === 'potential').reduce((a, f) => a + (f.variance ?? 0), 0);
  out.push({
    id: 'payment-audit',
    title: 'Run a payment audit',
    priority: confirmed >= 20000 ? 'high' : confirmed > 0 || potential > 0 ? 'medium' : 'low',
    reason: confirmed > 0
      ? `${money(confirmed)} charged above contract or invoiced without support in ${periodLabel}.`
      : 'Check invoices and contracts for discrepancies and gaps.',
    impact: confirmed > 0 ? `${money(confirmed)} recoverable${potential > 0 ? `, plus up to ${money(potential)} a year in opportunities` : ''}` : potential > 0 ? `Up to ${money(potential)} a year in opportunities` : null,
    confidence: confirmed > 0 ? 'high' : 'low',
    link: '/audit',
    linkLabel: 'Audit analysis',
  });

  return out.sort((a, b) => RANK[b.priority] - RANK[a.priority]);
}
