'use client';

// The pipelines list: the sets of stages a deal or help request moves through.
// Deal counts are not in the list payload, so they live where a pipeline's deals do.

import { Button, Card, SearchInput, Select } from '@wizeworks/silicaui-react';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { faDiagramProject, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { createLabelFor, type OpenTarget, type SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { RefreshButton } from '../../components/refresh-button';
import { usePipelines, type Pipeline } from './pipelines-data';
import { ListFooter } from '../../components/list-footer';
import { countLabel } from '../../components/list-footer-words';
import { PipelinesTable } from './pipelines-table';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'crm';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}
type Scope = 'active' | 'all';
interface CreateFirst {
  label: string;
  onClick: (event: OpenEvent) => void;
}

function targetFor(event: OpenEvent): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function ScopeSelect(props: { scope: Scope; setScope: Dispatch<SetStateAction<Scope>> }) {
  return (
    <div className="w-44 shrink-0">
      <Select
        color="module"
        size="sm"
        aria-label="Which ones to show"
        value={props.scope}
        items={{ active: 'In use', all: 'Including put away' }}
        onValueChange={(next) => {
          props.setScope(next as Scope);
        }}
      />
    </div>
  );
}

function CreateButton({ createFirst }: { createFirst: CreateFirst }) {
  return (
    <Button
      color="module"
      size="sm"
      className="ml-auto shrink-0"
      title={`${createFirst.label}: hold Shift to open alongside, Alt for a new window`}
      onClick={createFirst.onClick}
    >
      <Icon glyph={faPlus} className="size-4" aria-hidden />
      {createFirst.label}
    </Button>
  );
}

function PipelinesToolbar(props: {
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  scope: Scope;
  setScope: Dispatch<SetStateAction<Scope>>;
  createFirst: CreateFirst;
  query: ReturnType<typeof usePipelines>;
}) {
  const { search, setSearch, scope, setScope, createFirst, query } = props;
  return (
    <PaneToolbar
      label="Controls for how things move"
      search={
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            color="module"
            size="sm"
            aria-label="Search the steps things go through"
            placeholder="Search by name…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
      }
      primary={<CreateButton createFirst={createFirst} />}
      controls={<ScopeSelect scope={scope} setScope={setScope} />}
      views={{
        target: '/crm/pipelines',
        params: { q: search, scope },
        onApply: (next) => {
          setSearch(next.q ?? '');
          setScope(next.scope === 'all' ? 'all' : 'active');
        },
      }}
      refresh={
        <RefreshButton
          isFetching={query.isFetching}
          updatedAt={query.data ? query.dataUpdatedAt : undefined}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
    />
  );
}

function PipelinesBody(props: {
  query: ReturnType<typeof usePipelines>;
  rows: Pipeline[];
  filtered: boolean;
  createFirst: CreateFirst;
  onOpen: (pipeline: Pipeline, event: OpenEvent) => void;
}) {
  const { query, rows } = props;
  if (query.isError) {
    return (
      <PaneLoadError
        icon={<Icon glyph={faDiagramProject} className="size-6" aria-hidden />}
        title="Could not load these"
        description="Something went wrong reaching the server. It may be a temporary problem. Try again in a moment."
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (query.isPending) return <PaneWaiting />;
  if (rows.length > 0) return <PipelinesTable rows={rows} onOpen={props.onOpen} />;
  return (
    <ListEmptyState
      module={MODULE}
      filtered={props.filtered}
      noResults={{
        icon: <Icon glyph={faDiagramProject} className="size-6" aria-hidden />,
        title: 'Nothing matches that',
        description: 'Try a different word, or switch back to the ones in use.',
      }}
      firstRun={{
        title: 'Nothing set up yet',
        description:
          'A process is the set of steps something moves through: a sale going from a first inquiry to won, or a help request from asked to answered. Create your first one to start following them.',
        action: props.createFirst,
      }}
    />
  );
}

function usePipelinesPane(ctx: SurfaceContext) {
  const createLabel = createLabelFor('crm.pipelines.list');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<Scope>('active');

  const query = usePipelines({
    q: search,
    includeArchived: scope === 'all',
    // BOTH kinds (docs/144 §7.2): this is the only surface where a support
    // queue's stages can be renamed or reordered, so it must list them too.
    objectKey: 'all',
  });

  const open = (pipeline: Pipeline, event: OpenEvent) => {
    ctx.open('crm.pipeline.detail', { id: pipeline.id }, { target: targetFor(event) });
  };
  // ONE object for the toolbar's button and the empty state's invitation, so
  // the label cannot drift and the first-run state always has a button.
  const createFirst: CreateFirst = {
    label: createLabel,
    onClick: (event) => {
      ctx.open('crm.pipeline.detail', { id: 'new' }, { target: targetFor(event) });
    },
  };
  const filtered = search.trim() !== '' || scope !== 'active';
  return { search, setSearch, scope, setScope, query, filtered, open, createFirst };
}

export function PipelinesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const pane = usePipelinesPane(ctx);
  const { query, filtered, createFirst } = pane;
  const rows = query.data?.items ?? [];

  return (
    <div className={PANE_SHELL}>
      <PipelinesToolbar
        search={pane.search}
        setSearch={pane.setSearch}
        scope={pane.scope}
        setScope={pane.setScope}
        createFirst={createFirst}
        query={query}
      />

      <Card className="min-h-0 flex-1 overflow-y-auto">
        <PipelinesBody
          query={query}
          rows={rows}
          filtered={filtered}
          createFirst={createFirst}
          onOpen={pane.open}
        />
      </Card>

      <ListFooter
        shown={rows.length}
        count={countLabel({
          shown: rows.length,
          total: query.data?.total,
          filtered,
          pending: query.isPending,
        })}
      />
    </div>
  );
}
