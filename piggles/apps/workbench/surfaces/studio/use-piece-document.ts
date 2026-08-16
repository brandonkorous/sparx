'use client';

// Opening ONE saved piece into the shared session.
//
// The session already holds every piece — the provider loads the whole library so
// page canvases can draw instances. So this does not fetch: it asks the session for
// the master and opens it as an editable document. The two are the SAME object, so
// an edit here repaints every instance in every open page pane as it is typed, with
// nothing in between.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentDoc, DocumentStore } from '@wizeworks/studio';
import { useStudioBinding } from '../../lib/studio/provider';
import { useSavePiece } from '../../lib/studio/piece-data';
import { pieceKeyOf } from '../builder/studio/saved-pieces';

export interface PieceDocumentState {
  store: DocumentStore<ComponentDoc> | null;
  loading: boolean;
  saving: boolean;
  /** True when the master is shared with every other site this business owns. */
  shared: boolean;
  error: string | null;
  /** The piece is not in the library — deleted, or from another site. */
  missing: boolean;
  save: () => Promise<void>;
}

export function usePieceDocument(symbolId: string | null): PieceDocumentState {
  const { session } = useStudioBinding();
  const savePiece = useSavePiece();
  const [store, setStore] = useState<DocumentStore<ComponentDoc> | null>(null);
  const [missing, setMissing] = useState(false);

  // The library arrives asynchronously, so this re-runs as it lands rather than
  // deciding "missing" from the first empty session.
  const snapshot = session?.getSnapshot();

  useEffect(() => {
    if (!session || !symbolId) {
      setStore(null);
      return;
    }
    const master = session.symbols()[symbolId];
    if (!master) {
      setStore(null);
      setMissing(Object.keys(session.symbols()).length > 0);
      return;
    }
    setMissing(false);
    // `open` returns the store already holding this piece when one exists, so two
    // panes on one master are one document.
    setStore(
      session.open<ComponentDoc>({
        kind: 'component',
        id: master.id,
        name: master.name,
        rev: 0,
        publishedAt: null,
        unpublished: false,
        propertyId: session.getSnapshot().context.propertyId,
        root: master.root,
      })
    );
    // `snapshot` is the signal that the library has changed under us.
  }, [session, symbolId, snapshot]);

  const save = useCallback(async () => {
    if (!store) return;
    const doc = store.current;
    await savePiece.mutateAsync({ id: doc.id, name: doc.name, root: doc.root });
    // A piece has no publish of its own: it goes live with whatever page or layout
    // carries it, on that document's own Publish. Saying otherwise would promise a
    // button that does not exist.
    store.markSaved(doc.rev + 1, null, false);
  }, [store, savePiece]);

  const error = useMemo(
    () => (savePiece.error instanceof Error ? savePiece.error.message : null),
    [savePiece.error]
  );

  return {
    store,
    loading: Boolean(symbolId) && !store && !missing,
    saving: savePiece.isPending,
    shared: pieceKeyOf(symbolId ?? '') !== null,
    error,
    missing,
    save,
  };
}
