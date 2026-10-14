'use client';

// The record-type editor's toolbar: Save, Put away and Refresh.

import { Badge, Button } from '@wizeworks/silicaui-react';
import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { productCopy } from '../../lib/product';
import type { ObjectTypeEditor } from './use-object-type-editor';

export function ObjectTypeToolbar({ ed }: { ed: ObjectTypeEditor }) {
  const { isBuiltin, isNew, blocked, saving, save, query, dirty } = ed;
  const { data: type, isFetching, dataUpdatedAt, refetch } = query;
  return (
    <PaneToolbar
      label="Thing you track actions"
      status={
        isBuiltin ? (
          <Badge color="info" variant="soft" size="sm">
            {productCopy('crm.objectType.builtIn', 'Comes with sparx')}
          </Badge>
        ) : null
      }
      primary={
        <Button
          color="module"
          size="sm"
          className="ml-auto shrink-0"
          disabled={blocked !== null || saving || (!isNew && !dirty)}
          title={blocked ?? undefined}
          onClick={() => {
            void save();
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      }
      controls={isBuiltin || isNew ? null : <PutAwayButton ed={ed} />}
      refresh={
        isNew ? undefined : (
          <RefreshButton
            isFetching={isFetching}
            updatedAt={type ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        )
      }
    />
  );
}

function PutAwayButton({ ed }: { ed: ObjectTypeEditor }) {
  const { putAway } = ed;
  return (
    <Button
      color="danger"
      variant="ghost"
      size="sm"
      onClick={() => {
        void putAway();
      }}
    >
      Put away
    </Button>
  );
}
