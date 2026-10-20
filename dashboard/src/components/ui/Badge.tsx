import type { ReactNode } from 'react';

export type Tone = 'danger' | 'amber' | 'brand' | 'neutral' | 'info';
const TONES: Record<Tone, string> = {
  danger: 'bg-danger-soft text-danger',
  amber: 'bg-amber-soft text-amber',
  brand: 'bg-brand-soft text-brand-dark',
  neutral: 'bg-[#EEF0EC] text-subtle',
  info: 'bg-info-soft text-info',
};

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium ${TONES[tone]} ${className}`}>{children}</span>;
}

export const priorityTone = (p: 'high' | 'medium' | 'low'): Tone => (p === 'high' ? 'danger' : p === 'medium' ? 'amber' : 'neutral');
export const confidenceTone = (c: 'high' | 'medium' | 'low'): Tone => (c === 'high' ? 'brand' : c === 'medium' ? 'amber' : 'neutral');
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
