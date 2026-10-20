import { Bell, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { notificationsFor, useData } from '../../state/DataContext';
import { Logo } from './Logo';

export function AppHeader() {
  const { data, derived, dismissed } = useData();
  const unread = data && derived ? notificationsFor(data, derived).filter((n) => !dismissed.includes(n.id)).length : 0;
  const icon = 'relative grid h-11 w-11 place-items-center rounded-xl text-ink hover:bg-[#E9ECE7]';
  return (
    <div className="flex items-center justify-between">
      <Link to="/" aria-label="PayNavigate home" className="rounded-xl">
        <Logo />
      </Link>
      <nav aria-label="Tools" className="flex items-center gap-1">
        <Link to="/search" className={icon} aria-label="Search">
          <Search size={22} aria-hidden />
        </Link>
        <Link to="/notifications" className={icon} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
          <Bell size={22} aria-hidden />
          {unread ? <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-brand" aria-hidden /> : null}
        </Link>
      </nav>
    </div>
  );
}
