'use client';

// The people whose names appear on what you publish: a table with the face and name
// first, the web address second. A masthead is small and bounded, so it loads in one
// window and filters in the browser, like the web-addresses list.

import { useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Button, Card } from '@wizeworks/silicaui-react';
import { faPlus, faUser, faUserPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
// Read-only import: resolves avatar asset ids to real thumbnail URLs, the same
// way the content editor's asset fields do.
import { useMediaAssets, type MediaAsset } from './media';
// Read-only import: how many sites the business runs, which is the only thing
// that decides whether a shared byline is worth marking as one.
import { useSites } from '../sites/data';
import { useAuthorsList, type Author } from './authors-data';
import { AuthorsTable } from './authors-list-table';
import { AuthorsToolbar } from './authors-list-toolbar';
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

// Every avatar in ONE request, so the list shows real faces rather than ids.
function useAvatarAssets(authors: readonly Author[]) {
  const avatarIds = useMemo(
    () =>
      authors
        .map((author) => author.avatar_asset_id)
        .filter((id): id is string => typeof id === 'string'),
    [authors]
  );
  const { data: assets } = useMediaAssets(avatarIds);
  return useMemo(() => {
    const map = new Map<string, MediaAsset>();
    for (const asset of assets ?? []) map.set(asset.id, asset);
    return map;
  }, [assets]);
}

function useMatches(authors: readonly Author[], needle: string) {
  return useMemo(
    () =>
      needle
        ? authors.filter(
            (author) =>
              author.display_name.toLowerCase().includes(needle) ||
              author.slug.toLowerCase().includes(needle)
          )
        : authors,
    [authors, needle]
  );
}

function useAuthorsView(search: string) {
  // A masthead is a bounded set of people, so one generous window covers it and
  // the search runs in the browser. `take: 250` is the API's ceiling.
  const query = useAuthorsList({ take: 250, skip: 0 });

  const authors = useMemo(() => query.data?.items ?? [], [query.data]);

  // The list is already scoped to this site by the server; this only decides
  // whether "shared across all your sites" is a distinction worth printing.
  const { data: sites } = useSites();
  const multiSite = (sites ?? []).length > 1;
  const assetById = useAvatarAssets(authors);
  const needle = search.trim().toLowerCase();
  const matches = useMatches(authors, needle);

  return { query, authors, multiSite, assetById, needle, matches };
}

interface AuthorsListBodyProps {
  isError: boolean;
  error: unknown;
  isPending: boolean;
  matches: readonly Author[];
  filtered: boolean;
  assetById: Map<string, MediaAsset>;
  showShared: boolean;
  onRetry: () => void;
  onOpen: (author: Author, event: Modifiers) => void;
  onCreate: () => void;
}

// A failed load REPLACES the list, never the pane: "no authors yet" over a failure
// is a lie about their work, and the toolbar above still works.
function AuthorsListBody(props: AuthorsListBodyProps) {
  if (props.isError) {
    return (
      <PaneLoadError
        icon={<Icon glyph={faUser} className="size-6" aria-hidden />}
        title="Could not load your authors"
        description="This is a problem reaching the server. None of your authors have been lost."
        error={props.error}
        onRetry={props.onRetry}
      />
    );
  }
  if (props.isPending) return <PaneWaiting />;
  if (props.matches.length === 0) {
    return (
      <ListEmptyState
        module={MODULE}
        filtered={props.filtered}
        noResults={{
          icon: <Icon glyph={faUserPlus} className="size-6" aria-hidden />,
          title: 'No authors match that',
          description: 'Try part of the name, or clear the search to see everyone.',
        }}
        firstRun={{
          title: 'No authors yet',
          description:
            'Authors are the names that appear on what you publish: a photo and a short biography each. Add your first one and you can pick it on any post.',
          actions: (
            <Button size="sm" color="module" onClick={props.onCreate}>
              <Icon glyph={faPlus} className="size-4" aria-hidden />
              Add an author
            </Button>
          ),
        }}
      />
    );
  }
  return (
    <AuthorsTable
      authors={props.matches}
      assetById={props.assetById}
      showShared={props.showShared}
      onOpen={props.onOpen}
    />
  );
}

export function AuthorsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const { query, authors, matches, needle, multiSite, assetById } = useAuthorsView(search);
  const { data, isPending, isError, error, isFetching, dataUpdatedAt, refetch } = query;
  const open = (author: Author, event: Modifiers) => {
    ctx.open('cms.authors.detail', { id: author.id }, { target: targetFor(event) });
  };
  const create = (event: Modifiers) => {
    ctx.open('cms.authors.detail', { id: 'new' }, { target: targetFor(event) });
  };
  const retry = () => {
    void refetch();
  };

  return (
    <div className={PANE_SHELL}>
      <AuthorsToolbar
        search={search}
        onSearch={setSearch}
        matched={matches.length}
        total={authors.length}
        isPending={isPending}
        isError={isError}
        isFetching={isFetching}
        updatedAt={data ? dataUpdatedAt : undefined}
        onRefresh={retry}
        onCreate={create}
      />

      <Card className="min-h-0 flex-1 overflow-y-auto">
        <AuthorsListBody
          isError={isError}
          error={error}
          isPending={isPending}
          matches={matches}
          filtered={Boolean(needle)}
          assetById={assetById}
          showShared={multiSite}
          onRetry={retry}
          onOpen={open}
          onCreate={() => {
            create({ shiftKey: false, altKey: false });
          }}
        />
      </Card>

      {matches.length > 0 ? <RowOpenHint what="an author to edit" /> : null}
    </div>
  );
}
