import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function Card({ children, className = '', as: Tag = 'section', labelledBy }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article'; labelledBy?: string }) {
  return (
    <Tag aria-labelledby={labelledBy} className={`rounded-2xl border border-line bg-card p-4 shadow-[0_1px_2px_rgba(32,44,41,0.04)] sm:p-5 ${className}`}>
      {children}
    </Tag>
  );
}

export function CardHeader({ id, title, subtitle, link, linkLabel, right }: { id?: string; title: string; subtitle?: string; link?: string; linkLabel?: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-[17px] font-semibold leading-6 tracking-[-0.01em]">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {right}
      {link ? <TextLink to={link}>{linkLabel ?? 'View details'}</TextLink> : null}
    </div>
  );
}

export function TextLink({ to, children, className = '' }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[13px] font-medium text-brand hover:text-brand-dark ${className}`}>
      {children}
      <ArrowRight size={14} aria-hidden />
    </Link>
  );
}
