'use client';

// Opening ONE theme into the shared session, and keeping the server in step.
//
// The pane does not hold the document — the session does, and it hands back the
// same store to anyone else who asks for the same theme. That is what makes an
// edit here repaint an open page pane with no round trip.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocumentStore, ThemeDoc } from '@wizeworks/studio';
import { useStudioBinding, useSyncSiteContext } from '../../lib/studio/provider';
import {
  usePublishTheme,
  useSaveTheme,
  useThemes,
  useThemeSelection,
  type ThemeRow,
} from '../../lib/studio/data';

/** A stored row as the engine's document. */
function toDoc(row: ThemeRow): ThemeDoc {
  return {
    kind: 'theme',
    id: row.id,
    name: row.name,
    rev: 0,
    publishedAt: row.publishedAt,
    unpublished: row.unpublished,
    origin: row.origin === 'marketplace' ? 'marketplace' : 'tenant',
    tenantId: null,
    marketplaceThemeId: row.marketplaceThemeId,
    marketplaceVersion: row.marketplaceVersion,
    theme: row.draft,
  };
}

export interface ThemeDocumentState {
  store: DocumentStore<ThemeDoc> | null;
  /** Which look this site currently wears, or null for the brand-derived one. */
  appliedId: string | null;
  loading: boolean;
  saving: boolean;
  publishing: boolean;
  save: () => Promise<void>;
  publish: () => Promise<void>;
}

/**
 * The theme document this pane edits — the one the site wears, or the one the
 * author picked from the library.
 */
export function useThemeDocument(selectedId: string | null): ThemeDocumentState {
  const { session } = useStudioBinding();
  const themes = useThemes();
  const selection = useThemeSelection();
  const saveTheme = useSaveTheme();
  const publishTheme = usePublishTheme();
  const [store, setStore] = useState<DocumentStore<ThemeDoc> | null>(null);

  const appliedId = selection.data?.themeId ?? null;
  const openId = selectedId ?? appliedId;

  // Tell the session which look the site wears, so every OTHER pane resolves
  // through it. Without this a page canvas would fall back to brand-derived while
  // the theme pane beside it showed something else.
  useSyncSiteContext({ themeId: appliedId });

  const row = useMemo(
    () => themes.data?.find((candidate) => candidate.id === openId) ?? null,
    [themes.data, openId]
  );

  useEffect(() => {
    if (!session || !row) {
      setStore(null);
      return;
    }
    // `open` hands back the store already holding this document when one exists,
    // so a second pane never replaces a draft the first has unsaved edits in.
    setStore(session.open(toDoc(row)));
  }, [session, row]);

  const save = useCallback(async () => {
    if (!store) return;
    const doc = store.current;
    const saved = await saveTheme.mutateAsync({ id: doc.id, name: doc.name, theme: doc.theme });
    store.markSaved(doc.rev + 1, saved.publishedAt, saved.unpublished);
  }, [store, saveTheme]);

  const publish = useCallback(async () => {
    if (!store) return;
    // Save first, always. Publishing a draft the server has not seen would put the
    // PREVIOUS version live and report success — the worst possible outcome for a
    // button whose whole promise is "this is what people will see".
    if (store.dirty) await save();
    const published = await publishTheme.mutateAsync(store.current.id);
    store.markPublished(published.publishedAt ?? new Date().toISOString());
  }, [store, publishTheme, save]);

  return {
    store,
    appliedId,
    loading: themes.isPending || selection.isPending,
    saving: saveTheme.isPending,
    publishing: publishTheme.isPending,
    save,
    publish,
  };
}
