'use client';

// Redirects — the old-link-to-new-link rules for this site.
//
// SEARCH IS CLIENT-SIDE, unlike the content list, because the redirects endpoint
// offers no text query. That is only honest while the whole set is loaded, so
// this pane pulls one generous window (the server's 250 ceiling) rather than
// paging — a redirect table is a bounded configuration set, not a feed — and
// says so plainly if a site somehow runs past it.

import { useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  SearchInput,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { faPlus, faUpRight, faUpload } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { AddRedirectDialog } from './redirects-add-dialog';
import { RedirectsTable } from './redirects-table';
import {
  redirectErrorMessage,
  useDeleteRedirect,
  useRedirects,
  type Redirect,
  type RedirectStatusCode,
} from './redirects-data';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'cms';

/** The server's single-request ceiling. A config table well within it. */
const WINDOW = 250;

/** "Permanent" folds 301+308, "Temporary" 302+307 — the same distinction the
 *  badge draws, so the filter matches what people see. */
const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'permanent', label: 'Permanent' },
  { value: 'temporary', label: 'Temporary' },
] as const;

type TypeFilterValue = (typeof TYPE_FILTERS)[number]['value'];

function isTemporary(code: RedirectStatusCode): boolean {
  return code === 302 || code === 307;
}

export function RedirectsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const confirm = useConfirm();
  const remove = useDeleteRedirect();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilterValue>('all');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { data, isLoading, isFetching, dataUpdatedAt, error, refetch } = useRedirects({
    take: WINDOW,
    skip: 0,
  });

  const rows = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total;
  const overWindow = typeof total === 'number' && total > rows.length;
  const staleAfterFailure = Boolean(error) && rows.length > 0;

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (typeFilter === 'temporary' && !isTemporary(row.status_code)) return false;
      if (typeFilter === 'permanent' && isTemporary(row.status_code)) return false;
      if (needle === '') return true;
      return (
        row.from_path.toLowerCase().includes(needle) || row.to_path.toLowerCase().includes(needle)
      );
    });
  }, [rows, search, typeFilter]);

  const narrowed = search.trim() !== '' || typeFilter !== 'all';

  const openImport = (event: { shiftKey: boolean; altKey: boolean }) => {
    // Beside, not on top of, the list: keeping the existing rules in view while
    // pasting new ones is how someone avoids importing a duplicate.
    ctx.open('cms.redirects.import', {}, { target: event.altKey ? 'window' : 'beside' });
  };

  const onDelete = (row: Redirect) => {
    void (async () => {
      const ok = await confirm({
        title: 'Remove this redirect?',
        description: `Anyone still using ${row.from_path} will hit a dead end again instead of being sent to ${row.to_path}. You can add it back later, but any search-engine standing it was passing on is lost.`,
        confirmLabel: 'Remove it',
        cancelLabel: 'Keep it',
        color: 'danger',
      });
      if (!ok) return;
      setRemovingId(row.id);
      remove.mutate(row.id, {
        onSuccess: () => {
          toast.add({ title: 'Redirect removed', type: 'success' });
        },
        onError: (err) => {
          toast.add({
            title: 'Could not remove that redirect',
            description: redirectErrorMessage(err, 'Nothing was changed.'),
            type: 'error',
          });
        },
        onSettled: () => {
          setRemovingId(null);
        },
      });
    })();
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Redirects list controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search redirects"
              placeholder="Old or new address…"
              value={search}
              onValueChange={setSearch}
            />
          </div>
        }
        primaryAction={{
          label: 'Add redirect',
          icon: faPlus,
          onClick: () => {
            setAdding(true);
          },
        }}
        filters={[
          {
            label: 'Show',
            key: 'type',
            value: typeFilter,
            neutralValue: 'all',
            options: TYPE_FILTERS.map((entry) => ({ value: entry.value, label: entry.label })),
            onValueChange: (next) => {
              setTypeFilter(next as TypeFilterValue);
            },
          },
        ]}
        actions={[
          {
            label: 'Bulk import',
            icon: faUpload,
            onClick: openImport,
            title: 'Import a list of redirects — hold Alt to open in a new window',
          },
        ]}
        views={{
          target: '/cms/redirects',
          params: { q: search },
          onApply: (next) => {
            setSearch(next.q ?? '');
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

      {overWindow ? (
        <Alert color="info" variant="soft">
          <AlertContent>
            <AlertTitle>Showing the first {rows.length} redirects</AlertTitle>
            <AlertDescription>
              This site has {total} in total — more than this pane loads at once. Search and filter
              cover the ones shown here.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {staleAfterFailure ? (
          <Alert color="warning" variant="soft" className="m-2">
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
          <PaneLoadError
            icon={<Icon glyph={faUpRight} className="size-6" aria-hidden />}
            title="Could not load your redirects"
            description="This is a problem reaching the server. None of your redirects have been lost — they are still sending visitors on as before."
            onRetry={() => {
              void refetch();
            }}
          />
        ) : isLoading ? (
          <PaneWaiting />
        ) : filtered.length === 0 ? (
          <ListEmptyState
            module={MODULE}
            filtered={narrowed}
            noResults={{
              icon: <Icon glyph={faUpRight} className="size-6" aria-hidden />,
              title: 'Nothing matches that',
              description:
                'No redirect matches what you searched or filtered for. Try part of an address, or switch the filter back to All.',
            }}
            firstRun={{
              title: 'No redirects yet',
              description:
                'When you move or rename a page, a redirect sends anyone using the old address to the new one instead of a dead end. Add your first one, or import a whole list at once.',
              actions: (
                <Button
                  size="sm"
                  color="module"
                  onClick={() => {
                    setAdding(true);
                  }}
                >
                  <Icon glyph={faPlus} className="size-4" aria-hidden />
                  Add a redirect
                </Button>
              ),
            }}
          />
        ) : (
          <RedirectsTable
            rows={filtered}
            onDelete={onDelete}
            removingId={removingId}
            busy={remove.isPending}
          />
        )}
      </Card>

      <Text className="shrink-0 px-1 text-sm">
        {filtered.length === rows.length
          ? `${rows.length} ${rows.length === 1 ? 'redirect' : 'redirects'}`
          : `${filtered.length} of ${rows.length} shown`}
      </Text>

      <AddRedirectDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}
