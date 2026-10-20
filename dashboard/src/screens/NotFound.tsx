import { ScreenHeader } from '../components/ui/ScreenHeader';
import { EmptyState } from '../components/ui/States';

export default function NotFound() {
  return (
    <>
      <ScreenHeader title="Page not found" />
      <EmptyState title="This page doesn't exist" body="It may have moved." action={{ to: '/', label: 'Go to Home' }} />
    </>
  );
}
