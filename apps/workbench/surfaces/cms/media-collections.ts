'use client';

// Media collections (docs/49) — the manual "boards" the picker groups assets into,
// on top of the automatic source groups. Read + mutate over /v1/media/collections.
// Kept beside the picker's media data (media.ts) since that is its only consumer.

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { api } from '../../lib/api/client';
import { mediaKeys } from './media';

export interface MediaCollection {
  id: string;
  name: string;
  itemCount: number;
}

interface CollectionWire {
  id: string;
  name: string;
  property_id: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
}

const collectionKeys = {
  all: [...mediaKeys.all, 'collections'] as const,
};

function toCollection(wire: CollectionWire): MediaCollection {
  return { id: wire.id, name: wire.name, itemCount: wire.item_count };
}

/** The tenant's collections for the active site (+ shared). Only fetched while the
 *  picker is open. */
export function useMediaCollections(enabled = true) {
  return useQuery({
    queryKey: collectionKeys.all,
    queryFn: async () => {
      const rows = await api.get<CollectionWire[]>('/v1/media/collections');
      return rows.map(toCollection);
    },
    enabled,
  });
}

/** Invalidate both the collection list AND every library view — a membership change
 *  moves an asset in or out of a collection-filtered grid, and the counts shift. */
function useRefreshCollections() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: collectionKeys.all });
    void qc.invalidateQueries({ queryKey: [...mediaKeys.all, 'library'] });
  };
}

export function useCreateCollection() {
  const refresh = useRefreshCollections();
  return useMutation({
    mutationFn: (name: string) =>
      api.post<CollectionWire>('/v1/media/collections', { name }).then(toCollection),
    onSuccess: refresh,
  });
}

export function useRenameCollection() {
  const refresh = useRefreshCollections();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch<CollectionWire>(`/v1/media/collections/${id}`, { name }).then(toCollection),
    onSuccess: refresh,
  });
}

export function useDeleteCollection() {
  const refresh = useRefreshCollections();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/media/collections/${id}`),
    onSuccess: refresh,
  });
}

export function useAddToCollection() {
  const refresh = useRefreshCollections();
  return useMutation({
    mutationFn: ({ collectionId, assetIds }: { collectionId: string; assetIds: string[] }) =>
      api.post<{ added: number }>(`/v1/media/collections/${collectionId}/assets`, {
        asset_ids: assetIds,
      }),
    onSuccess: refresh,
  });
}

export function useRemoveFromCollection() {
  const refresh = useRefreshCollections();
  return useMutation({
    mutationFn: ({ collectionId, assetId }: { collectionId: string; assetId: string }) =>
      api.delete(`/v1/media/collections/${collectionId}/assets/${assetId}`),
    onSuccess: refresh,
  });
}
