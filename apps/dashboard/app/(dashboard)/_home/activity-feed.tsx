import { FileText } from 'lucide-react';
import { Card, CardBody, CardTitle, EmptyState } from '@wizeworks/silicaui-react';
import { ModuleProvider } from '@sparx/ui';

import { Icon } from './icons';
import { timeAgo } from './format';
import type { ActivityItem } from './types';

// The recent-activity feed (bottom of the pyramid). Every row carries its
// module's hue on the icon chip so the cross-module stream stays scannable by
// color. Quick-create actions live in the header's Create menu, not here.

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card className="h-full">
      <CardBody>
        <CardTitle>Recent activity</CardTitle>
        {items.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="No recent activity"
            description="Publishes, stock changes, and customer events show up here."
          />
        ) : (
          <div className="flex flex-col gap-0">
            {items.map((it) => (
              <ModuleProvider key={it.key} module={it.module}>
                <div className="border-base-300 flex items-center gap-3 border-b py-3 last:border-b-0">
                  <span className="bg-module bg-soft text-module flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                    <Icon name={it.module} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-base-content truncate text-sm font-medium">{it.title}</div>
                    <div className="text-base-content/50 truncate text-xs">{it.meta}</div>
                  </div>
                  <p className="text-base-content/70 shrink-0 text-xs">{timeAgo(it.at)}</p>
                </div>
              </ModuleProvider>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
