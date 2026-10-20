import { ChartColumn } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-dark text-white" aria-hidden>
        <ChartColumn size={22} strokeWidth={2.5} />
      </span>
      <span className="leading-tight">
        <span className="block text-[19px] font-semibold tracking-[-0.01em]">PayNavigate</span>
        <span className="block text-[13px] text-subtle">Payments Intelligence</span>
      </span>
    </div>
  );
}
