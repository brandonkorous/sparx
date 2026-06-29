import { FileText } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ModuleProvider,
  Stack,
  Text,
} from '@sparx/ui';

import { Icon } from './icons';
import { timeAgo } from './format';
import type { ActivityItem } from './types';

// The recent-activity feed (bottom of the pyramid). Every row carries its
// module's hue on the icon chip so the cross-module stream stays scannable by
// color. Quick-create actions live in the header's Create menu, not here.

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="No recent activity"
            description="Publishes, stock changes, and customer events show up here."
          />
        ) : (
          <Stack gap={0}>
            {items.map((it) => (
              <ModuleProvider key={it.key} module={it.module}>
                <div className="flex items-center gap-3 border-b border-[var(--color-border-default)] py-3 last:border-b-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--module-active-tint)] text-[var(--module-active)]">
                    <Icon name={it.module} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                      {it.title}
                    </div>
                    <div className="truncate text-xs text-[var(--color-text-tertiary)]">
                      {it.meta}
                    </div>
                  </div>
                  <Text size="xs" variant="muted" className="shrink-0">
                    {timeAgo(it.at)}
                  </Text>
                </div>
              </ModuleProvider>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
