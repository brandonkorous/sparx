'use client';

// The bar over one record: its name, Save, Remove and refresh. Moved out of
// record-detail.tsx (sparx persona issue 240) unchanged.

import { Button, Text } from '@wizeworks/silicaui-react';
import { faTable, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { Editor } from './record-detail';

/** The one overflow row: Remove, with the record's own name on the question. */
function removeAction(editor: Editor, label: string, title: string) {
  return {
    label: 'Remove',
    title: `Remove this ${label.toLowerCase()}`,
    icon: faTrashCan,
    tone: 'danger' as const,
    onClick: () => {
      void editor.onDelete(title);
    },
  };
}

export function RecordToolbar(props: {
  editor: Editor;
  label: string;
  title: string;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { editor, label } = props;
  return (
    <PaneToolbar
      label={`${label} actions`}
      status={
        <>
          <Icon glyph={faTable} className="size-4 shrink-0" aria-hidden />
          <Text as="span" className="truncate text-sm">
            {editor.isNew ? `New ${label.toLowerCase()}` : props.title}
          </Text>
        </>
      }
      primary={
        <Button
          color="module"
          size="sm"
          className="ml-auto shrink-0"
          loading={editor.saving}
          disabled={!editor.isNew && !editor.dirty}
          onClick={() => {
            editor.submit(editor.draft);
          }}
        >
          {editor.isNew ? `Add ${label.toLowerCase()}` : 'Save'}
        </Button>
      }
      /* A VALUE, not bespoke JSX: `controls` relocates into the narrow bar's
         overflow popover verbatim, so this was a bare red bin among rows that
         had words. scripts/check-toolbar-glyph.mjs holds the line. */
      actions={editor.isNew ? undefined : [removeAction(editor, label, props.title)]}
      refresh={
        <RefreshButton
          isFetching={props.refreshing}
          updatedAt={editor.record.data ? editor.record.dataUpdatedAt : undefined}
          onRefresh={props.onRefresh}
        />
      }
    />
  );
}
