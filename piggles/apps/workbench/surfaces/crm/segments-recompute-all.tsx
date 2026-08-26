'use client';

// "Update all groups" — the list-level escape hatch for stale membership.
//
// The per-group button on the detail pane could only ever fix one at a time,
// and staleness does not arrive one at a time: built-in groups are seeded
// empty together, and a stalled evaluator stalls every group at once.

import { Button, Tooltip, useToast } from '@wizeworks/silicaui-react';
import { faArrowsRotate } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useRecomputeAllSegments } from './segments-mutations';

function peopleMoved(changed: number): string {
  if (changed === 0) return 'Every group was already up to date';
  if (changed === 1) return '1 person moved in or out';
  return `${changed.toLocaleString()} people moved in or out`;
}

export function RecomputeAllButton() {
  const toast = useToast();
  const recompute = useRecomputeAllSegments();

  return (
    <Tooltip content="Re-check every customer against every group's rules. Groups normally keep themselves up to date; use this if the list looks out of date.">
      <Button
        color="module"
        variant="soft"
        size="sm"
        className="shrink-0"
        loading={recompute.isPending}
        onClick={() => {
          recompute.mutate(undefined, {
            onSuccess: (result) => {
              toast.add({
                title: peopleMoved(result.changed),
                description: `Checked ${result.scanned.toLocaleString()} customers against every group.`,
                type: 'success',
              });
            },
            onError: () => {
              toast.add({
                title: 'Could not update the groups',
                description: 'Nothing was changed — try again in a moment.',
                type: 'error',
              });
            },
          });
        }}
      >
        <Icon glyph={faArrowsRotate} className="size-4" aria-hidden />
        Update all
      </Button>
    </Tooltip>
  );
}
