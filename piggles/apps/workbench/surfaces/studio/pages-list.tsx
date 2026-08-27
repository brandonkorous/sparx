'use client';

// Every page on the site, and the way into each one.
//
// A TABLE, like every other list in the app: each page carries the same four facts
// and people scan DOWN one of them — "which of these is still not live", "what
// claims /about". It is also the answer to "how do I get two pages side by side".

import { useState, type ReactNode } from 'react';
import { Button, Card, EmptyState, Input, Text } from '@wizeworks/silicaui-react';
import { faFileLines, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Table } from '../../components/table';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { useCreatePage, usePages, type PageSummary } from '../../lib/studio/page-data';
import { slugify } from './page-address';
import { PageRow } from './page-row';

const GLYPH = <Icon glyph={faFileLines} className="size-6" aria-hidden />;

export function PagesList({
  onOpen,
  onOpenBeside,
}: {
  onOpen: (pageId: string) => void;
  onOpenBeside: (pageId: string) => void;
}) {
  const pages = usePages();
  const rows = pages.data ?? [];
  const retry = () => {
    void pages.refetch();
  };

  return (
    <div className={PANE_SHELL}>
      <AddPage
        onCreated={onOpen}
        refresh={
          <RefreshButton
            isFetching={pages.isFetching}
            updatedAt={pages.data ? pages.dataUpdatedAt : undefined}
            onRefresh={retry}
          />
        }
      />

      <Card className="min-h-0 flex-1 overflow-y-auto">
        <PagesBody
          state={pages.isError ? 'error' : pages.isPending ? 'loading' : 'ready'}
          rows={rows}
          onRetry={retry}
          onOpen={onOpen}
          onOpenBeside={onOpenBeside}
        />
      </Card>

      <Text className="hidden px-1 text-sm @lg:block">
        Click a page to open it · Shift-click to open it alongside
      </Text>
    </div>
  );
}

/** The four things this card can be: a failed load, a pending one, an empty
 *  library, or the table. */
function PagesBody({
  state,
  rows,
  onRetry,
  onOpen,
  onOpenBeside,
}: {
  state: 'error' | 'loading' | 'ready';
  rows: readonly PageSummary[];
  onRetry: () => void;
  onOpen: (pageId: string) => void;
  onOpenBeside: (pageId: string) => void;
}) {
  if (state === 'error') {
    return (
      <PaneLoadError
        icon={GLYPH}
        title="Could not load your pages"
        description="This is a problem reaching the server. None of your pages are affected — nothing has been lost."
        onRetry={onRetry}
      />
    );
  }
  if (state === 'loading') return <PaneWaiting label="Finding your pages…" />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={GLYPH}
        title="No pages yet"
        description="Name one above — “Prices”, “About us” — and it opens straight into the editor, empty and ready to build."
      />
    );
  }
  return <PagesTable rows={rows} onOpen={onOpen} onOpenBeside={onOpenBeside} />;
}

function PagesTable({
  rows,
  onOpen,
  onOpenBeside,
}: {
  rows: readonly PageSummary[];
  onOpen: (pageId: string) => void;
  onOpenBeside: (pageId: string) => void;
}) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Page</th>
          <th className="hidden @md:table-cell">Address</th>
          <th className="hidden @lg:table-cell">Kind</th>
          <th className="hidden @md:table-cell">Status</th>
          <th className="w-0">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((page) => (
          <PageRow
            key={page.id}
            page={page}
            pages={rows}
            onOpen={onOpen}
            onOpenBeside={onOpenBeside}
          />
        ))}
      </tbody>
    </Table>
  );
}

/** Name it and you are in it. A new page has no body until the first Save, which
 *  is what the builder opens it on — an empty page rather than a starter to dismantle. */
function AddPage({
  onCreated,
  refresh,
}: {
  onCreated: (pageId: string) => void;
  refresh: ReactNode;
}) {
  const createPage = useCreatePage();
  const [name, setName] = useState('');

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const created = await createPage.mutateAsync({ name: trimmed, slug: slugify(trimmed) });
    setName('');
    onCreated(created.id);
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="max-w-md min-w-0 flex-1">
        <Input
          size="sm"
          value={name}
          placeholder="Name a new page — “Prices”, “About us”"
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void add();
          }}
        />
      </div>
      <Button
        size="sm"
        color="primary"
        className="shrink-0 whitespace-nowrap"
        disabled={!name.trim() || createPage.isPending}
        onClick={() => void add()}
      >
        <Icon glyph={faPlus} className="size-4" aria-hidden />
        Add page
      </Button>
      <div className="ml-auto shrink-0">{refresh}</div>
    </div>
  );
}
