import type { ReactNode } from 'react';

export function Table({ caption, head, children, className = '' }: { caption: string; head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={`-mx-1 overflow-x-auto ${className}`}>
      <table className="w-full min-w-[17rem] border-collapse text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left text-[12px] text-subtle">
            {head.map((h, i) => <th key={i} scope="col" className={`px-1 pb-2 font-medium ${i ? 'text-right' : ''}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, first, strong, tone }: { children: ReactNode; first?: boolean; strong?: boolean; tone?: 'good' | 'bad' }) {
  const t = tone === 'good' ? 'text-brand' : tone === 'bad' ? 'text-danger' : '';
  return first
    ? <th scope="row" className={`px-1 py-2.5 text-left font-normal ${strong ? 'font-semibold' : ''}`}>{children}</th>
    : <td className={`px-1 py-2.5 text-right tabular-nums ${strong ? 'font-semibold' : ''} ${t}`}>{children}</td>;
}
