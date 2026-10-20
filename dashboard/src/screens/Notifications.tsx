import { Bell, TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DataGate } from '../components/layout/DataGate';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { EmptyState } from '../components/ui/States';
import { noticePath, notificationsFor, useData } from '../state/DataContext';

export default function Notifications() {
  const { data, derived, dismissed, readNotifications } = useData();
  const items = data && derived ? notificationsFor(data, derived) : [];
  useEffect(() => {
    if (items.length) {
      const t = setTimeout(readNotifications, 1500);
      return () => clearTimeout(t);
    }
  }, [items.length, readNotifications]);
  return (
    <>
      <ScreenHeader title="Notifications" />
      <DataGate>
        {!items.length ? (
          <EmptyState title="You're all caught up" body="Alerts appear here when costs rise, the audit finds something or a change needs checking." />
        ) : (
          <ul className="space-y-2">
            {items.map((n) => (
              <li key={n.id}>
                <Link to={noticePath(n)} className="flex gap-3 rounded-xl border border-line bg-card p-4 hover:border-[#CBD3C9]">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${n.tone === 'warning' ? 'bg-danger-soft text-danger' : 'bg-info-soft text-info'}`}>
                    {n.tone === 'warning' ? <TriangleAlert size={17} aria-hidden /> : <Bell size={17} aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[14px] font-semibold">
                      {n.title}
                      {!dismissed.includes(n.id) ? <span className="h-2 w-2 rounded-full bg-brand" aria-label="Unread" /> : null}
                    </span>
                    <span className="block text-[13px] text-subtle">{n.body}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DataGate>
    </>
  );
}
