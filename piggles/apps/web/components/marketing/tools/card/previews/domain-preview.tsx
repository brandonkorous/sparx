import { Badge } from '@wizeworks/silicaui-react';

const ROWS: [string, 'success' | 'neutral', string][] = [
  ['bellacafe.com', 'neutral', 'Taken'],
  ['bellacafe.cafe', 'success', 'Free'],
  ['bellacafe.shop', 'success', 'Free'],
];

/** The answer the checker gives, three endings at a time. */
export function DomainPreview() {
  return (
    <div className="flex w-full flex-col gap-1.5">
      {ROWS.map(([name, tone, label]) => (
        <div
          key={name}
          className="rounded-field flex items-center justify-between bg-white px-3 py-1.5"
        >
          <span className="truncate font-mono text-xs">{name}</span>
          <Badge color={tone} variant="soft">
            {label}
          </Badge>
        </div>
      ))}
    </div>
  );
}
