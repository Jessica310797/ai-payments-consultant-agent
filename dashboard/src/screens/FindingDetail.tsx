import { useParams } from 'react-router-dom';
import { DataGate } from '../components/layout/DataGate';
import { FindingIcon, KIND, KindBadge } from '../components/dashboard/FindingIcon';
import { Badge, cap, confidenceTone } from '../components/ui/Badge';
import { Card, CardHeader, TextLink } from '../components/ui/Card';
import { Provenance } from '../components/ui/Provenance';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { EmptyState } from '../components/ui/States';
import { money } from '../lib/format';
import { useData } from '../state/DataContext';

const KIND_HELP = {
  confirmed: 'Confirmed: the data shows a charge that differs from the contract or invoice.',
  potential: 'Opportunity: an estimate that depends on the assumptions below. Not money owed.',
  clear: 'No issue found for this period.',
  'needs-data': 'This check needs more data before it can run.',
};

export default function FindingDetail() {
  const { id } = useParams();
  const { derived } = useData();
  const f = derived?.findings.find((x) => x.id === id);
  return (
    <>
      <ScreenHeader title={f?.title ?? 'Finding'} subtitle={derived?.period.label} />
      <DataGate>
        {!f ? (
          <EmptyState title="Finding not found" body="It may not apply to the selected period." action={{ to: '/audit', label: 'Back to audit' }} />
        ) : (
          <div className="space-y-4">
            <Card>
              <div className="flex gap-3">
                <FindingIcon f={f} />
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-1.5"><KindBadge f={f} /><Badge tone={confidenceTone(f.confidence)}>{cap(f.confidence)} confidence</Badge></div>
                  <p className="mt-2 text-[17px] font-semibold leading-6">{f.headline}</p>
                  {f.variance != null ? (
                    <p className="mt-1 text-[14px] text-subtle">
                      Variance: <span className={`font-semibold ${KIND[f.kind].tone === 'danger' ? 'text-danger' : 'text-ink'}`}>{money(f.variance, { exact: true })}</span> {f.varianceBasis === 'a year' ? 'a year (estimate)' : `in ${f.varianceBasis}`}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[13px] text-subtle">{KIND_HELP[f.kind]}</p>
                </div>
              </div>
            </Card>
            {f.evidence.length ? (
              <Card labelledBy="ev">
                <CardHeader id="ev" title="Evidence" />
                <ul className="list-disc space-y-2 pl-5 text-[14px] leading-6">{f.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
              </Card>
            ) : null}
            {f.assumptions.length ? (
              <Card labelledBy="as">
                <CardHeader id="as" title="Assumptions" />
                <ul className="list-disc space-y-2 pl-5 text-[14px] leading-6 text-subtle">{f.assumptions.map((e) => <li key={e}>{e}</li>)}</ul>
              </Card>
            ) : null}
            <Card labelledBy="next" className="!bg-sage !border-transparent">
              <CardHeader id="next" title="Next action" />
              <p className="text-[14px] leading-6">{f.nextAction}</p>
              {f.kind === 'needs-data' ? <TextLink to="/audit/upload" className="mt-3">Upload data</TextLink> : null}
            </Card>
            <Provenance />
          </div>
        )}
      </DataGate>
    </>
  );
}
