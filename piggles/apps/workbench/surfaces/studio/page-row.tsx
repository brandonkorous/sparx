'use client';

// One page in the list, and everything you can do to it from there.

import { Badge, Button } from '@wizeworks/silicaui-react';
import { faColumns, faTrash } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { IDENTITY_CELL } from '../../components/table';
import type { PageSummary } from '../../lib/studio/page-data';
import { addressOf, addressPeers, kindOf, statusOf } from './page-address';
import { rowOpenProps } from './row-open';
import { useRemovePage } from './use-remove-page';

export function PageRow({
  page,
  pages,
  onOpen,
  onOpenBeside,
}: {
  page: PageSummary;
  pages: readonly PageSummary[];
  onOpen: (pageId: string) => void;
  onOpenBeside: (pageId: string) => void;
}) {
  const { remove, removing } = useRemovePage(page, pages);

  return (
    <tr {...rowOpenProps(page.id, onOpen, onOpenBeside)}>
      <NameCell page={page} pages={pages} />
      <AddressCell page={page} />
      <td className="hidden @lg:table-cell">{kindOf(page)}</td>
      <StatusCell page={page} />
      <td className="w-0">
        <RowActions page={page} removing={removing} onRemove={remove} onOpenBeside={onOpenBeside} />
      </td>
    </tr>
  );
}

/**
 * The page's name — and, on a phone, its address and its status underneath it.
 *
 * Four columns need 498px and a phone pane is 323. The old answer was a horizontal
 * scrollbar, which is the worst one available here: it reads as the end of the table,
 * so the column this list exists for — whether visitors can see the page — was simply
 * gone at phone width, with nothing to say it was there.
 *
 * Nothing is dropped; the facts MOVE into one cell, the same two-line shape the
 * page-performance list already uses. `Live · standard design` cannot be shortened to
 * fit a 100px column and should not be: it is the sentence that stopped an owner
 * reading three of her live page types as missing (issue 270).
 *
 * The clash warning lives here at every width. It is a warning about the PAGE, it
 * reads correctly under the name, and it must never sit in a column that disappears.
 */
function NameCell({ page, pages }: { page: PageSummary; pages: readonly PageSummary[] }) {
  const peers = addressPeers(page, pages);
  const status = statusOf(page);
  return (
    <td>
      <span className={`block truncate font-medium ${IDENTITY_CELL}`}>{page.name}</span>
      <span className={`block truncate @md:hidden ${IDENTITY_CELL}`}>{addressOf(page)}</span>
      <div className="mt-1 flex flex-wrap items-center gap-1 @md:mt-0">
        <Badge color={status.tone} variant="soft" size="sm" className="@md:hidden">
          {status.label}
        </Badge>
        {peers.length > 0 ? (
          <Badge color="danger" variant="soft" size="sm">
            {peers.length === 1 ? `Also ${peers[0]}` : `Also ${String(peers.length)} others`}
          </Badge>
        ) : null}
      </div>
    </td>
  );
}

/** Whether visitors can see it — which for a record template is YES before it has
 *  ever been saved, because the standard design is already serving. */
function StatusCell({ page }: { page: PageSummary }) {
  const { label, tone } = statusOf(page);
  return (
    <td className="hidden @md:table-cell">
      <Badge color={tone} variant="soft">
        {label}
      </Badge>
    </td>
  );
}

/** Where a visitor lands. Its own column from `@md` up; below that it rides under the
 *  name in `NameCell`, which is the only place there is room for it. */
function AddressCell({ page }: { page: PageSummary }) {
  return (
    <td className={`hidden @md:table-cell ${IDENTITY_CELL}`}>
      <span className="block truncate">{addressOf(page)}</span>
    </td>
  );
}

/** Side by side is the reason this builder is per-document at all, so it stays a
 *  visible button rather than a modifier key to discover. */
function RowActions({
  page,
  removing,
  onRemove,
  onOpenBeside,
}: {
  page: PageSummary;
  removing: boolean;
  onRemove: () => Promise<void>;
  onOpenBeside: (pageId: string) => void;
}) {
  return (
    // The row itself is the open action, so each button stops the click travelling up.
    <div className="flex items-center justify-end gap-1">
      {/* Two panes side by side is a desktop idea. On a phone the button is a
          promise the screen cannot keep, and it costs the width the status needs. */}
      <Button
        size="sm"
        shape="square"
        className="hidden @md:inline-flex"
        aria-label={`Open ${page.name} alongside`}
        title="Open alongside"
        onClick={(event) => {
          event.stopPropagation();
          onOpenBeside(page.id);
        }}
      >
        <Icon glyph={faColumns} className="size-4" aria-hidden />
      </Button>
      <Button
        size="sm"
        shape="square"
        color="danger"
        variant="soft"
        aria-label={`Delete ${page.name}`}
        title="Delete"
        disabled={removing}
        onClick={(event) => {
          event.stopPropagation();
          void onRemove();
        }}
      >
        <Icon glyph={faTrash} className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
