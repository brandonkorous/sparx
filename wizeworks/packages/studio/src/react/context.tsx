'use client';

// Bridging the engine to React.
//
// Two contexts, deliberately separate. The SESSION is site-wide and every pane
// sees the same one; the STORE is the single document THIS pane is editing. A
// pane that conflated them would re-render on every keystroke in every other
// pane, which is the cost the session's own snapshot check exists to avoid.
//
// Everything reads through `useSyncExternalStore`, so a store handed a new
// snapshot re-renders exactly the components that asked for the part that moved.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { StudioDoc } from '../documents/types';
import type { DocSnapshot, DocumentStore } from '../session/document-store';
import type { SessionSnapshot, StudioSession } from '../session/session';
import { findNode, type AddressableNode } from '../tree/walk';
import { isTreeDoc } from '../documents/types';
import type { StudioHost } from './host';

const SessionContext = createContext<StudioSession | null>(null);
const HostContext = createContext<StudioHost | null>(null);
const StoreContext = createContext<DocumentStore | null>(null);

export function StudioProvider({
  session,
  host,
  children,
}: {
  session: StudioSession;
  host: StudioHost;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={session}>
      <HostContext.Provider value={host}>{children}</HostContext.Provider>
    </SessionContext.Provider>
  );
}

/** Scopes a subtree to one open document. One per builder pane. */
export function DocumentProvider({
  store,
  children,
}: {
  store: DocumentStore;
  children: ReactNode;
}) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStudioSession(): StudioSession {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useStudioSession must be used inside <StudioProvider>');
  return session;
}

export function useStudioHost(): StudioHost {
  const host = useContext(HostContext);
  if (!host) throw new Error('useStudioHost must be used inside <StudioProvider>');
  return host;
}

/** Re-renders when the SET of dirty documents changes — never on a keystroke. */
export function useSessionSnapshot(): SessionSnapshot {
  const session = useStudioSession();
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
}

export function useDocumentStore<D extends StudioDoc = StudioDoc>(): DocumentStore<D> {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useDocumentStore must be used inside <DocumentProvider>');
  return store as DocumentStore<D>;
}

export function useDocSnapshot<D extends StudioDoc = StudioDoc>(): DocSnapshot<D> {
  const store = useDocumentStore<D>();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/** The document as it stands. Re-renders on every committed edit. */
export function useDoc<D extends StudioDoc = StudioDoc>(): D {
  return useDocSnapshot<D>().doc;
}

export function useSelection(): readonly string[] {
  return useDocSnapshot().selection;
}

/** The primary selected node, or undefined. */
export function useSelectedNode(): AddressableNode | undefined {
  const { doc, selection } = useDocSnapshot();
  const id = selection[0];
  return useMemo(() => {
    if (!id || !isTreeDoc(doc)) return undefined;
    return findNode(doc.root, id);
  }, [doc, id]);
}

export function useHistoryState(): { canUndo: boolean; canRedo: boolean } {
  const { canUndo, canRedo } = useDocSnapshot();
  return useMemo(() => ({ canUndo, canRedo }), [canUndo, canRedo]);
}

/** Whether this pane has work the server has not seen. */
export function useDirty(): boolean {
  return useDocSnapshot().dirty;
}

/**
 * Apply an edit to this pane's document.
 *
 * Handed back as a stable callback so a canvas can pass it to hundreds of nodes
 * without re-minting a handler per render.
 */
export function useApply(): (label: string, ops: Parameters<DocumentStore['apply']>[1]) => boolean {
  const store = useDocumentStore();
  return useCallback((label, ops) => store.apply(label, ops), [store]);
}

export function useSelect(): (ids: readonly string[]) => void {
  const store = useDocumentStore();
  return useCallback((ids) => store.select(ids), [store]);
}
