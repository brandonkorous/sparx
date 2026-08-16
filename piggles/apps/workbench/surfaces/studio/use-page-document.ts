'use client';

// Opening ONE page into the shared session.
//
// The page's settings — its address, which header wraps it, the words search
// engines show — live in the DOCUMENT, not in a side form. So changing the address
// is an edit like any other: it marks the pane unsaved, it undoes with ⌘Z, and it
// goes to the server on the same Save as the words on the page. A settings drawer
// with its own Save button is two saves wearing one pane.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocumentStore, PageDoc } from '@wizeworks/studio';
import { useStudioBinding } from '../../lib/studio/provider';
import {
  usePage,
  usePublishPage,
  useSavePage,
  type PageRow,
  type PageSettingsPatch,
} from '../../lib/studio/page-data';
import { useActiveSiteId } from '../../lib/api/shell-data';

/** A stored row as the engine's document. Exported so a restore can rebuild the
 *  document from the server and hand it to whatever pane is holding it. */
export function toPageDoc(row: PageRow, propertyId: string): PageDoc {
  return {
    kind: 'page',
    id: row.id,
    name: row.name,
    rev: 0,
    publishedAt: row.publishedAt,
    unpublished: row.unpublished,
    propertyId,
    slug: row.slug,
    pageKind: row.kind,
    recordType: row.recordType,
    recordSubtype: row.recordSubtype,
    isDefault: row.isDefault,
    frame: row.frameId,
    seo: {
      title: row.seoTitle,
      description: row.seoDescription,
      canonical: row.canonical,
      ogImage: row.ogImage,
      noindex: row.noindex,
    },
    root: row.root,
  };
}

/** The document's settings, back in the shape the row takes. */
function toSettings(doc: PageDoc): PageSettingsPatch {
  return {
    name: doc.name,
    slug: doc.slug,
    frameId: doc.frame,
    seoTitle: doc.seo.title,
    seoDescription: doc.seo.description,
    canonical: doc.seo.canonical,
    ogImage: doc.seo.ogImage,
    noindex: doc.seo.noindex,
    recordSubtype: doc.recordSubtype,
  };
}

/** The one store this page lives in, however many panes are looking at it. */
function useOpenPage(row: PageRow | null, propertyId: string | null) {
  const { session } = useStudioBinding();
  const [store, setStore] = useState<DocumentStore<PageDoc> | null>(null);

  useEffect(() => {
    if (!session || !row || !propertyId) {
      setStore(null);
      return;
    }
    setStore(session.open(toPageDoc(row, propertyId)));
  }, [session, row, propertyId]);

  return store;
}

interface PageWrites {
  saving: boolean;
  publishing: boolean;
  error: string | null;
  save: () => Promise<void>;
  publish: () => Promise<void>;
}

function usePageWrites(
  store: DocumentStore<PageDoc> | null,
  stored: boolean,
  onStored: () => void
): PageWrites {
  const savePage = useSavePage();
  const publishPage = usePublishPage();

  const save = useCallback(async () => {
    if (!store) return;
    const doc = store.current;
    await savePage.mutateAsync({ id: doc.id, root: doc.root, settings: toSettings(doc) });
    onStored();
    store.markSaved(doc.rev + 1, doc.publishedAt, true);
  }, [store, savePage, onStored]);

  const publish = useCallback(async () => {
    if (!store) return;
    // Save first, always: publishing a draft the server has not seen would put the
    // PREVIOUS page live and report success.
    if (store.dirty || !stored) await save();
    const published = await publishPage.mutateAsync(store.current.id);
    store.markPublished(published.publishedAt);
  }, [store, publishPage, save, stored]);

  const error = useMemo(() => {
    const failure = publishPage.error ?? savePage.error;
    return failure instanceof Error ? failure.message : null;
  }, [savePage.error, publishPage.error]);

  return { saving: savePage.isPending, publishing: publishPage.isPending, error, save, publish };
}

export interface PageDocumentState extends PageWrites {
  store: DocumentStore<PageDoc> | null;
  loading: boolean;
  /** False until this page has a saved body — what is on screen is an empty start. */
  stored: boolean;
  /** The page id could not be loaded — deleted, or from another site. */
  missing: boolean;
}

export function usePageDocument(pageId: string | null): PageDocumentState {
  const { data: siteState } = useActiveSiteId();
  const page = usePage(pageId);
  const [saved, setSaved] = useState(false);
  const onStored = useCallback(() => setSaved(true), []);

  // A different page in this pane is a different document: what was saved about the
  // last one says nothing about this one.
  useEffect(() => setSaved(false), [pageId]);

  const store = useOpenPage(page.data ?? null, siteState?.propertyId ?? null);
  const stored = saved || Boolean(page.data?.stored);
  const writes = usePageWrites(store, stored, onStored);

  return {
    ...writes,
    store,
    loading: Boolean(pageId) && page.isPending,
    stored,
    missing: Boolean(pageId) && page.isError,
  };
}
