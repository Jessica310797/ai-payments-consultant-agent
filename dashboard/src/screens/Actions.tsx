import { useParams } from 'react-router-dom';
import { DataGate } from '../components/layout/DataGate';
import { ActionCard, STATUS_LABEL } from '../components/dashboard/NextActions';
import { Badge, cap, confidenceTone, priorityTone } from '../components/ui/Badge';
import { Card, CardHeader, TextLink } from '../components/ui/Card';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { EmptyState } from '../components/ui/States';
import type { ActionStatus } from '@shared/lib/actions';
import { useData } from '../state/DataContext';

export function ActionsList() {
  const { derived } = useData();
  return (
    <>
      <ScreenHeader title="Recommended actions" subtitle="Ranked by priority, then potential impact" />
      <DataGate>
        {!derived?.actions.length ? (
          <EmptyState title="Nothing to do right now" body="Actions appear when costs move, changes need checking or the audit finds something." />
        ) : (
          <ol className="space-y-3">{derived.actions.map((a, i) => <li key={a.id}><ActionCard a={a} rank={i + 1} /></li>)}</ol>
        )}
      </DataGate>
    </>
  );
}

export function ActionDetail() {
  const { id } = useParams();
  const { derived, actionStatus, setActionStatus } = useData();
  const idx = derived?.actions.findIndex((a) => a.id === id) ?? -1;
  const a = idx >= 0 ? derived!.actions[idx] : null;
  const status = a ? actionStatus[a.id] ?? 'open' : 'open';
  return (
    <>
      <ScreenHeader title={a?.title ?? 'Action'} subtitle={a ? `Rank ${idx + 1} of ${derived!.actions.length}` : undefined} />
      <DataGate>
        {!a ? (
          <EmptyState title="Action not found" body="It may no longer apply to the selected period." action={{ to: '/actions', label: 'All actions' }} />
        ) : (
          <div className="space-y-4">
            <Card>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={priorityTone(a.priority)}>{cap(a.priority)} priority</Badge>
                <Badge tone={confidenceTone(a.confidence)}>{cap(a.confidence)} confidence</Badge>
              </div>
              <dl className="mt-4 space-y-3 text-[14px]">
                <div><dt className="text-[12px] text-subtle">Why</dt><dd className="leading-6">{a.reason}</dd></div>
                <div><dt className="text-[12px] text-subtle">Estimated impact</dt><dd className="leading-6">{a.impact ?? 'Not estimated: the data doesn\'t support a dollar figure yet.'}</dd></div>
              </dl>
              <TextLink to={a.link} className="mt-4">Open {a.linkLabel.toLowerCase()}</TextLink>
            </Card>
            <Card labelledBy="st">
              <CardHeader id="st" title="Status" />
              <div role="radiogroup" aria-labelledby="st" className="grid grid-cols-3 gap-2">
                {(Object.keys(STATUS_LABEL) as ActionStatus[]).map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={status === s} onClick={() => setActionStatus(a.id, s)}
                    className={`min-h-11 rounded-xl border text-[13px] font-medium ${status === s ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line bg-card text-subtle hover:text-ink'}`}>
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-subtle">Saved in this browser.</p>
            </Card>
          </div>
        )}
      </DataGate>
    </>
  );
}
