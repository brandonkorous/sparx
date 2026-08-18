'use client';

// The people whose names appear on what you publish.
//
// A table, like every other list page in the app: the author's face and name in
// the first cell, the web address in the second. The faces stay — they just live
// inside a row now — and people scan the names down the column.
//
// The list is small and bounded — a masthead is people, not records — so it
// loads in one window and filters in the browser, like the web-addresses list.

import { useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import Image from 'next/image';
import { Button, Card, SearchInput } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faPlus, faUser, faUserPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
// Read-only import: resolves avatar asset ids to real thumbnail URLs, the same
// way the content editor's asset fields do.
import { useMediaAssets, type MediaAsset } from './media';
import { authorName, useAuthorsList, type Author } from './authors-data';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'cms';

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** The author's photo, or a person glyph when there isn't one. */
function AuthorPhoto({ asset }: { asset: MediaAsset | undefined }) {
  return (
    <span className="border-base-300 bg-base-200 relative size-11 shrink-0 overflow-hidden rounded-full border">
      {asset?.url ? (
        <Image
          src={asset.url}
          alt=""
          fill
          sizes="44px"
          className="object-cover"
          // Unoptimized: cross-origin tenant media whose host is not on the image
          // optimizer's allow-list — a broken tile plus a console error is worse
          // than the browser scaling an already-small file. Same call the media
          // picker makes.
          unoptimized
        />
      ) : (
        <span className="flex h-full items-center justify-center">
          <Icon glyph={faUser} className="size-5" aria-hidden />
        </span>
      )}
    </span>
  );
}

function AuthorRow({
  author,
  asset,
  onOpen,
}: {
  author: Author;
  asset: MediaAsset | undefined;
  onOpen: (event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(event);
      }}
    >
      <td>
        <span className="flex min-w-0 items-center gap-3">
          <AuthorPhoto asset={asset} />
          {/* The name is the content of the row — everything else is a note about
              it, so nothing else gets to be the same size. */}
          <span className="max-w-72 truncate text-base font-medium">{authorName(author)}</span>
        </span>
      </td>
      <td className="hidden max-w-72 truncate font-mono text-sm @xl:table-cell">/{author.slug}</td>
    </tr>
  );
}

export function AuthorsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');

  // A masthead is a bounded set of people, so one generous window covers it and
  // the search runs in the browser. `take: 250` is the API's ceiling.
  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useAuthorsList({
    take: 250,
    skip: 0,
  });

  const authors = useMemo(() => data?.items ?? [], [data]);

  // Every avatar in ONE request, so the list shows real faces rather than ids.
  const avatarIds = useMemo(
    () =>
      authors
        .map((author) => author.avatar_asset_id)
        .filter((id): id is string => typeof id === 'string'),
    [authors]
  );
  const { data: assets } = useMediaAssets(avatarIds);
  const assetById = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    for (const asset of assets ?? []) map.set(asset.id, asset);
    return map;
  }, [assets]);

  const needle = search.trim().toLowerCase();
  const matches = useMemo(
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

  const open = (author: Author, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('cms.authors.detail', { id: author.id }, { target: targetFor(event) });
  };

  const create = (event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('cms.authors.detail', { id: 'new' }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      {/* Search, a count and the primary action fit one line; below @xl the count
          gives way first, since search is used constantly and the count is a
          glance. The bar does not wrap. */}
      <PaneToolbar
        label="Author list controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search authors"
              placeholder="Search by name…"
              value={search}
              onValueChange={setSearch}
            />
          </div>
        }
        status={
          <p className="hidden shrink-0 text-sm whitespace-nowrap @xl:block">
            {needle
              ? `${String(matches.length)} of ${String(authors.length)}`
              : authors.length === 1
                ? '1 author'
                : `${String(authors.length)} authors`}
          </p>
        }
        primaryAction={{
          label: 'New author',
          icon: faPlus,
          onClick: create,
          title: 'Add an author — hold Shift to open alongside, Alt for a new window',
        }}
        views={{
          target: '/cms/authors',
          params: { q: search },
          onApply: (next) => {
            setSearch(next.q ?? '');
          },
        }}
        refresh={
          /* ALWAYS the last child of a list toolbar — see RefreshButton. */
          <RefreshButton
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {/* A failed load REPLACES the list — "no authors yet" over a connection
            failure is a lie about their work, and the worst one to tell. It
            replaces the list and NOT the pane: the toolbar above still searches,
            still counts, and still adds an author. */}
        {isError ? (
          <PaneLoadError
            icon={<Icon glyph={faUser} className="size-6" aria-hidden />}
            title="Could not load your authors"
            description="This is a problem reaching the server. None of your authors have been lost."
            onRetry={() => {
              void refetch();
            }}
          />
        ) : isPending ? (
          <PaneWaiting />
        ) : matches.length === 0 ? (
          <ListEmptyState
            module={MODULE}
            filtered={Boolean(needle)}
            noResults={{
              icon: <Icon glyph={faUserPlus} className="size-6" aria-hidden />,
              title: 'No authors match that',
              description: 'Try part of the name, or clear the search to see everyone.',
            }}
            firstRun={{
              title: 'No authors yet',
              description:
                'Authors are the names that appear on what you publish — a photo and a short biography each. Add your first one and you can pick it on any post.',
              actions: (
                <Button
                  size="sm"
                  color="module"
                  onClick={() => {
                    create({ shiftKey: false, altKey: false });
                  }}
                >
                  <Icon glyph={faPlus} className="size-4" aria-hidden />
                  Add an author
                </Button>
              ),
            }}
          />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Author</th>
                <th className="hidden @xl:table-cell">Web address</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((author) => (
                <AuthorRow
                  key={author.id}
                  author={author}
                  asset={author.avatar_asset_id ? assetById.get(author.avatar_asset_id) : undefined}
                  onOpen={(event) => {
                    open(author, event);
                  }}
                />
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <p className="shrink-0 px-1 text-xs">
        Click an author to edit · Shift-click to open alongside · Alt-click for a new window
      </p>
    </div>
  );
}
