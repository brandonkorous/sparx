'use client';

// Old links: the old-address-to-new-address rules for this site. Search runs in the
// browser because the endpoint has no text query, which is only honest while the
// whole set is loaded: one window at the server's ceiling, and a note if a site passes it.

import { useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Card,
  Text,
} from '@wizeworks/silicaui-react';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { AddRedirectDialog } from './redirects-add-dialog';
import { useRedirects, type Redirect } from './redirects-data';
import { useFilteredRedirects, type TypeFilterValue } from './redirects-filter';
import { useRemoveRedirect } from './redirects-remove';
import { RedirectsToolbar } from './redirects-list-toolbar';
import { RedirectsBody } from './redirects-list-body';

/** The server's single-request ceiling, which a config table sits well within. */
const WINDOW = 250;

function OverWindowNote({ shown, total }: { shown: number; total: number | undefined }) {
  if (typeof total !== 'number' || total <= shown) return null;
  return (
    <Alert color="info">
      <AlertContent>
        <AlertTitle>Showing the first {shown} old links</AlertTitle>
        <AlertDescription>
          This site has {total} in total: more than this pane loads at once. Search and filter cover
          the ones shown here.
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

function countWords(shown: number, total: number): string {
  if (shown === total) return `${total} ${total === 1 ? 'old link' : 'old links'}`;
  return `${shown} of ${total} shown`;
}

// Beside, not on top of, the list: keeping the existing rules in view while pasting
// new ones is how someone avoids importing a duplicate.
function openImport(ctx: SurfaceContext, event: { altKey: boolean }) {
  ctx.open('cms.redirects.import', {}, { target: event.altKey ? 'window' : 'beside' });
}

// The add/edit dialog's state. `editing` undefined means adding a new rule: the same
// dialog, because the fields and the wording are the same question.
function useRedirectDialog(rows: readonly Redirect[]) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Redirect | undefined>(undefined);
  const onOpen = (row: Redirect) => {
    setEditing(row);
    setAdding(true);
  };
  // The way out of a duplicate refusal: the rule she collided with is the one she
  // wants, found in the rows already loaded so no spinner stands in her way.
  const onOpenExisting = (fromPath: string) => {
    const existing = rows.find((row) => row.from_path === fromPath);
    if (existing) setEditing(existing);
  };
  const onOpenChange = (next: boolean) => {
    setAdding(next);
    if (!next) setEditing(undefined);
  };
  const onAdd = () => {
    setAdding(true);
  };
  return { adding, editing, onAdd, onOpen, onOpenExisting, onOpenChange };
}

function useRedirectsView() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilterValue>('all');
  const query = useRedirects({ take: WINDOW, skip: 0 });
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const { filtered, narrowed } = useFilteredRedirects(rows, search, typeFilter);
  return { search, setSearch, typeFilter, setTypeFilter, query, rows, filtered, narrowed };
}

export function RedirectsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const remove = useRemoveRedirect();
  const { search, setSearch, typeFilter, setTypeFilter, query, rows, filtered, narrowed } =
    useRedirectsView();
  const { data, error } = query;
  const dialog = useRedirectDialog(rows);
  const retry = () => {
    void query.refetch();
  };

  return (
    <div className={PANE_SHELL}>
      <RedirectsToolbar
        search={search}
        onSearch={setSearch}
        typeFilter={typeFilter}
        onTypeFilter={setTypeFilter}
        onAdd={dialog.onAdd}
        onImport={(event) => {
          openImport(ctx, event);
        }}
        isFetching={query.isFetching}
        updatedAt={data ? query.dataUpdatedAt : undefined}
        onRefresh={retry}
      />
      <OverWindowNote shown={rows.length} total={data?.total} />
      <Card className="min-h-0 flex-1 overflow-y-auto">
        <RedirectsBody
          error={error}
          isLoading={query.isLoading}
          staleAfterFailure={Boolean(error) && rows.length > 0}
          filtered={filtered}
          narrowed={narrowed}
          remove={remove}
          onRetry={retry}
          onAdd={dialog.onAdd}
          onOpen={dialog.onOpen}
        />
      </Card>
      <Text className="shrink-0 px-1 text-sm">{countWords(filtered.length, rows.length)}</Text>
      <AddRedirectDialog
        open={dialog.adding}
        editing={dialog.editing}
        onOpenChange={dialog.onOpenChange}
        onOpenExisting={dialog.onOpenExisting}
      />
    </div>
  );
}
