'use client';

// Every page on the site, and the way into each one.
//
// This is what the old editor's page switcher used to be, moved out of the editor —
// because a pane that edits ONE page cannot also own the list of all of them
// without becoming the whole-site editor again. It is also the answer to "how do I
// get two pages side by side": open one, then open the next beside it.

import { useState } from 'react';
import { Badge, Button, Input } from '@wizeworks/silicaui-react';
import { faColumns, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneWaiting } from '../../components/pane-waiting';
import { useCreatePage, usePages, type PageSummary } from '../../lib/studio/page-data';

/** What a page's address reads as, including the ones that have none. */
function addressOf(page: PageSummary): string {
  if (page.kind === 'collection') return 'One page per record';
  return page.slug ?? 'No address yet';
}

export function PagesList({
  onOpen,
  onOpenBeside,
}: {
  onOpen: (pageId: string) => void;
  onOpenBeside: (pageId: string) => void;
}) {
  const pages = usePages();

  if (pages.isPending) return <PaneWaiting label="Finding your pages…" />;
  const rows = pages.data ?? [];

  return (
    <div className="bg-base-200 flex h-full min-h-0 flex-col">
      <AddPage onCreated={onOpen} />

      <ul className="min-h-0 flex-1 overflow-auto p-3">
        {rows.map((page) => (
          <PageRow key={page.id} page={page} onOpen={onOpen} onOpenBeside={onOpenBeside} />
        ))}
      </ul>

      {rows.length === 0 ? (
        <p className="text-base-content p-6 text-center">
          No pages yet. Name one above and start building.
        </p>
      ) : null}
    </div>
  );
}

/** Name it and you are in it. A new page has no body until the first Save, which
 *  is what the builder opens it on — an empty page rather than a starter to dismantle. */
function AddPage({ onCreated }: { onCreated: (pageId: string) => void }) {
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
    <div className="border-base-300 flex shrink-0 items-center gap-2 border-b p-3">
      <Input
        size="sm"
        value={name}
        placeholder="Name a new page — “Prices”, “About us”"
        onChange={(event) => setName(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void add();
        }}
      />
      <Button
        size="sm"
        color="primary"
        disabled={!name.trim() || createPage.isPending}
        onClick={() => void add()}
      >
        <Icon glyph={faPlus} className="size-4" aria-hidden />
        Add page
      </Button>
    </div>
  );
}

/** A page name as the address it suggests. Empty means no address — the page is
 *  reachable only by a link the author places. */
function slugify(name: string): string | null {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug ? `/${slug}` : null;
}

function PageRow({
  page,
  onOpen,
  onOpenBeside,
}: {
  page: PageSummary;
  onOpen: (pageId: string) => void;
  onOpenBeside: (pageId: string) => void;
}) {
  return (
    <li className="bg-base-100 mb-2 flex items-center gap-2 rounded-lg pr-2 shadow-sm">
      <button
        type="button"
        onClick={() => onOpen(page.id)}
        className="hover:bg-base-300 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="text-base-content block truncate font-medium">{page.name}</span>
          <span className="text-base-content block truncate text-sm">{addressOf(page)}</span>
        </span>
        <Badge color={page.published ? 'success' : 'warning'} variant="soft">
          {page.published ? 'Live' : 'Not live yet'}
        </Badge>
      </button>
      {/* Side by side is the reason this builder is per-document at all, so it is an
          action on the row rather than something to discover in a menu. */}
      <Button
        size="sm"
        shape="square"
        aria-label={`Open ${page.name} alongside`}
        title="Open alongside"
        onClick={() => onOpenBeside(page.id)}
      >
        <Icon glyph={faColumns} className="size-4" aria-hidden />
      </Button>
    </li>
  );
}
