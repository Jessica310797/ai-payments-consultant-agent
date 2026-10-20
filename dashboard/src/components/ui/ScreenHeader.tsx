import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export function ScreenHeader({ title, subtitle, right, back = true }: { title: string; subtitle?: string; right?: ReactNode; back?: boolean }) {
  const nav = useNavigate();
  return (
    <header className="mb-4">
      {back ? (
        <button type="button" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))} className="-ml-2 mb-1 inline-flex min-h-10 items-center gap-0.5 rounded-lg px-2 text-[14px] font-medium text-brand hover:bg-brand-soft">
          <ChevronLeft size={18} aria-hidden /> Back
        </button>
      ) : null}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em]">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-[14px] text-subtle">{subtitle}</p> : null}
        </div>
        {right}
      </div>
    </header>
  );
}
