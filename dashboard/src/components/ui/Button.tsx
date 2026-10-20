import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({ kind = 'primary', children, className = '', ...rest }: { kind?: 'primary' | 'secondary' | 'ghost'; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: 'bg-brand text-white hover:bg-brand-dark',
    secondary: 'border border-line bg-card text-ink hover:bg-[#F8F9F7]',
    ghost: 'text-brand hover:bg-brand-soft',
  }[kind];
  return (
    <button type="button" className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-medium transition-colors disabled:opacity-50 ${styles} ${className}`} {...rest}>
      {children}
    </button>
  );
}
