'use client';

// The layout document's reads and writes.
//
// One row in, one row out. The whole-site endpoint would answer the same question,
// but only by carrying every page body and the entire saved-piece library with it —
// so opening the layout builder would get slower every time the author added a page.

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import type { Node } from '@wizeworks/silicaui-html';
import type { LayoutDoc } from '@wizeworks/studio';
import { api } from '../api/client';

export const LAYOUT_KEY = ['studio', 'layout'] as const;

export interface LayoutRow {
  /** The same id `builder_pages.frame_id` points at. */
  layoutId: string;
  name: string;
  root: Node;
  /** False when this is the starter chrome rather than something the author saved. */
  stored: boolean;
  publishedAt: string | null;
  unpublished: boolean;
}

/** A stored row as the engine's document. Shared by the pane that EDITS the chrome
 *  and the provider that opens it so every page canvas can draw it. */
export function toLayoutDoc(row: LayoutRow, propertyId: string): LayoutDoc {
  return {
    kind: 'layout',
    id: row.layoutId,
    name: row.name,
    rev: 0,
    publishedAt: row.publishedAt,
    unpublished: row.unpublished,
    propertyId,
    root: row.root,
  };
}

/**
 * The site's chrome.
 *
 * Not refetched on focus. The pane holds the authoritative draft the moment it opens
 * it, so a successful refetch changes nothing and a failed one would throw away
 * unsaved work — a read whose best case is a no-op should not be on a hair trigger.
 */
export function useLayout() {
  return useQuery({
    queryKey: LAYOUT_KEY,
    queryFn: () => api.get<LayoutRow>('/v1/builder/layouts/silica'),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export interface LayoutSaveResult {
  written: boolean;
  reloadHints: string[];
}

/** Save the chrome alone. Explicit — nothing here autosaves. */
export function useSaveLayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (root: Node) => api.put<LayoutSaveResult>('/v1/builder/layouts/silica', { root }),
    onSuccess: () => {
      // The publish state changes with every save (the draft is now ahead of live),
      // and the site blob the old editor reads holds this same tree.
      void queryClient.invalidateQueries({ queryKey: ['builder', 'publish-state'] });
      void queryClient.invalidateQueries({ queryKey: ['builder', 'silica-site'] });
    },
  });
}

export interface LayoutPublishResult {
  layoutId: string;
  publishedAt: string;
  release: { id: string; hash: string };
}

/** Put the chrome live, leaving every page draft where it is. */
export function usePublishLayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<LayoutPublishResult>('/v1/builder/layouts/silica/publish'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['builder', 'publish-state'] });
      void queryClient.invalidateQueries({ queryKey: ['builder', 'releases'] });
    },
  });
}
