import { CalendarDays, CreditCard, House, Menu, ScanSearch } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Home', Icon: House, end: true },
  { to: '/transactions', label: 'Transactions', Icon: CreditCard },
  { to: '/audit', label: 'Audit', Icon: ScanSearch },
  { to: '/october', label: 'October', Icon: CalendarDays },
  { to: '/more', label: 'More', Icon: Menu },
];

export function BottomNav() {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {TABS.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => `flex min-h-16 flex-col items-center justify-center gap-1 text-[12px] font-medium ${isActive ? 'text-brand-dark' : 'text-subtle hover:text-ink'}`}
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} fill={isActive && label === 'Home' ? 'currentColor' : 'none'} aria-hidden />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
