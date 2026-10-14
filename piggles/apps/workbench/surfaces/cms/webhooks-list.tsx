'use client';

// The notifications you send other software: where they go, what triggers them, and
// whether they are arriving. The whole set loads in one call, so filtering it in the
// browser filters the WHOLE set, honest in a way a server-paged window is not.

import { useMemo, useState } from 'react';
import { Card, SearchInput } from '@wizeworks/silicaui-react';
import { faPlus } from '@fortawesome/pro-solid-svg-icons';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { useWebhooks, type WebhookSubscription } from './webhooks-data';
import { WebhooksBody } from './webhooks-list-body';
import { RowOpenHint } from '../../components/row-open-hint';

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

function useWebhooksView() {
  const [search, setSearch] = useState('');
  const query = useWebhooks();
  const all = useMemo(() => query.data ?? [], [query.data]);
  const term = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      term === ''
        ? all
        : all.filter(
            (w) => w.name.toLowerCase().includes(term) || w.url.toLowerCase().includes(term)
          ),
    [all, term]
  );
  return { search, setSearch, query, all, term, rows };
}

interface WebhooksToolbarProps {
  search: string;
  onSearch: (next: string) => void;
  onCreate: (event: Modifiers) => void;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}

function WebhooksToolbar({ search, onSearch, onCreate, ...refresh }: WebhooksToolbarProps) {
  return (
    <PaneToolbar
      label="Tell other software controls"
      search={
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search notifications"
            placeholder="Name or address…"
            value={search}
            onValueChange={onSearch}
          />
        </div>
      }
      primaryAction={{
        label: 'Set one up',
        icon: faPlus,
        onClick: onCreate,
        title: 'Set up a new notification. Hold Shift to open alongside, Alt for a new window',
      }}
      views={{
        target: '/cms/webhooks',
        params: { q: search },
        onApply: (next) => {
          onSearch(next.q ?? '');
        },
      }}
      refresh={<RefreshButton {...refresh} />}
    />
  );
}

export function WebhooksListSurface({ ctx }: { ctx: SurfaceContext }) {
  const { search, setSearch, query, all, term, rows } = useWebhooksView();
  const { data, error } = query;
  const open = (webhook: WebhookSubscription, event: Modifiers) => {
    ctx.open('cms.webhooks.detail', { id: webhook.id }, { target: targetFor(event) });
  };
  const create = (event: Modifiers) => {
    ctx.open('cms.webhooks.detail', { id: 'new' }, { target: targetFor(event) });
  };
  const retry = () => {
    void query.refetch();
  };

  return (
    <div className={PANE_SHELL}>
      <WebhooksToolbar
        search={search}
        onSearch={setSearch}
        onCreate={create}
        isFetching={query.isFetching}
        updatedAt={data ? query.dataUpdatedAt : undefined}
        onRefresh={retry}
      />
      <Card className="min-h-0 flex-1 overflow-y-auto">
        <WebhooksBody
          error={error}
          isLoading={query.isLoading}
          staleAfterFailure={Boolean(error) && all.length > 0}
          rows={rows}
          filtered={term !== ''}
          onRetry={retry}
          onCreate={() => {
            create({ shiftKey: false, altKey: false });
          }}
          onOpen={open}
        />
      </Card>
      {rows.length > 0 ? <RowOpenHint /> : null}
    </div>
  );
}
