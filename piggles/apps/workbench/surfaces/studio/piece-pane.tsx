'use client';

// One saved piece — a design made once and used everywhere.
//
// Open this beside a page that uses the piece and edit it: the page repaints as you
// type. Not a preview of what would happen — the same document, in two panes, which
// is what the whole per-document session is for.
//
// A piece has no Publish of its own. It goes live with whatever page or layout
// carries it, when THAT document is published. A Publish button here would promise
// something the storefront does not do.

import { useEffect } from 'react';
import { Badge, Button } from '@wizeworks/silicaui-react';
import { faFloppyDisk } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { DocumentProvider, TreeBuilder, useDocSnapshot } from '@wizeworks/studio/react';
import { PaneWaiting } from '../../components/pane-waiting';
import { useDirtySource } from '../../lib/workbench/dirty';
import { useStudioBinding } from '../../lib/studio/provider';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { OpenHistory, OpenPreview } from './open-history';
import { PiecesList } from './pieces-list';
import { usePieceDocument, type PieceDocumentState } from './use-piece-document';

export function PiecePaneSurface({ ctx }: { ctx: SurfaceContext }) {
  const { session } = useStudioBinding();
  const pieceId = typeof ctx.params.pieceId === 'string' ? ctx.params.pieceId : null;
  const state = usePieceDocument(pieceId);

  if (!pieceId) {
    return (
      <PiecesList
        onOpen={(id) => ctx.open('builder.piece', { pieceId: id }, { target: 'replace' })}
        onOpenBeside={(id) => ctx.open('builder.piece', { pieceId: id }, { target: 'beside' })}
      />
    );
  }

  if (state.missing) {
    return (
      <div className="bg-base-200 flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-base-content">
          This piece isn’t here any more. It may have been deleted.
        </p>
        <Button color="primary" variant="soft" onClick={() => ctx.open('builder.piece')}>
          Pick another piece
        </Button>
      </div>
    );
  }

  if (!session || state.loading || !state.store) {
    return <PaneWaiting label="Opening your saved piece…" />;
  }

  return (
    <DocumentProvider store={state.store}>
      <PiecePaneBody ctx={ctx} state={state} onTitle={(title) => ctx.setTitle(title)} />
    </DocumentProvider>
  );
}

function PiecePaneBody({
  ctx,
  state,
  onTitle,
}: {
  ctx: SurfaceContext;
  state: PieceDocumentState;
  onTitle: (title: string) => void;
}) {
  const { doc, dirty } = useDocSnapshot();

  useEffect(() => {
    onTitle(doc.name || 'Saved piece');
  }, [onTitle, doc.name]);

  useDirtySource(dirty, 'Your changes to this saved piece have not been saved.');

  return (
    <TreeBuilder
      toolbar={
        <>
          <OpenPreview ctx={ctx} />
          <OpenHistory ctx={ctx} />
          {/* Where the master lives is a real consequence, not a label: editing a
              shared piece changes it on every site this business owns. */}
          <Badge color={state.shared ? 'info' : 'primary'} variant="soft">
            {state.shared ? 'Used on all your sites' : 'This site only'}
          </Badge>
          <Button
            size="sm"
            color="primary"
            disabled={!dirty || state.saving}
            onClick={() => void state.save()}
          >
            <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
            {state.saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
      statusBar={<PieceStatus dirty={dirty} shared={state.shared} error={state.error} />}
    />
  );
}

function PieceStatus({
  dirty,
  shared,
  error,
}: {
  dirty: boolean;
  shared: boolean;
  error: string | null;
}) {
  if (error) return <span className="text-error">{error}</span>;
  if (dirty) return <span>Not saved yet</span>;
  return (
    <span>
      Saved. It goes live wherever it is used, when you publish that page
      {shared ? ' — on any of your sites.' : '.'}
    </span>
  );
}
