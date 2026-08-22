'use client';

// One page's reads and writes.
//
// Every call here names a page. Nothing loads or saves "the site", which is what
// lets three page panes stay open at once without any two of them holding rival
// copies of the same draft.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import type { Node } from '@wizeworks/silicaui-html';
import { api } from '../api/client';

export const PAGES_KEY = ['studio', 'pages'] as const;
export const pageKey = (id: string) => ['studio', 'page', id] as const;

/** A page in the list — everything the picker shows, and no tree. */
export interface PageSummary {
  id: string;
  name: string;
  slug: string | null;
  kind: 'singleton' | 'collection';
  recordType: string | null;
  recordSubtype: string | null;
  isDefault: boolean;
  frameId: string | null;
  published: boolean;
  publishedAt: string | null;
  position: number;
}

/** One page, as the builder opens it. */
export interface PageRow extends Omit<PageSummary, 'published'> {
  seoTitle: string | null;
  seoDescription: string | null;
  canonical: string | null;
  ogImage: string | null;
  noindex: boolean;
  root: Node;
  /** False when the page has no saved body yet — this is an empty one to start from. */
  stored: boolean;
  unpublished: boolean;
}

/** Every page on this site. Seeds the starter set on a site that has none. */
export function usePages() {
  return useQuery({
    queryKey: PAGES_KEY,
    queryFn: () => api.get<{ pages: PageSummary[] }>('/v1/builder/pages').then((r) => r.pages),
    staleTime: 30_000,
  });
}

/**
 * One page's body and settings.
 *
 * Not refetched on focus, for the same reason the layout is not: the pane holds the
 * authoritative draft from the moment it opens, so a successful refetch changes
 * nothing and a failed one would take unsaved work with it.
 */
export function usePage(id: string | null) {
  return useQuery({
    queryKey: pageKey(id ?? 'none'),
    queryFn: () => api.get<PageRow>(`/v1/builder/pages/${encodeURIComponent(id!)}/silica`),
    enabled: Boolean(id),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // A 404 is an ANSWER — the page was deleted, or the id belongs to another
    // business — and it will be the same answer three times. Retrying it holds the
    // query in `pending`, which the pane renders as "Opening your page…", so the
    // one state that can explain itself never gets to. Everything else still
    // retries: a dropped connection is a fault and worth asking again.
    retry: (attempt, error) =>
      error instanceof ApiError && error.status === 404 ? false : attempt < 2,
  });
}

/** The settings that live on the row rather than in the tree. */
export interface PageSettingsPatch {
  name?: string;
  slug?: string | null;
  frameId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonical?: string | null;
  ogImage?: string | null;
  noindex?: boolean;
  recordSubtype?: string | null;
}

export interface PageSaveResult {
  written: boolean;
  reloadHints: string[];
}

/**
 * Save one page — its body and its settings, in that order.
 *
 * One call from the author's side, two from the server's, because they are two
 * different stores: the body is a tree, the settings are row columns. The body goes
 * first so a failure there stops before the settings claim a page state the tree
 * never reached.
 */
export function useSavePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; root: Node; settings: PageSettingsPatch }) => {
      const written = await api.put<PageSaveResult>(
        `/v1/builder/pages/${encodeURIComponent(input.id)}/silica`,
        { root: input.root }
      );
      await api.patch<unknown>(`/v1/builder/pages/${encodeURIComponent(input.id)}`, input.settings);
      return written;
    },
    onSuccess: (_result, input) => {
      // The LIST changes — a rename, a new address, a different header. The page's
      // own query is not invalidated: this pane is the authority on it, and pulling
      // the server copy back would either be a no-op or clobber a later edit.
      void queryClient.invalidateQueries({ queryKey: PAGES_KEY });
      void queryClient.invalidateQueries({ queryKey: ['builder', 'publish-state'] });
      void queryClient.invalidateQueries({ queryKey: ['builder', 'silica-site'] });
      void queryClient.invalidateQueries({ queryKey: pageKey(input.id), refetchType: 'none' });
    },
  });
}

export interface PagePublishResult {
  pageId: string;
  publishedAt: string;
  release: { id: string; hash: string };
}

/** Put one page live, leaving every other page's draft where it is. */
export function usePublishPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<PagePublishResult>(`/v1/builder/pages/${encodeURIComponent(id)}/silica/publish`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PAGES_KEY });
      void queryClient.invalidateQueries({ queryKey: ['builder', 'publish-state'] });
      void queryClient.invalidateQueries({ queryKey: ['builder', 'releases'] });
    },
  });
}

/** Add a page. It has no body until the first Save, which is what the builder opens
 *  it on — an empty page, rather than a starter somebody has to dismantle. */
export function useCreatePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; slug: string | null }) =>
      api.post<PageSummary>('/v1/builder/pages', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PAGES_KEY });
    },
  });
}

/** Remove a page — the half of the site check's advice ("give them an address, or
 *  delete them") that the console could not carry out. The page's own cache is
 *  REMOVED, so an open pane falls straight to its "isn't here any more" state. */
export function useDeletePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/v1/builder/pages/${encodeURIComponent(id)}`),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: pageKey(id) });
      void queryClient.invalidateQueries({ queryKey: PAGES_KEY });
      // The address is free again, so the check's finding and the site read are stale.
      void queryClient.invalidateQueries({ queryKey: ['builder', 'publish-state'] });
      void queryClient.invalidateQueries({ queryKey: ['builder', 'silica-site'] });
    },
  });
}
