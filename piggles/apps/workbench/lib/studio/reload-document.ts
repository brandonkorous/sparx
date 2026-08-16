'use client';

// Putting a restored document back in front of whoever is looking at it.
//
// A restore writes the SERVER's copy — which is the one moment in this builder where
// the server, not the pane, is the authority. Every other write flows the other way.
// So after a restore the open store has to be replaced rather than merged: the tree
// it is holding is precisely the one the author asked to be rid of, and leaving it
// there would put it straight back on the next Save.
//
// `reset` clears that document's undo stack too, and it should: the stack describes a
// lineage this document no longer has.

import type { DocumentRef, StudioSession } from '@wizeworks/studio';
import { api } from '../api/client';
import { toLayoutDoc, type LayoutRow } from './layout-data';
import { toPageDoc } from '../../surfaces/studio/use-page-document';
import type { PageRow } from './page-data';
import type { SiteSymbol } from './piece-data';
import type { EmailRow } from './email-data';
import { pieceKeyOf } from '../../surfaces/builder/studio/saved-pieces';

/** Fetch the document fresh and hand it to the open store, if a pane is holding one. */
export async function reloadDocument(session: StudioSession, ref: DocumentRef): Promise<void> {
  const store = session.store(ref);
  if (!store) return;
  const { propertyId } = session.getSnapshot().context;

  if (ref.kind === 'page') {
    const row = await api.get<PageRow>(`/v1/builder/pages/${encodeURIComponent(ref.id)}/silica`);
    store.reset(toPageDoc(row, propertyId));
    return;
  }

  if (ref.kind === 'layout') {
    const row = await api.get<LayoutRow>('/v1/builder/layouts/silica');
    store.reset(toLayoutDoc(row, propertyId));
    return;
  }

  if (ref.kind === 'email') {
    const row = await api.get<EmailRow>(`/v1/builder/emails/${encodeURIComponent(ref.id)}`);
    store.reset({
      kind: 'email',
      id: row.id,
      name: row.name,
      rev: 0,
      publishedAt: row.publishedAt,
      unpublished: row.hasUnpublishedChanges || !row.published,
      document: row.silicaDoc,
    });
    return;
  }

  if (ref.kind === 'component') {
    const master = await masterOf(ref.id);
    if (!master) return;
    store.reset({
      kind: 'component',
      id: ref.id,
      name: master.name,
      rev: 0,
      publishedAt: null,
      unpublished: false,
      propertyId,
      root: master.root,
    });
  }
}

/** One piece's master, from whichever of the two stores owns it — told apart by the
 *  `tenant:` prefix, the same way every other write here routes. */
async function masterOf(id: string): Promise<SiteSymbol | null> {
  const key = pieceKeyOf(id);
  if (!key) {
    const { symbols } = await api.get<{ symbols: Record<string, SiteSymbol> }>(
      '/v1/builder/site/symbols'
    );
    return symbols[id] ?? null;
  }

  // A library piece. Its id here is DERIVED from the key, so the row is found by key
  // rather than by id — and an open pane holds a document, not a query, which is why
  // invalidating the list is not enough on its own.
  const { components } = await api.get<{
    components: { key: string; name: string; root: SiteSymbol['root'] }[];
  }>('/v1/builder/components?include=silica');
  const found = components.find((piece) => piece.key === key);
  return found ? { id, name: found.name, root: found.root } : null;
}
