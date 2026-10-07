'use client';

// Going live — what is waiting, what is worth looking at first, and the way back.
//
// Whole-site, deliberately. Every builder pane publishes its OWN document, which is
// the day-to-day act; this is the other one — "put everything I have been working on
// live", and "put it back how it was". Rollback in particular has to be whole-site:
// what is published is one connected thing, and a page restored to last week beside
// saved pieces from today is the breakage the release history exists to prevent.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../api/client';
// The report shape is CARRIED, not imported — the checker is a server package and
// this is a client module. Same arrangement as the saved-piece DTOs.
import type { SiteCheckReport } from './site-data';

export type { SiteCheckReport };

export const PUBLISH_STATE_KEY = ['builder', 'publish-state'];
export const RELEASES_KEY = ['builder', 'releases'];

/** What differs between the draft and what visitors are served. */
export interface PublishState {
  hasUnpublished: boolean;
  unpublishedPages: number;
  /** Which pages those are. Absent from an api-rest older than issue 939, which
   *  the pane reads as "not named" rather than as none. */
  unpublishedPageList?: { id: string; name: string; slug: string | null }[];
  frameUnpublished: boolean;
  lastPublishedAt: string | null;
  neverPublished: boolean;
  /** Capabilities the saved chrome has that the LIVE site does not — each with the
   *  sentence to show. Distinct from `frameUnpublished`, which only says something
   *  differs: the platform repairs stale chrome on the author's behalf, so that flag
   *  is routinely true of changes she did not make. */
  liveChromeGaps: { core: string; says: string; source: 'saved' | 'waiting' }[];
  /** Things the LIVE product pages physically cannot say. Same shape and same two
   *  sources as the chrome gaps above, for the same reason: a product page is stamped
   *  from the catalog once and the repair that updates a stale one lands on the DRAFT,
   *  so a shop can be unable to tell a customer something is sold out with nothing
   *  anywhere saying so. `pages` is how many live pages are missing it. */
  livePageGaps: { ref: string; says: string; source: 'saved' | 'waiting'; pages: number }[];
}

export function usePublishState() {
  return useQuery({
    queryKey: PUBLISH_STATE_KEY,
    queryFn: () => api.get<PublishState>('/v1/builder/site/publish-state'),
    staleTime: 10_000,
  });
}

/** One publish, newest first. `current` is what visitors are being served now. */
export interface Release {
  id: string;
  hash: string;
  pageCount: number;
  source: string;
  actorId: string | null;
  createdAt: string;
  current: boolean;
}

export function useReleases() {
  return useQuery({
    queryKey: RELEASES_KEY,
    queryFn: () => api.get<Release[]>('/v1/builder/site/releases'),
    staleTime: 15_000,
  });
}

/**
 * The pre-publish check, run on demand.
 *
 * ADVISORY, always — nothing here blocks a publish, and the pane says so. A check
 * that could stop someone shipping would be a check people learn to route around.
 */
export function useSiteCheck() {
  return useMutation({
    mutationFn: () => api.get<SiteCheckReport>('/v1/builder/site/check'),
  });
}

/**
 * What `POST /v1/builder/site/publish` actually returns.
 *
 * This used to declare `publishedAt` and a nested `release` too, and neither has
 * ever been on the wire — `api.post<T>()` is an unchecked cast, so TypeScript
 * cheerfully agreed and the toast rendered `String(undefined)`. Every field here
 * is one the route sends; if the route grows another, add it there first.
 */
export interface PublishResult {
  published: boolean;
  /** How many pages went live — the only part of this a person reads. */
  pages: number;
  releaseId: string;
  hash: string;
}

/** Put everything live at once. */
export function usePublishSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<PublishResult>('/v1/builder/site/publish'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PUBLISH_STATE_KEY });
      void queryClient.invalidateQueries({ queryKey: RELEASES_KEY });
      void queryClient.invalidateQueries({ queryKey: ['studio'] });
    },
  });
}

/**
 * Put the live site back to an earlier release.
 *
 * Append-only: the restore publishes that release's contents FORWARD as a new one,
 * so undoing an undo is just another restore and no history is ever lost.
 */
export function useRestoreRelease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (releaseId: string) =>
      api.post<unknown>(`/v1/builder/site/releases/${encodeURIComponent(releaseId)}/restore`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PUBLISH_STATE_KEY });
      void queryClient.invalidateQueries({ queryKey: RELEASES_KEY });
    },
  });
}

/**
 * Ask the platform to bring every saved page up to date.
 *
 * `useRepairLayout`'s sibling. The page repair runs whenever a page is OPENED, and
 * that is enough for an owner who is already editing. It is not enough for the owner
 * this exists for: a site has many pages, so "open the page and we will fix it" is not
 * an instruction anybody can follow when what is stale is a record template she has
 * never had a reason to look at.
 *
 * Draft only. It leaves her with something to publish, which is the next thing the
 * surface that calls this offers.
 *
 * No document reload afterwards, unlike the chrome repair: this does not touch the
 * pane she is looking at, and the page panes read their own tree when they open.
 */
export function useRepairPages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ repaired: number }>('/v1/builder/site/repair-pages', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PUBLISH_STATE_KEY });
      void queryClient.invalidateQueries({ queryKey: ['builder', 'silica-site'] });
      void queryClient.invalidateQueries({ queryKey: ['builder', 'pages'] });
    },
  });
}
