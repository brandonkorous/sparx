'use client';

// Everything you've written — pages, posts, articles — published or not.
//
// A table, unlike the domains list, because content is genuinely tabular: each
// row has the same five facts (what it is, its kind, whether it's live, who
// wrote it, when it last changed) and people scan DOWN a column — "what's still
// a draft", "what did Sam write" — which is what a table is for.
//
// Filtering and paging are server-side. The list can run to hundreds of rows, so
// sorting or filtering the loaded window in the browser would answer "what's
// unpublished" with whatever happened to be on this page — a half-truth on the
// one question the list is opened to settle.

import { useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  SearchInput,
} from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faFileText, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  entryStatusState,
  entryTitle,
  formatDate,
  useAuthors,
  useContentEntries,
  useContentTypes,
  type ContentEntry,
  type EntryStatus,
} from './data';
import { RowOpenHint } from '../../components/row-open-hint';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'cms';

/** The chips ARE the questions people open this list to answer. */
const STATUS_FILTERS = [
  { value: 'all', label: 'All', status: undefined },
  { value: 'draft', label: 'Drafts', status: 'draft' },
  { value: 'published', label: 'Published', status: 'published' },
  { value: 'scheduled', label: 'Scheduled', status: 'scheduled' },
  { value: 'archived', label: 'Archived', status: 'archived' },
] as const satisfies readonly {
  value: string;
  label: string;
  status: EntryStatus | undefined;
}[];

type StatusFilterValue = (typeof STATUS_FILTERS)[number]['value'];

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function emptyAdvice(search: string, statusLabel: string | null, typeLabel: string | null): string {
  const parts: string[] = [];
  if (search) parts.push('Try part of the title or web address.');
  if (statusLabel) {
    parts.push(`You are only seeing “${statusLabel}” — switch to All to see the rest.`);
  }
  if (typeLabel) {
    parts.push(`Only “${typeLabel}” is showing — choose All kinds to widen it.`);
  }
  return parts.join(' ');
}

