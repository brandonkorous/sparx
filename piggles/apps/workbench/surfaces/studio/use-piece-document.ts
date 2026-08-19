'use client';

// Opening ONE saved piece into the shared session.
//
// The session already holds every piece — the provider loads the whole library so
// page canvases can draw instances. So this does not fetch: it asks the session for
// the master and opens it as an editable document. The two are the SAME object, so
// an edit here repaints every instance in every open page pane as it is typed, with
// nothing in between.

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ComponentDoc, DocumentStore, StudioSession } from '@wizeworks/studio';
import { useStudioBinding } from '../../lib/studio/provider';
import { useSavePiece } from '../../lib/studio/piece-data';
import { pieceKeyOf } from '../../lib/studio/saved-pieces';

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

/** Subscribing to a session that is not up yet: nothing to hear, nothing to undo. */
const NO_SESSION = () => () => undefined;
const NO_VERSION = () => 0;

/** The session's resolution counter, tolerating a session that is not up yet. */
function useSessionResolution(session: StudioSession | null): number {
  return useSyncExternalStore(
    session?.subscribeResolution ?? NO_SESSION,
    session?.getResolutionVersion ?? NO_VERSION,
    session?.getResolutionVersion ?? NO_VERSION
  );
}

/** The one store this piece lives in, however many panes are looking at it. */
function useOpenPiece(symbolId: string | null) {
  const { session } = useStudioBinding();
  const [store, setStore] = useState<DocumentStore<ComponentDoc> | null>(null);
  const [missing, setMissing] = useState(false);

  // Subscribed, not sampled. The library arrives asynchronously, and a read taken
  // during render only updates when something else re-renders this hook — which is
  // how a piece saved a moment ago reported itself missing.
  const version = useSessionResolution(session);

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
    // `version` is the signal that the library has changed under us.
  }, [session, symbolId, version]);

  return { store, missing };
}

export function usePieceDocument(symbolId: string | null): PieceDocumentState {
  const savePiece = useSavePiece();
  const { store, missing } = useOpenPiece(symbolId);

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
