'use client';

// Every saved piece, and the way into each one.
//
// Read from the SESSION rather than from the two endpoints behind it, deliberately.
// The session is the merged map every canvas already draws instances through, so a
// piece listed here is a piece a page can resolve — a list built from its own reads
// could show one the canvas cannot find, which is the failure this builder keeps
// having to design out.

import { Badge, Button, useToast } from '@wizeworks/silicaui-react';
import { faColumns, faTrash } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useStudioBinding } from '../../lib/studio/provider';
import { useSessionSnapshot } from '@wizeworks/studio/react';
import { useConfirm } from '../../lib/confirm';
import { fetchPiecePlacements, useDeletePiece } from '../../lib/studio/piece-data';
import { pieceKeyOf } from '../builder/studio/saved-pieces';

interface PieceEntry {
  id: string;
  name: string;
  shared: boolean;
}

export function PiecesList({
  onOpen,
  onOpenBeside,
}: {
  onOpen: (pieceId: string) => void;
  onOpenBeside: (pieceId: string) => void;
}) {
  const { session } = useStudioBinding();
  // Subscribed, so the list appears as the library lands rather than staying empty
  // until something else happens to re-render this pane.
  useSessionSnapshot();

  const pieces: PieceEntry[] = Object.values(session?.symbols() ?? {})
    .map((symbol) => ({
      id: symbol.id,
      name: symbol.name,
      shared: pieceKeyOf(symbol.id) !== null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (pieces.length === 0) {
    return (
      <div className="bg-base-200 flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-base-content">You haven’t saved any pieces yet.</p>
        <p className="text-base-content text-sm">
          On a page, select something you’ll want again — a contact band, a set of opening hours —
          and save it as a piece. Change it once, and it changes everywhere you put it.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-base-200 flex h-full min-h-0 flex-col">
      <ul className="min-h-0 flex-1 overflow-auto p-3">
        {pieces.map((piece) => (
          <PieceRow key={piece.id} piece={piece} onOpen={onOpen} onOpenBeside={onOpenBeside} />
        ))}
      </ul>
    </div>
  );
}

function PieceRow({
  piece,
  onOpen,
  onOpenBeside,
}: {
  piece: PieceEntry;
  onOpen: (pieceId: string) => void;
  onOpenBeside: (pieceId: string) => void;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const deletePiece = useDeletePiece();

  /**
   * Delete, having first said what it costs.
   *
   * The placement count is fetched at the moment of asking, not held from the list:
   * "used on 4 pages" is the whole basis of the decision, and a number from when the
   * pane opened can be wrong by the time someone acts on it.
   */
  const remove = async () => {
    const placements = await fetchPiecePlacements(piece.id).catch(() => null);
    const where =
      placements === null
        ? 'We couldn’t check where this is used.'
        : placements.length === 0
          ? 'It isn’t used anywhere yet.'
          : `It’s used on ${placements.map((p) => p.label).join(', ')}.`;

    const ok = await confirm({
      title: `Delete “${piece.name}”?`,
      description: `${where} Those stay exactly as they look now — they just stop following this piece, so changing it later won’t change them.${
        piece.shared ? ' This piece is shared with your other sites.' : ''
      }`,
      confirmLabel: 'Delete piece',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    await deletePiece.mutateAsync(piece.id);
    toast.add({ title: `“${piece.name}” deleted`, type: 'success' });
  };

  return (
    <li className="bg-base-100 mb-2 flex items-center gap-2 rounded-lg pr-2 shadow-sm">
      <button
        type="button"
        onClick={() => onOpen(piece.id)}
        className="hover:bg-base-300 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-3 text-left"
      >
        <span className="text-base-content min-w-0 flex-1 truncate font-medium">{piece.name}</span>
        <Badge color={piece.shared ? 'info' : 'primary'} variant="soft">
          {piece.shared ? 'All your sites' : 'This site'}
        </Badge>
      </button>
      <Button
        size="sm"
        shape="square"
        aria-label={`Open ${piece.name} alongside`}
        title="Open alongside"
        onClick={() => onOpenBeside(piece.id)}
      >
        <Icon glyph={faColumns} className="size-4" aria-hidden />
      </Button>
      <Button
        size="sm"
        shape="square"
        color="danger"
        variant="soft"
        aria-label={`Delete ${piece.name}`}
        title="Delete"
        disabled={deletePiece.isPending}
        onClick={() => void remove()}
      >
        <Icon glyph={faTrash} className="size-4" aria-hidden />
      </Button>
    </li>
  );
}
