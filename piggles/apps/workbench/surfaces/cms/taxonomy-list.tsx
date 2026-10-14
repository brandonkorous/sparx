'use client';

// Every way you file content: "Categories", "Tags", and any of your own. A business
// has a handful, so the list loads whole and filters in the browser, as a table
// people scan down ("which of these nests", "which one is biggest").

import { useMemo, useState } from 'react';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import { Button, Card } from '@wizeworks/silicaui-react';
import { faPlus, faTags } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { createLabelFor, type OpenTarget, type SurfaceContext } from '../../lib/surfaces/registry';
import { useTaxonomies, type Taxonomy } from './taxonomy-data';
import { TaxonomyTable } from './taxonomy-list-table';
import { TaxonomyToolbar } from './taxonomy-list-toolbar';
import { RowOpenHint } from '../../components/row-open-hint';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'cms';

interface Modifiers {
  shiftKey: boolean;
  altKey: boolean;
}

/** Same modifier contract as every other list in the app. */
function targetFor(event: Modifiers): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function matching(all: Taxonomy[], needle: string): Taxonomy[] {
  if (!needle) return all;
  return all.filter(
    (taxonomy) =>
      taxonomy.name.toLowerCase().includes(needle) ||
      taxonomy.plural_name.toLowerCase().includes(needle) ||
      taxonomy.key.toLowerCase().includes(needle)
  );
}

function TaxonomyEmpty({ filtered, onCreate }: { filtered: boolean; onCreate: () => void }) {
  return (
    <ListEmptyState
      module={MODULE}
      filtered={filtered}
      noResults={{
        icon: <Icon glyph={faTags} className="size-6" aria-hidden />,
        title: 'Nothing matches that',
        description: 'Try part of the name, or clear the search to see them all.',
      }}
      firstRun={{
        title: 'No ways to file content yet',
        description:
          'A way to file content (like Categories or Tags) lets readers find everything you have written on one subject. Add your first one to get started.',
        actions: (
          <Button size="sm" color="module" onClick={onCreate}>
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Add one
          </Button>
        ),
      }}
    />
  );
}

function useTaxonomyView() {
  const query = useTaxonomies();
  const [search, setSearch] = useState('');
  const all = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => a.plural_name.localeCompare(b.plural_name)),
    [query.data]
  );
  const needle = search.trim().toLowerCase();
  return { query, search, setSearch, all, needle, matches: matching(all, needle) };
}

function TaxonomyLoadFailed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Card className="min-h-0 flex-1 items-center justify-center">
      <PaneLoadError
        icon={<Icon glyph={faTags} className="size-6" aria-hidden />}
        title="Could not load your tags and topics"
        description="This is a problem reaching the server. None of your labels are affected."
        error={error}
        onRetry={onRetry}
      />
    </Card>
  );
}

export function TaxonomyListSurface({ ctx }: { ctx: SurfaceContext }) {
  const createLabel = createLabelFor('cms.taxonomy.list');
  const { query, search, setSearch, all, needle, matches } = useTaxonomyView();
  const { data, isPending, isError, error, isFetching, dataUpdatedAt, refetch } = query;

  const open = (taxonomy: Taxonomy, event: Modifiers) => {
    ctx.open('cms.taxonomy.detail', { key: taxonomy.key }, { target: targetFor(event) });
  };
  const create = (event: Modifiers) => {
    ctx.open('cms.taxonomy.detail', { key: 'new' }, { target: targetFor(event) });
  };
  const retry = () => {
    void refetch();
  };

  if (isError) return <TaxonomyLoadFailed error={error} onRetry={retry} />;

  return (
    <div className={PANE_SHELL}>
      <TaxonomyToolbar
        search={search}
        onSearch={setSearch}
        matched={matches.length}
        total={all.length}
        createLabel={createLabel}
        onCreate={create}
        isPending={isPending}
        isError={isError}
        isFetching={isFetching}
        updatedAt={data ? dataUpdatedAt : undefined}
        onRefresh={retry}
      />
      <Card className="min-h-0 flex-1 overflow-y-auto">
        {isPending ? (
          <PaneWaiting />
        ) : matches.length === 0 ? (
          <TaxonomyEmpty
            filtered={Boolean(needle)}
            onCreate={() => {
              create({ shiftKey: false, altKey: false });
            }}
          />
        ) : (
          <TaxonomyTable rows={matches} onOpen={open} />
        )}
      </Card>
      {matches.length > 0 ? <RowOpenHint /> : null}
    </div>
  );
}
