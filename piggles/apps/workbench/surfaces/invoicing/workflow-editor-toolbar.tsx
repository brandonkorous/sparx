'use client';

// The workflow editor's toolbar: what state it is in, Save, and the one rare
// action that needs a conversation first.

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@wizeworks/silicaui-react';
import { faBoxArchive, faEllipsis, faFloppyDisk } from '@fortawesome/pro-solid-svg-icons';
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
  refresh,
}: {
  original: DocumentWorkflowDetail | null;
  isDefault: boolean;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onArchive: () => void;
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
      controls={
        original ? (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto shrink-0"
                aria-label="More actions"
              >
                <Icon glyph={faEllipsis} className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={onArchive}>
                <Icon glyph={faBoxArchive} className="size-4" aria-hidden />
                Archive workflow
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null
      }
    />
  );
}
