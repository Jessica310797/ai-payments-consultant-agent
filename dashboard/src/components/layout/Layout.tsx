import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';

export function Layout() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return (
    <div className="min-h-dvh bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-30 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      {/* Bottom padding keeps the last card clear of the fixed navigation */}
      <main id="main" className="mx-auto max-w-3xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-5">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
