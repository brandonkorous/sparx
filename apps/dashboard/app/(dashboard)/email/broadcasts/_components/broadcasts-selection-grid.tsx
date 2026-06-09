'use client';

import * as React from 'react';
import Link from 'next/link';
import { Send, XCircle } from 'lucide-react';
import {
  Badge,
  BulkActionBar,
  type BulkAction,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Grid,
  Stack,
  Text,
  type BadgeProps,
} from '@sparx/ui';

import { bulkCancelBroadcastsAction } from '../actions';
import type { BroadcastRow } from '../../_lib/types';

const STATUS_BADGE: Record<BroadcastRow['status'], BadgeProps['color']> = {
  draft: 'outline',
  scheduled: 'warning',
  sending: 'soft',
  sent: 'success',
  cancelled: 'default',
  failed: 'danger',
};

// Only draft and scheduled broadcasts can be cancelled.
function isCancellable(status: BroadcastRow['status']): boolean {
  return status === 'draft' || status === 'scheduled';
}

interface BroadcastsSelectionGridProps {
  broadcasts: BroadcastRow[];
}

export function BroadcastsSelectionGrid({ broadcasts }: BroadcastsSelectionGridProps) {
  const [selected, setSelected] = React.useState<string[]>([]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const bulkActions: BulkAction[] = [
    {
      label: 'Cancel',
      icon: XCircle,
      variant: 'destructive',
      requiresConfirm: true,
      confirmLabel:
        'Cancel {count} broadcast{count === 1 ? "" : "s"}? Scheduled sends will be aborted. This cannot be undone.',
      onAction: async (ids) => {
        await bulkCancelBroadcastsAction(ids);
        setSelected([]);
      },
    },
  ];

  return (
    <>
      <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
        {broadcasts.map((b) => {
          const cancellable = isCancellable(b.status);
          const checked = selected.includes(b.id);

          return (
            <Card key={b.id} variant="module">
              <CardHeader>
                <Stack direction="row" align="start" gap={2}>
                  {cancellable ? (
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(b.id)}
                      aria-label={`Select ${b.name}`}
                      className="mt-0.5 shrink-0"
                    />
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}
                  <Stack gap={1} className="min-w-0 flex-1">
                    <Stack direction="row" align="center" justify="between" gap={2}>
                      <CardTitle className="truncate">{b.name}</CardTitle>
                      <Badge color={STATUS_BADGE[b.status]}>{b.status}</Badge>
                    </Stack>
                    <CardDescription className="truncate">{b.subject}</CardDescription>
                  </Stack>
                </Stack>
              </CardHeader>
              <CardContent>
                <Stack gap={2}>
                  {(b.status === 'sent' || b.status === 'scheduled') && (
                    <Text size="sm" variant="muted">
                      {b.recipientCount} recipient{b.recipientCount === 1 ? '' : 's'}
                    </Text>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/email/broadcasts/${b.id}`}>
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      Open
                    </Link>
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Grid>

      <BulkActionBar selected={selected} onClear={() => setSelected([])} actions={bulkActions} />
    </>
  );
}
