'use client';

// The toolbar for one campaign: its state, and the three things you can do to it.
//
// Turn-on is disabled with the REASON in its tooltip. The server still refuses;
// this is the explanation, not the guard.

import { Badge, Button, Text } from '@wizeworks/silicaui-react';
import { faPause, faPlay, faTrash } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar } from '../../components/pane-toolbar';
import { statusMeta } from './presentation';
import type { FunnelStatus } from './types';

export interface CampaignActionsProps {
  status: FunnelStatus;
  canEdit: boolean;
  busy: boolean;
  changed: boolean;
  blockedReason: string | null;
  onSave: () => void;
  onToggleRunning: (next: boolean) => void;
  onDelete: () => void;
}

function RunButton({
  running,
  busy,
  blockedReason,
  onToggleRunning,
}: Pick<CampaignActionsProps, 'busy' | 'blockedReason' | 'onToggleRunning'> & {
  running: boolean;
}) {
  return (
    <Button
      size="sm"
      color={running ? 'warning' : 'module'}
      variant={running ? 'outline' : 'solid'}
      disabled={busy || (!running && blockedReason !== null)}
      title={!running && blockedReason ? blockedReason : undefined}
      onClick={() => {
        onToggleRunning(!running);
      }}
    >
      <Icon glyph={running ? faPause : faPlay} className="size-4" aria-hidden />
      {running ? 'Pause it' : 'Turn it on'}
    </Button>
  );
}

export function CampaignActions({
  status,
  canEdit,
  busy,
  changed,
  blockedReason,
  onSave,
  onToggleRunning,
  onDelete,
}: CampaignActionsProps) {
  const meta = statusMeta(status);
  const running = status === 'active';

  return (
    <PaneToolbar
      label="Campaign controls"
      status={
        <>
          <Badge color={meta.tone} variant="soft" size="sm">
            {meta.label}
          </Badge>
          <Text className="text-sm">{meta.note}</Text>
        </>
      }
      primary={
        canEdit ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <RunButton
              running={running}
              busy={busy}
              blockedReason={blockedReason}
              onToggleRunning={onToggleRunning}
            />
            <Button size="sm" color="module" disabled={!changed || busy} onClick={onSave}>
              Save
            </Button>
          </div>
        ) : null
      }
      /* A VALUE, not bespoke JSX. The header above used to say a
         ToolbarAction had no color of its own to say "destructive" - it has
         had `tone: 'danger'` since the assembly run's "Call this run off" hit
         the same wall, and this call site was not swept with it.
         scripts/check-toolbar-glyph.mjs holds the line. */
      actions={
        canEdit
          ? [
              {
                label: 'Delete',
                title: 'Delete this campaign',
                icon: faTrash,
                tone: 'danger' as const,
                onClick: () => {
                  void onDelete();
                },
              },
            ]
          : undefined
      }
    />
  );
}
