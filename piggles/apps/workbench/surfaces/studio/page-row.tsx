'use client';

// One page in the list, and everything you can do to it from there.

import { Badge, Button } from '@wizeworks/silicaui-react';
import { faColumns, faTrash } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { PageSummary } from '../../lib/studio/page-data';
import { addressOf, addressPeers, kindOf } from './page-address';
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
      <td>
        <span className="block max-w-56 truncate font-medium">{page.name}</span>
      </td>
      <AddressCell page={page} pages={pages} />
      <td className="hidden @lg:table-cell">{kindOf(page)}</td>
      <td>
        <Badge color={page.published ? 'success' : 'warning'} variant="soft">
          {page.published ? 'Live' : 'Not live yet'}
        </Badge>
      </td>
      <td className="w-0">
        <RowActions page={page} removing={removing} onRemove={remove} onOpenBeside={onOpenBeside} />
      </td>
    </tr>
  );
}

/** The address, and the site check's finding about it — two pages cannot both
 *  answer to one address, and only one of them will. */
function AddressCell({ page, pages }: { page: PageSummary; pages: readonly PageSummary[] }) {
  const peers = addressPeers(page, pages);
  return (
    <td>
      <span className="block max-w-56 truncate">{addressOf(page)}</span>
      {peers.length > 0 ? (
        <Badge color="danger" variant="soft" size="sm" className="mt-1">
          {peers.length === 1 ? `Also ${peers[0]}` : `Also ${String(peers.length)} others`}
        </Badge>
      ) : null}
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
      <Button
        size="sm"
        shape="square"
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
