import type { ReactNode } from 'react';
import { useData } from '../../state/DataContext';
import { ErrorState, LoadingScreen } from '../ui/States';

/** Shows the loading and error states; renders children once data is ready. */
export function DataGate({ children }: { children: ReactNode }) {
  const { status, error, retry } = useData();
  if (status === 'loading') return <LoadingScreen />;
  if (status === 'error') return <ErrorState message={error ?? 'Unknown error'} onRetry={retry} />;
  return <>{children}</>;
}
