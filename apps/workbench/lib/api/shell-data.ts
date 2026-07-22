'use client';

// Data the chrome itself runs on — workspace, sites, favorites, feedback.
//
// Pane surfaces fetch their own data; this module is for the toolbar and rail,
// which exist before any pane does. Everything here rides the same token/client
// as the panes, so the chrome holds no second auth path.

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { api } from './client';
import { getTokenState } from './token';
import type { WorkbenchController } from '../workbench/controller';
import { saveLayout } from '../workbench/persistence';

/* ── Workspace + sites ──────────────────────────────────────────────────── */

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
}

export interface SiteInfo {
  id: string;
  name: string;
  slug: string;
  isPrimary: boolean;
}

export function useTenant() {
  return useQuery({
    queryKey: ['tenant'],
    queryFn: () => api.get<TenantInfo>('/v1/tenant'),
    staleTime: 300_000,
  });
}

export function useSites() {
  return useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get<SiteInfo[]>('/v1/properties'),
    staleTime: 300_000,
  });
}

/** The active property id, resolved once at boot from the token route (which
 *  reads the same cookie switchSite() writes). Also the layout's site key. */
export function useActiveSiteId() {
  return useQuery({
    queryKey: ['token-state'],
    queryFn: async () => {
      const state = await getTokenState();
      return { propertyId: state.propertyId };
    },
    staleTime: Infinity,
  });
}

/**
 * Who the operator IS — their user id and their role in this account.
 *
 * Same source as `useActiveSiteId` above (the token route, which is the only
 * place the browser learns anything about its own session), and cached under a
 * key of its own so the two questions don't have to be asked together.
 *
 * A surface needs this to mirror the server's team rules rather than discover
 * them: api-rest refuses to let anyone change their own role or remove
 * themselves, so an interface that shows those controls is an interface that
 * hands out errors. Reading the viewer lets it simply not offer them.
 *
 * `staleTime: Infinity` because neither value changes without a sign-out or a
 * site switch, both of which reload the window.
 */
export function useViewer() {
  return useQuery({
    queryKey: ['token-state', 'viewer'],
    queryFn: async () => {
      const state = await getTokenState();
      return { userId: state.userId, role: state.role };
    },
    staleTime: Infinity,
  });
}

/** One module's activation state, from GET /v1/tenant/modules. The response
 *  carries more (source/includedBy/requiredBy); the chrome only gates. */
export interface ModuleState {
  slug: string;
  enabled: boolean;
  /**
   * Whether THIS VIEWER may open the module — a different question from
   * `enabled`, which is about the account. A bookkeeper on a tenant running
   * eleven modules has all eleven `enabled` and one `reachable`.
   *
   * Optional because the field is additive on a shared endpoint (the dashboard
   * reads the same route) and because it is absent from the PUT/PATCH
   * responses, which answer "what is configured now?" rather than "what may you
   * personally open?". Treat absent as unrestricted — see `useVisibleNav`.
   */
  reachable?: boolean;
}

/** Which modules this tenant has turned on — drives the rail and the pulse.
 *  Modules are feature flags, never plan tiers; a disabled module simply is
 *  not part of this tenant's product. */
export function useModuleStates() {
  return useQuery({
    queryKey: ['tenant', 'modules'],
    queryFn: () => api.get<ModuleState[]>('/v1/tenant/modules'),
    staleTime: 300_000,
  });
}

/** Same cookie the dashboard uses; the token route reads it server-side. */
const ACTIVE_PROPERTY_COOKIE = 'sparx_active_property';

/**
 * Switches the active site — the per-site-workspaces model.
 *
 * Sites are workspaces (an entity pane belongs to exactly one site), so a
 * switch is a full context change: save this site's layout where it will be
 * found again, move the cookie, and reload. The reload is deliberate rather
 * than lazy — panes, drafts, queries, and popouts all assume one site per
 * window, and restarting the window is what makes that assumption safe
 * instead of subtle.
 *
 * The unsaved-work conversation belongs to the CALLER (it owns a styled
 * dialog in the right window); this function assumes consent and executes.
 */
