import { useData } from '../../state/DataContext';
import { Card, CardHeader } from '../ui/Card';
import { DriversDonut, DriversLegend } from './DriversDonut';

export function CostDriversCard() {
  const { derived } = useData();
  if (!derived) return null;
  return (
    <Card labelledBy="drivers-title" className="h-full">
      <CardHeader id="drivers-title" title="Top cost drivers" link="/drivers" linkLabel="View detail" />
      <div className="flex items-center gap-4">
        <DriversDonut drivers={derived.drivers} total={derived.now.cost} />
        <DriversLegend drivers={derived.drivers} />
      </div>
    </Card>
  );
}