export function ContentListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const [typeKey, setTypeKey] = useState('');

  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);

  const activeStatus =
    STATUS_FILTERS.find((entry) => entry.value === statusFilter) ?? STATUS_FILTERS[0];
  const skip = (page - 1) * pageSize;
  const narrowed = statusFilter !== 'all' || typeKey !== '' || search.trim() !== '';

  const { data, isLoading, isFetching, dataUpdatedAt, error, refetch } = useContentEntries({
    q: search.trim(),
    ...(activeStatus.status ? { status: activeStatus.status } : {}),
    ...(typeKey ? { type: typeKey } : {}),
    take,
    skip,
  });

  // Types name the "Kind" column and populate the kind filter; authors name the
  // byline column. Both are small, long-cached lookups shared with the editor.
  const { data: types } = useContentTypes();
  const { data: authors } = useAuthors();

  const typeName = useMemo(() => {
    const map = new Map<string, string>();
    for (const type of types ?? []) map.set(type.key, type.name);
    return map;
  }, [types]);

  const authorName = useMemo(() => {
    const map = new Map<string, string>();
    for (const author of authors ?? []) map.set(author.id, author.display_name);
    return map;
  }, [authors]);

  const rows = data?.items ?? [];
  const total = data?.total;
  const staleAfterFailure = Boolean(error) && rows.length > 0;

  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const open = (entry: ContentEntry, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('cms.content.detail', { id: entry.id }, { target: targetFor(event) });
  };

  const create = (event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('cms.content.detail', { id: 'new' }, { target: targetFor(event) });
  };

  const activeTypeName = typeKey ? (typeName.get(typeKey) ?? typeKey) : null;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Content list controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search content"
              placeholder="Title or web address…"
              value={search}
              onValueChange={(next) => {
                setSearch(next);
                resetWindow();
              }}
            />
          </div>
        }
        primaryAction={{
          label: 'New',
          icon: faPlus,
          onClick: create,
          title: 'Write something new — hold Shift to open alongside, Alt for a new window',
        }}
        filters={[
          {
            label: 'Show',
            // The persisted name is the domain word, not the bar's question —
            // the platform's starter views are written as `{ status: 'draft' }`.
            key: 'status',
            value: statusFilter,
            neutralValue: 'all',
            options: STATUS_FILTERS.map((entry) => ({ value: entry.value, label: entry.label })),
            onValueChange: (next) => {
              setStatusFilter(next as StatusFilterValue);
              resetWindow();
            },
          },
          {
            label: 'Kind of content',
            key: 'type',
            value: typeKey,
            neutralValue: '',
            // A business can define any number of content types, so this is the
            // open-ended one — a select on the bar, never twenty chips.
            present: 'select',
            options: [
              { value: '', label: 'All kinds' },
              ...(types ?? []).map((type) => ({ value: type.key, label: type.name })),
            ],
            onValueChange: (next) => {
              setTypeKey(next);
              resetWindow();
            },
          },
        ]}
        views={{
          target: '/cms/content',
          params: { q: search },
          onApply: (next) => {
            setSearch(next.q ?? '');
            resetWindow();
          },
        }}
        refresh={
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
        {staleAfterFailure ? (
          <Alert color="warning" className="m-2">
            <AlertContent>
              <AlertTitle>Could not check for changes just now</AlertTitle>
              <AlertDescription>
                This is a problem reaching the server. What you see below is what loaded last, and
                may be out of date.
              </AlertDescription>
            </AlertContent>
            <Button
              size="sm"
              color="warning"
              variant="soft"
              onClick={() => {
                void refetch();
              }}
            >
              Try again
            </Button>
          </Alert>
        ) : null}

        {error && !staleAfterFailure ? (
          // A failed load REPLACES the table — "nothing written yet" over a
          // connection failure is a lie about their work, and the worst one to tell.
          <PaneLoadError
            icon={<Icon glyph={faFileText} className="size-6" aria-hidden />}
            title="Could not load your content"
            description="This is a problem reaching the server. Nothing you have written is affected — none of it has been lost."
            onRetry={() => {
              void refetch();
            }}
          />
        ) : isLoading ? (
          <PaneWaiting />
        ) : rows.length === 0 ? (
          <ListEmptyState
            module={MODULE}
            filtered={narrowed}
            noResults={{
              icon: <Icon glyph={faFileText} className="size-6" aria-hidden />,
              title: 'Nothing matches that',
              description: emptyAdvice(
                search.trim(),
                statusFilter === 'all' ? null : activeStatus.label,
                activeTypeName
              ),
            }}
            firstRun={{
              title: 'Nothing written yet',
              description:
                'This is where everything you publish lives — pages, posts, articles. Write your first one and it can be on your site within a minute.',
              actions: (
                <Button
                  size="sm"
                  color="module"
                  onClick={() => {
                    create({ shiftKey: false, altKey: false });
                  }}
                >
                  <Icon glyph={faPlus} className="size-4" aria-hidden />
                  Write something
                </Button>
              ),
            }}
          />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Title</th>
                <th className="hidden @xl:table-cell">Kind</th>
                <th className="hidden @2xl:table-cell">Author</th>
                <th className="hidden @4xl:table-cell">Changed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => {
                const state = entryStatusState(entry.status);
                const kind = typeName.get(entry.type_key) ?? entry.type_key;
                const author = entry.author_id ? (authorName.get(entry.author_id) ?? '—') : '—';
                return (
                  <tr
                    key={entry.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    onClick={(event) => {
                      open(entry, event);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      open(entry, event);
                    }}
                  >
                    <td>
                      <span className="block max-w-72 truncate font-medium">
                        {entryTitle(entry)}
                      </span>
                      {entry.slug ? (
                        <span className="block max-w-72 truncate font-mono text-sm">
                          /{entry.slug}
                        </span>
                      ) : null}
                    </td>
                    <td className="hidden max-w-40 truncate @xl:table-cell">{kind}</td>
                    <td className="hidden max-w-40 truncate @2xl:table-cell">{author}</td>
                    <td className="hidden text-sm whitespace-nowrap @4xl:table-cell">
                      {formatDate(entry.updated_at)}
                    </td>
                    <td>
                      <Badge color={state.tone} variant="soft" size="sm">
                        {state.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="shrink-0">
        <ListPagination
          shown={rows.length}
          firstRow={rows.length === 0 ? 0 : skip + 1}
          total={total}
          page={page}
          pageSize={pageSize}
          canLoadMore={take < MAX_TAKE}
          busy={isFetching}
          onLoadMore={() => {
            setTake((current) => Math.min(current + pageSize, MAX_TAKE));
          }}
          onPageChange={(next) => {
            setPage(next);
            setTake(pageSize);
          }}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
            setTake(size);
          }}
        />
        <RowOpenHint />
      </div>
    </div>
  );
}
