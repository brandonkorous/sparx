'use client';

// The workflow editor's toolbar: what state it is in, Save, and the one rare
// action that needs a conversation first.

import { Badge, Button } from '@wizeworks/silicaui-react';
import { faBoxArchive, faBoxOpen, faFloppyDisk } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar } from '../../components/pane-toolbar';
import type { DocumentWorkflowDetail } from './types';

export function WorkflowToolbar({
  original,
  isDefault,
  dirty,
  saving,
  onSave,
  onArchive,
  onRestore,
  refresh,
}: {
  original: DocumentWorkflowDetail | null;
  isDefault: boolean;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onArchive: () => void;
  onRestore: () => void;
  refresh: React.ReactNode;
}) {
  return (
    <PaneToolbar
      label="Workflow editor actions"
      refresh={refresh}
      status={
        <>
          {original?.archivedAt ? (
            <Badge color="neutral" variant="soft" size="sm">
              Archived
            </Badge>
          ) : null}
          {isDefault ? (
            <Badge color="module" variant="soft" size="sm">
              Default
            </Badge>
          ) : null}
        </>
      }
      primary={
        <Button
          color="module"
          size="sm"
          className={original ? 'shrink-0' : 'ml-auto shrink-0'}
          disabled={!dirty || saving}
          loading={saving}
          onClick={onSave}
        >
          <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
          Save
        </Button>
      }
      /* Archiving and un-archiving are the same slot: only one of them can
         apply, so showing both would mean one is always inert. */
      actions={
        original
          ? [
              original.archivedAt
                ? {
                    label: 'Bring it back',
                    title: 'Put this workflow back in the list',
                    icon: faBoxOpen,
                    onClick: onRestore,
                  }
                : {
                    label: 'Archive',
                    title: 'Archive this workflow',
                    icon: faBoxArchive,
                    onClick: onArchive,
                  },
            ]
          : undefined
      }
    />
  );
}