export async function switchSite(
  controller: WorkbenchController,
  currentSiteKey: string,
  nextSiteId: string
): Promise<void> {
  // Flush the CURRENT arrangement under the current site before leaving —
  // the debounced auto-save may not have fired yet.
  const grid = controller.serializeGrid();
  if (grid) saveLayout(currentSiteKey, grid, controller.snapshotDescriptors());

  // Persist the active site SERVER-SIDE (httpOnly Set-Cookie) rather than with
  // document.cookie. A privacy-hardened browser can silently drop a JS cookie
  // write while still honoring server-set cookies (the session cookie proves it
  // does), and a dropped write left the switch half-applied — the page reloaded,
  // found no cookie, and fell back to the primary, so the switcher never moved.
  // api-rest still re-resolves the value under RLS and fails closed, so it stays
  // a preference, not a control. See app/api/active-site/route.ts.
  const persisted = await fetch('/api/active-site', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ siteId: nextSiteId }),
  })
    .then((response) => response.ok)
    .catch(() => false);

  // Belt-and-braces: if our own origin was unreachable, fall back to a client
  // write so a switch still has a chance rather than silently doing nothing. In
  // a browser that blocks JS cookies this no-ops — but then the server write
  // above already succeeded, so the fallback only runs where document.cookie works.
  if (!persisted) {
    document.cookie = `${ACTIVE_PROPERTY_COOKIE}=${nextSiteId}; path=/; max-age=31536000; SameSite=Lax`;
  }

  // This reload IS the switch — the server re-reads the cookie on boot. Tell the
  // controller the teardown is deliberate so the dock/stack `beforeunload` guard
  // stands down: with unsaved work open, the native prompt would otherwise cancel
  // the reload and leave the cookie moved but the window (and switcher) unchanged.
  controller.markIntentionalUnload();
  window.location.reload();
}

/* ── Favorites ──────────────────────────────────────────────────────────────
   Server-synced via /v1/me/favorites — the same spine the dashboard uses, with
   workbench surface keys as actionIds. Each app renders only the actionIds it
   recognizes, so the two vocabularies share the table without colliding. */

export interface FavoriteRow {
  actionId: string;
  position: number;
}

export function useFavorites() {
  return useQuery({
    queryKey: ['me', 'favorites'],
    queryFn: () => api.get<FavoriteRow[]>('/v1/me/favorites'),
    staleTime: 60_000,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, favorited }: { actionId: string; favorited: boolean }) =>
      favorited
        ? api.delete(`/v1/me/favorites/${encodeURIComponent(actionId)}`)
        : api.post('/v1/me/favorites', { actionId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me', 'favorites'] });
    },
  });
}

/* ── Recents ──────────────────────────────────────────────────────────────
   Server-synced via /v1/me/recents, the same spine as favorites and the same
   shared table the dashboard uses — with workbench surface keys as actionIds.
   The dashboard records a visit on every route change; the workbench has no
   routes, so a "visit" is an interactive controller.open() of a browsable
   surface (see RecentsRecorder + WorkbenchController.onVisit). */

export interface RecentRow {
  actionId: string;
  lastVisitedAt: string;
}

/** Most-recently-opened surfaces, newest first. `take` bounds the list the rail
 *  shows — the endpoint sorts by lastVisitedAt desc server-side. */
export function useRecents(take = 8) {
  return useQuery({
    queryKey: ['me', 'recents', take],
    queryFn: () => api.get<RecentRow[]>(`/v1/me/recents?take=${take}`),
    staleTime: 60_000,
  });
}

/** Records one visit (upsert + bump lastVisitedAt). Fired from RecentsRecorder,
 *  never called from a surface directly — a surface doesn't know it's being
 *  "visited", the controller does. */
export function useRecordVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (actionId: string) => api.post('/v1/me/recents', { actionId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me', 'recents'] });
    },
  });
}

/** Clears the whole recents list — the group's only management affordance,
 *  since individual recents are ephemeral by nature (they roll over). */
export function useClearRecents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/v1/me/recents'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me', 'recents'] });
    },
  });
}

/* Feedback moved to ./feedback.ts — it outgrew a section here once it gained
   history, threads, replies, and the pulse. */
