'use client';

// One document's history — its own saves, and its own moments of going live.
//
// FOUR sources behind one shape, because four kinds of document are stored four
// ways and a pane should not have to know which:
//
//   · a page, the chrome, and a piece THIS SITE owns — derived server-side from the
//     site-wide snapshots' manifests, read through one owner
//   · a piece SHARED with your other sites — its own version rows in the library
//   · an email — its own version rows
//   · a look — nothing yet, and this says so rather than showing an empty list
//
// The last one matters: an empty history and a history that was never kept render
// identically, and only one of them means "you have never changed this".

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import type { StudioDoc } from '@wizeworks/studio';
import { api } from '../api/client';
import { pieceKeyOf } from '../../surfaces/builder/studio/saved-pieces';

/** Which store a document's history comes out of. */
export type HistorySource =
  | { store: 'site'; ownerKind: 'page' | 'layout' | 'symbol'; ownerId: string }
  | { store: 'library'; key: string }
  | { store: 'email'; emailId: string }
  /** No history is kept for this document yet — `why` is shown to the author. */
  | { store: 'none'; why: string };

/** One point in a document's history, whichever store it came from. */
export interface HistoryEntry {
  /** What a restore is addressed by — a version row id, or a library version number. */
  id: string;
  /** `save` · `agent` · `restore` for a draft; `publish` · `restore` for a release. */
  source: string;
  actorId: string | null;
  createdAt: string;
  /** The newest entry — what the document is right now. */
  current: boolean;
}

export interface DocumentHistory {
  drafts: HistoryEntry[];
  /** When this document last changed for visitors. Read-only — see the pane. */
  releases: HistoryEntry[];
}

/**
 * Where this document's history lives.
 *
 * A look is the one gap, and it is a real one rather than an oversight: a look is
 * now its own tenant-wide record, and the site snapshots that back the history above
 * still describe the site's old theme column — so a list built from them would be a
 * list of somebody else's changes.
 */
export function historySourceOf(doc: StudioDoc): HistorySource {
  if (doc.kind === 'page') return { store: 'site', ownerKind: 'page', ownerId: doc.id };
  if (doc.kind === 'layout') return { store: 'site', ownerKind: 'layout', ownerId: doc.id };
  if (doc.kind === 'email') return { store: 'email', emailId: doc.id };
  if (doc.kind === 'component') {
    const key = pieceKeyOf(doc.id);
    return key ? { store: 'library', key } : { store: 'site', ownerKind: 'symbol', ownerId: doc.id };
  }
  return {
    store: 'none',
    why: 'Changes to a look aren’t kept as history yet. Duplicate one before a big change and you can always go back to the copy.',
  };
}

export function historyKey(source: HistorySource) {
  if (source.store === 'site') return ['studio', 'history', source.ownerKind, source.ownerId];
  if (source.store === 'library') return ['studio', 'history', 'library', source.key];
  if (source.store === 'email') return ['studio', 'history', 'email', source.emailId];
  return ['studio', 'history', 'none'];
}

/** A library version as `/v1/builder/components/:key/versions` returns it. */
interface LibraryVersion {
  version: number;
  createdAt: string;
}

/** An email version as `/v1/builder/emails/:id/versions` returns it. */
interface EmailVersion {
  id: string;
  actorId: string | null;
  createdAt: string;
  current: boolean;
}

async function fetchHistory(source: HistorySource): Promise<DocumentHistory> {
  if (source.store === 'site') {
    return api.get<DocumentHistory>(
      `/v1/builder/history/${source.ownerKind}/${encodeURIComponent(source.ownerId)}`
    );
  }

  if (source.store === 'library') {
    const { versions } = await api.get<{ versions: LibraryVersion[] }>(
      `/v1/builder/components/${encodeURIComponent(source.key)}/versions`
    );
    // A library piece has no separate published state — it is live wherever it is
    // placed, on that page's own Publish. So there is one ladder, not two.
    return {
      drafts: versions.map((v, index) => ({
        id: String(v.version),
        source: 'save',
        actorId: null,
        createdAt: v.createdAt,
        current: index === 0,
      })),
      releases: [],
    };
  }

  if (source.store === 'email') {
    const { versions } = await api.get<{ versions: EmailVersion[] }>(
      `/v1/builder/emails/${encodeURIComponent(source.emailId)}/versions`
    );
    // An email's versions ARE its publishes — one is sealed each time it goes out.
    return {
      drafts: [],
      releases: versions.map((v) => ({
        id: v.id,
        source: 'publish',
        actorId: v.actorId,
        createdAt: v.createdAt,
        current: v.current,
      })),
    };
  }

  return { drafts: [], releases: [] };
}

export function useDocumentHistory(source: HistorySource) {
  return useQuery({
    queryKey: historyKey(source),
    queryFn: () => fetchHistory(source),
    enabled: source.store !== 'none',
    staleTime: 15_000,
  });
}

/**
 * Put this document back to an earlier version.
 *
 * Every store's restore is APPEND-ONLY — it writes the old content forward as a new
 * version rather than rewinding — so restoring is itself undoable, and a history
 * never loses the state someone restored away from.
 */
export function useRestoreVersion(source: HistorySource) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => {
      if (source.store === 'site') {
        await api.post<unknown>(
          `/v1/builder/history/${source.ownerKind}/${encodeURIComponent(source.ownerId)}/restore`,
          { versionId: entryId }
        );
        return;
      }
      if (source.store === 'library') {
        const path = `/v1/builder/components/${encodeURIComponent(source.key)}`;
        const version = await api.get<{ silicaTree: unknown }>(`${path}/versions/${entryId}`);
        // Saving the old tree back is what mints the new version — there is no rewind
        // endpoint, and there should not be: a library piece is placed on pages that
        // are pinned to versions, and deleting one would strand them.
        await api.patch<unknown>(path, { silicaTree: version.silicaTree });
        return;
      }
      if (source.store === 'email') {
        await api.post<unknown>(
          `/v1/builder/emails/${encodeURIComponent(source.emailId)}/versions/${entryId}/restore`
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: historyKey(source) });
      // Every studio read, because a restore changes the document under whatever
      // panes are showing it.
      void queryClient.invalidateQueries({ queryKey: ['studio'] });
      void queryClient.invalidateQueries({ queryKey: ['builder'] });
    },
  });
}
