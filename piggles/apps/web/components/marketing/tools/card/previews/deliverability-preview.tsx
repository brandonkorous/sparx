import { Badge } from '@wizeworks/silicaui-react';

/** The three answers the checker gives. */
const ROWS: [string, 'success' | 'warning' | 'danger', string][] = [
  ['SPF', 'success', 'Fine'],
  ['DKIM', 'success', 'Fine'],
  ['DMARC', 'warning', 'Monitoring'],
];

export function DeliverabilityPreview() {
  return (
    <div className="flex w-full flex-col gap-2">
      {ROWS.map(([name, tone, label]) => (
        <div
          key={name}
          className="rounded-field flex items-center justify-between bg-white px-3 py-2"
        >
          <span className="font-mono text-sm font-bold">{name}</span>
          <Badge color={tone} variant="soft">
            {label}
          </Badge>
        </div>
      ))}
    </div>
  );
}
