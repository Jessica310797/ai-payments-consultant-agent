import { ExternalLink } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { DataGate } from '../components/layout/DataGate';
import { AppliesBadge, STATUS, StatusBadge } from '../components/dashboard/ChangeBadges';
import { Card, CardHeader, TextLink } from '../components/ui/Card';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { EmptyState } from '../components/ui/States';
import { dateLong, money } from '@shared/lib/format';
import { useData } from '../state/DataContext';

export default function ChangeDetail() {
  const { id } = useParams();
  const { data, derived } = useData();
  const c = data?.changes.find((x) => x.id === id);
  const surchargeBase = c?.id === 'surcharging' && data && derived
    ? data.ledger.filter((r) => derived.period.current.includes(r.month) && r.segment !== 'amex_credit').reduce((a, r) => a + r.value, 0) / Math.max(derived.now.months, 1)
    : null;
  return (
    <>
      <ScreenHeader title={c?.title ?? 'Change'} />
      <DataGate>
        {!c || !data ? (
          <EmptyState title="Change not found" body="It may have been removed from the log." action={{ to: '/october', label: 'Back to October changes' }} />
        ) : (
          <div className="space-y-4">
            <Card>
              <div className="flex flex-wrap gap-1.5"><StatusBadge s={c.status} /><AppliesBadge a={c.applicability} /></div>
              <p className="mt-3 text-[15px] leading-6">{c.summary}</p>
              <p className="mt-2 text-[13px] text-subtle">{STATUS[c.status].help}</p>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-line pt-4 text-[13px]">
                <dt className="text-subtle">Effective date</dt>
                <dd>{c.effectiveDate ? dateLong(c.effectiveDate) : 'Not set'}{c.effectiveDateVerified ? '' : ' (to confirm)'}</dd>
                <dt className="text-subtle">Affects</dt><dd>{c.affected}</dd>
                <dt className="text-subtle">Source</dt>
                <dd>
                  {c.source.url ? (
                    <a href={c.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand hover:text-brand-dark">
                      {c.source.label} <ExternalLink size={13} aria-hidden /><span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : c.source.label}
                </dd>
                <dt className="text-subtle">Last checked</dt><dd>{dateLong(c.lastChecked)}</dd>
              </dl>
            </Card>
            <Card labelledBy="appl">
              <CardHeader id="appl" title="Does it apply to this merchant?" right={<AppliesBadge a={c.applicability} />} />
              <p className="text-[14px] leading-6">{c.applicabilityReason}</p>
              {surchargeBase && data.merchant.surchargesToday ? (
                <p className="mt-2 text-[13px] text-subtle">
                  Surcharges today at {data.merchant.surchargeRatePct}% on about {money(surchargeBase)} a month of eftpos, Visa and Mastercard sales
                  (≈ {money((surchargeBase * data.merchant.surchargeRatePct) / 100)} a month in surcharge income).
                </p>
              ) : null}
            </Card>
            <Card labelledBy="steps" className="!border-transparent !bg-sage">
              <CardHeader id="steps" title="Recommended next steps" />
              <ol className="list-decimal space-y-2 pl-5 text-[14px] leading-6">{c.nextSteps.map((s) => <li key={s}>{s}</li>)}</ol>
              {c.category !== 'regulation' ? <TextLink to="/costs" className="mt-3">See the cost impact</TextLink> : null}
            </Card>
          </div>
        )}
      </DataGate>
    </>
  );
}
