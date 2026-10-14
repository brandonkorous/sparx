'use client';

// The bar over a record type's list: its search, saved views, and Add. Moved out
// of records-list.tsx (sparx persona issue 240) unchanged.

import { Button, Input } from '@wizeworks/silicaui-react';
import { faPlus, faTable } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { RecordsListState } from './records-list';
import { SavedViewsMenu, viewFilters } from './saved-views-menu';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

/** The search box and the saved views: what narrows the list. */
function RecordsSearch({
  list,
  objectKey,
  labelPlural,
}: {
  list: RecordsListState;
  objectKey: string;
  labelPlural: string;
}) {
  return (
    <>
      <Input
        color="module"
        size="sm"
        className="max-w-64"
        aria-label={`Search ${labelPlural.toLowerCase()}`}
        placeholder={`Search ${labelPlural.toLowerCase()}`}
        value={list.q}
        onChange={(event) => {
          list.setQ(event.target.value);
        }}
      />
      <SavedViewsMenu
        objectKey={objectKey}
        current={list.currentFilters}
        baseline={viewFilters([])}
        nameHint={`The ${labelPlural.toLowerCase()} I check`}
        selectedId={list.viewId}
        onApply={list.applyView}
      />
    </>
  );
}

export function RecordsToolbar(props: {
  list: RecordsListState;
  objectKey: string;
  label: string;
  labelPlural: string;
  onAdd: (event: OpenEvent) => void;
}) {
  const { list, labelPlural } = props;
  return (
    <PaneToolbar
      label={`${labelPlural} list controls`}
      status={<Icon glyph={faTable} className="size-4 shrink-0" aria-hidden />}
      primary={
        <Button
          color="module"
          size="sm"
          className="ml-auto shrink-0"
          title={`Add a ${props.label.toLowerCase()}: hold Shift to open alongside, Alt for a new window`}
          onClick={props.onAdd}
        >
          <Icon glyph={faPlus} className="size-4" aria-hidden />
          Add {props.label.toLowerCase()}
        </Button>
      }
      controls={<RecordsSearch list={list} objectKey={props.objectKey} labelPlural={labelPlural} />}
      refresh={
        <RefreshButton
          isFetching={list.records.isFetching}
          updatedAt={list.records.data ? list.records.dataUpdatedAt : undefined}
          onRefresh={() => {
            void list.records.refetch();
          }}
        />
      }
    />
  );
}
