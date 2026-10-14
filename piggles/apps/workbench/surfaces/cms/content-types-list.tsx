'use client';

// The kinds of content this business can create, and the doorway to defining new ones.
// A small, bounded set, so it loads at once and filters in the browser; "yours" and
// the built-in ones you cannot change are two tables under plain headings.

import { useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Button, Card } from '@wizeworks/silicaui-react';
import { faDatabase, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { createLabelFor, type OpenTarget, type SurfaceContext } from '../../lib/surfaces/registry';
import {
  useContentTypeList,
  useEntryCountsByType,
  type ContentType,
  type EntryCounts,
} from './content-types-data';
import { TypeGroup } from './content-types-list-table';
import { ContentTypesToolbar, type KindFilterValue } from './content-types-list-toolbar';
import { productCopy } from '../../lib/product';
import { RowOpenHint } from '../../components/row-open-hint';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'cms';

interface Modifiers {
  shiftKey: boolean;
  altKey: boolean;
}
type OpenType = (type: ContentType, event: Modifiers) => void;

/** Same modifier contract as every other list in the app. */
function targetFor(event: Modifiers): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function useFilteredTypes(data: ContentType[] | undefined, kind: KindFilterValue, needle: string) {
  return useMemo(() => {
    const rows = data ?? [];
    return rows.filter((type) => {
      if (kind === 'custom' && type.is_built_in) return false;
      if (kind === 'built_in' && !type.is_built_in) return false;
      if (needle) {
        const haystack =
          `${type.name} ${type.plural_name} ${type.key} ${type.description ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [data, kind, needle]);
}

interface TypeGroupsProps {
  filtered: ContentType[];
  counts: Map<string, EntryCounts> | undefined;
  kind: KindFilterValue;
  createLabel: string;
  onOpen: OpenType;
}

function TypeGroups({ filtered, counts, kind, createLabel, onOpen }: TypeGroupsProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <TypeGroup
        title="Your kinds"
        description="The kinds of content you defined. Open one to change its fields."
        types={filtered.filter((type) => !type.is_built_in)}
        counts={counts}
        emptyHint={
          kind === 'built_in'
            ? null
            : `You have not defined any of your own yet. Use “${createLabel}” above to make one.`
        }
        onOpen={onOpen}
      />
      <TypeGroup
        title="Built-in kinds"
        description={productCopy(
          'cms.contentTypes.builtIn',
          'Shared types that come with Piggles. You can look at how they are built, but they cannot be changed or removed.'
        )}
        types={filtered.filter((type) => type.is_built_in)}
        counts={counts}
        emptyHint={null}
        onOpen={onOpen}
      />
    </div>
  );
}

interface ContentTypesBodyProps extends TypeGroupsProps {
  error: unknown;
  isLoading: boolean;
  narrowed: boolean;
  onRetry: () => void;
  onCreate: () => void;
}

// A failed load REPLACES the list: a false "nothing here" over a failure is the
// worst thing to say about a schema.
function ContentTypesBody(props: ContentTypesBodyProps) {
  if (props.error) {
    return (
      <Card className="flex-1">
        <PaneLoadError
          icon={<Icon glyph={faDatabase} className="size-6" aria-hidden />}
          module={MODULE}
          title="Could not load your kinds of content"
          description="This is a problem reaching the server. Nothing you have defined is affected."
          error={props.error}
          onRetry={props.onRetry}
        />
      </Card>
    );
  }
  if (props.isLoading) {
    return (
      <Card className="flex-1">
        <PaneWaiting />
      </Card>
    );
  }
  if (props.filtered.length === 0) return <ContentTypesEmpty {...props} />;
  return <TypeGroups {...props} />;
}

function ContentTypesEmpty({ narrowed, createLabel, onCreate }: ContentTypesBodyProps) {
  return (
    <Card className="flex-1">
      <ListEmptyState
        module={MODULE}
        filtered={narrowed}
        noResults={{
          icon: <Icon glyph={faDatabase} className="size-6" aria-hidden />,
          title: 'Nothing matches that',
          description: 'Try a different search, or switch the filter back to All.',
        }}
        firstRun={{
          title: 'No kinds of content yet',
          description:
            'Define your first kind of content (a recipe, a case study, a job listing) with exactly the fields it needs.',
          actions: (
            <Button size="sm" color="module" onClick={onCreate}>
              <Icon glyph={faPlus} className="size-4" aria-hidden />
              {createLabel}
            </Button>
          ),
        }}
      />
    </Card>
  );
}

function useTypesView() {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<KindFilterValue>('all');
  const query = useContentTypeList();
  // Counts are a nice-to-have overlay: if they fail, the list still works, so this
  // never blocks or errors the surface.
  const { data: counts } = useEntryCountsByType();
  const needle = search.trim().toLowerCase();
  const filtered = useFilteredTypes(query.data, kind, needle);
  return { search, setSearch, kind, setKind, needle, query, counts, filtered };
}

export function ContentTypesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const createLabel = createLabelFor('cms.types.list');
  const { search, setSearch, kind, setKind, needle, query, counts, filtered } = useTypesView();
  const { data, isLoading, isFetching, dataUpdatedAt, error, refetch } = query;
  const open: OpenType = (type, event) => {
    ctx.open('cms.types.detail', { key: type.key }, { target: targetFor(event) });
  };
  const create = (event: Modifiers) => {
    ctx.open('cms.types.detail', { key: 'new' }, { target: targetFor(event) });
  };
  const retry = () => {
    void refetch();
  };

  return (
    <div className={PANE_SHELL}>
      <ContentTypesToolbar
        search={search}
        onSearch={setSearch}
        kind={kind}
        onKind={setKind}
        createLabel={createLabel}
        onCreate={create}
        isFetching={isFetching}
        updatedAt={data ? dataUpdatedAt : undefined}
        onRefresh={retry}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ContentTypesBody
          error={error}
          isLoading={isLoading}
          filtered={filtered}
          counts={counts}
          kind={kind}
          narrowed={kind !== 'all' || needle !== ''}
          createLabel={createLabel}
          onOpen={open}
          onRetry={retry}
          onCreate={() => {
            create({ shiftKey: false, altKey: false });
          }}
        />
      </div>
      {filtered.length > 0 ? <RowOpenHint /> : null}
    </div>
  );
}
