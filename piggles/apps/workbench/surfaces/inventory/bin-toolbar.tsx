'use client';

import { Button } from '@wizeworks/silicaui-react';
import { faBoxArchive, faFloppyDisk, faQrcode } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar } from '../../components/pane-toolbar';
import type { ToolbarAction } from '../../components/pane-toolbar-actions';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import type { BinDetailState } from './use-bin-detail';

interface ToolbarProps {
  ctx: SurfaceContext;
  state: BinDetailState;
}

function binActions({ ctx, state }: ToolbarProps): ToolbarAction[] {
  const { id, isNew, isSystem, onArchive } = state;
  return [
    ...(!isNew && !isSystem
      ? [
          {
            label: 'Remove',
            title: 'Remove this shelf',
            icon: faBoxArchive,
            tone: 'danger' as const,
            onClick: () => {
              void onArchive();
            },
          },
        ]
      : []),
    ...(!isNew
      ? [
          {
            label: 'Print a label',
            title: 'Print a label for this shelf',
            icon: faQrcode,
            onClick: () => {
              ctx.open('inventory.bins.labels', { binId: id }, { target: 'beside' });
            },
          },
        ]
      : []),
  ];
}

export function BinToolbar({ ctx, state }: ToolbarProps) {
  const { bin, contents, valid, changed, saving, submit, setLoaded } = state;
  return (
    <PaneToolbar
      label="Shelf controls"
      // Save is `primary`, never `controls`: `controls` relocates into the
      // overflow popover under 672px, and a commit action must be reachable
      // at every width. Enforced by scripts/check-toolbar-primary.mjs.
      primary={
        <Button
          color="module-inventory"
          size="sm"
          disabled={!valid || !changed || saving}
          onClick={submit}
        >
          <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
          Save
        </Button>
      }
      // Declared as VALUES, not JSX: the narrow bar's overflow re-authors only `actions`
      // as labelled rows; as buttons these arrived as wordless glyphs.
      // scripts/check-toolbar-glyph.mjs holds the line.
      actions={binActions({ ctx, state })}
      refresh={
        <RefreshButton
          isFetching={bin.isFetching || contents.isFetching}
          updatedAt={bin.data ? bin.dataUpdatedAt : undefined}
          onRefresh={() => {
            setLoaded(false);
            void bin.refetch();
            void contents.refetch();
          }}
        />
      }
    />
  );
}
