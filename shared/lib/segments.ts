import type { FeeComponent, SegmentId } from '../data/types';

export const SEGMENTS: Record<SegmentId, { label: string; scheme: string; cardType: 'debit' | 'credit' | 'other' }> = {
  visa_debit: { label: 'Visa debit', scheme: 'Visa', cardType: 'debit' },
  mc_debit: { label: 'Mastercard debit', scheme: 'Mastercard', cardType: 'debit' },
  eftpos_debit: { label: 'eftpos', scheme: 'eftpos', cardType: 'debit' },
  visa_credit: { label: 'Visa credit', scheme: 'Visa', cardType: 'credit' },
  mc_credit: { label: 'Mastercard credit', scheme: 'Mastercard', cardType: 'credit' },
  amex_credit: { label: 'Amex', scheme: 'Amex', cardType: 'credit' },
  other: { label: 'Other', scheme: 'Other', cardType: 'other' },
};

export const COMPONENTS: { id: FeeComponent; label: string }[] = [
  { id: 'acquiring', label: 'Acquiring fees' },
  { id: 'interchange', label: 'Interchange' },
  { id: 'scheme', label: 'Scheme fees' },
  { id: 'processor', label: 'Processor fees' },
  { id: 'other', label: 'Other fees' },
];
export const componentLabel = (c: FeeComponent) => COMPONENTS.find((x) => x.id === c)!.label;
