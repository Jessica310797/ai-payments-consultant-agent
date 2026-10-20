import { CircleAlert, Inbox, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './Button';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-[#E9ECE7] ${className}`} />;
}

export function LoadingScreen({ label = 'Loading payments data' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}…</span>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="mt-4 h-56 w-full rounded-2xl" />
      <Skeleton className="h-44 w-full rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-line bg-card p-6 text-center">
      <CircleAlert className="mx-auto text-danger" size={28} aria-hidden />
      <h2 className="mt-3 text-[17px] font-semibold">Couldn't load payments data</h2>
      <p className="mt-1 text-[14px] text-muted">{message}</p>
      {onRetry ? (
        <Button className="mt-4" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden /> Try again
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: { to: string; label: string } | ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#CDD3CB] bg-card p-6 text-center">
      <Inbox className="mx-auto text-muted" size={28} aria-hidden />
      <h2 className="mt-3 text-[16px] font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-[14px] text-muted">{body}</p>
      {action && typeof action === 'object' && 'to' in action ? (
        <Link to={action.to} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-[14px] font-medium text-white hover:bg-brand-dark">
          {action.label}
        </Link>
      ) : (
        action
      )}
    </div>
  );
}
