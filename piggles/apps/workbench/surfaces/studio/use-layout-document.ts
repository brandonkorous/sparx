'use client';

// Editing the site's chrome, and keeping the server in step.
//
// The chrome is OPENED by the provider, not here — every page pane needs it to draw
// its own canvas, and it must be there whether or not anyone opened this pane. So
// this hook asks the session for the document already in it and adds what only an
// editor needs: Save, Publish, and whether either has happened.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocumentStore, LayoutDoc } from '@wizeworks/studio';
import { useStudioBinding } from '../../lib/studio/provider';
import {
  toLayoutDoc,
  useLayout,
  usePublishLayout,
  useSaveLayout,
  type LayoutRow,
} from '../../lib/studio/layout-data';
import { useActivePropertyId } from '../../lib/api/shell-data';

/** The one store this layout lives in, however many panes are looking at it. */
function useOpenLayout(row: LayoutRow | null, propertyId: string | null) {
  const { session } = useStudioBinding();
  const [store, setStore] = useState<DocumentStore<LayoutDoc> | null>(null);

  useEffect(() => {
    if (!session || !row || !propertyId) {
      setStore(null);
      return;
    }
    // `open` hands back the store already holding this document when one exists, so a
    // page pane that opened the layout for its chrome and this pane share one draft.
    setStore(session.open(toLayoutDoc(row, propertyId)));
  }, [session, row, propertyId]);

  return store;
}

interface LayoutWrites {
  saving: boolean;
  publishing: boolean;
  error: string | null;
  save: () => Promise<void>;
  publish: () => Promise<void>;
}

/** Save and publish, in the order that keeps Publish honest. */
function useLayoutWrites(
  store: DocumentStore<LayoutDoc> | null,
  stored: boolean,
  onStored: () => void
): LayoutWrites {
  const saveLayout = useSaveLayout();
  const publishLayout = usePublishLayout();

  const save = useCallback(async () => {
    if (!store) return;
    const doc = store.current;
    await saveLayout.mutateAsync(doc.root);
    onStored();
    store.markSaved(doc.rev + 1, doc.publishedAt, true);
  }, [store, saveLayout, onStored]);

  const publish = useCallback(async () => {
    if (!store) return;
    // Save first, always. Publishing a draft the server has not seen would put the
    // PREVIOUS chrome live and report success — the worst outcome for a button whose
    // whole promise is "this is what people will see".
    if (store.dirty || !stored) await save();
    const published = await publishLayout.mutateAsync();
    store.markPublished(published.publishedAt);
  }, [store, publishLayout, save, stored]);

  const error = useMemo(() => {
    const failure = publishLayout.error ?? saveLayout.error;
    return failure instanceof Error ? failure.message : null;
  }, [saveLayout.error, publishLayout.error]);

  return {
    saving: saveLayout.isPending,
    publishing: publishLayout.isPending,
    error,
    save,
    publish,
  };
}

export interface LayoutDocumentState extends LayoutWrites {
  store: DocumentStore<LayoutDoc> | null;
  loading: boolean;
  /** False until the author's own chrome exists — what is on screen is the starter. */
  stored: boolean;
}

export function useLayoutDocument(): LayoutDocumentState {
  const propertyId = useActivePropertyId();
  const layout = useLayout();
  const [saved, setSaved] = useState(false);
  const onStored = useCallback(() => setSaved(true), []);

  const store = useOpenLayout(layout.data ?? null, propertyId);
  const writes = useLayoutWrites(store, saved || Boolean(layout.data?.stored), onStored);

  return {
    ...writes,
    store,
    loading: layout.isPending,
    stored: saved || Boolean(layout.data?.stored),
  };
}
