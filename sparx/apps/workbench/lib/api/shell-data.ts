'use client';

// Data the chrome itself runs on — workspace, sites, favorites, feedback.
//
// Pane surfaces fetch their own data; this module is for the toolbar and rail,
// which exist before any pane does. Everything here rides the same token/client
// as the panes, so the chrome holds no second auth path.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
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
 * The site this window is operating under, as an id.
 *
 * THE COOKIE IS A PREFERENCE, AND MOST PEOPLE HAVE NEVER SET ONE. It is written
 * only by `switchSite()`, so an account with one site — or any operator who has
 * simply never opened the switcher — has no cookie at all, and `/api/token`
 * honestly reports `propertyId: null`. api-rest then scopes to the tenant's
 * PRIMARY site, so the primary's id is what that null actually MEANS. It is the
 * same rule the shell uses to key layouts, lifted out of `workbench-shell.tsx`
 * so a surface can ask the question without re-deriving it.
 *
 * Reading the raw token value instead is not a smaller version of this answer,
 * it is a wrong one, and it fails in the quietest possible way — a control that
 * needs a site id is simply DEAD for every account that has never touched the
 * switcher, with nothing on screen saying why. The new-campaign form shipped
 * exactly that: "Create it" disabled forever, no message, no way for a business
 * owner to work out that a switcher they had never opened was the reason.
 *
 * `/v1/properties` is already scoped to the sites this member may reach, so the
 * primary here is the primary they are allowed to see.
 *
 * Null only while those reads are in flight.
 */
export function useActivePropertyId(): string | null {
  const { data: tokenState } = useActiveSiteId();
  const { data: sites } = useSites();
  if (tokenState?.propertyId) return tokenState.propertyId;
  if (!sites) return null;
  return sites.find((site) => site.isPrimary)?.id ?? sites[0]?.id ?? null;
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

/**
 * The active site's slug — what every shareable address is stamped with.
 *
 * Slug rather than id because a link is written to be READ: `?site=savory-donuts`
 * says which business it belongs to and a uuid says nothing. Both are accepted on
 * the way back in, so a renamed slug degrades to an honest "that link is for a
 * different business" rather than to silence.
 *
 * Undefined while either query is in flight, which callers render as "no site on
 * the link yet" — the address is still correct, just less portable, and it
 * upgrades in place the moment the list lands.
 */
export function useActiveSiteSlug(): string | undefined {
  const { data: tokenState } = useActiveSiteId();
  const { data: sites } = useSites();
  if (!sites) return undefined;
  const activeId = tokenState?.propertyId;
  const site = activeId
    ? sites.find((candidate) => candidate.id === activeId)
    : sites.find((candidate) => candidate.isPrimary);
  return site?.slug;
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
  nextSiteId: string,
  options?: {
    /**
     * Land on THIS address instead of the workbench root.
     *
     * Exactly one caller passes it: arriving on a link that belongs to another
     * business. There the address is the whole point — the switch has to land
     * back on `/commerce/orders/…?site=…` so the arrival gate can open it now
     * that the workspace matches. Everyone else is switching away from a record
     * that belongs to the site being LEFT, and carrying its address across would
     * mean the new workspace opens with a pane pointing at another business's
     * data. Hence the default.
     *
     * An explicit address, NOT a `keepAddress` flag that reloaded the current
     * one. Those are not the same address by the time this runs: the history
     * bridge replaces the bar with the restored layout's focused pane within a
     * frame of boot, while the switch waits on the site list, so `reload()`
     * carried the ARRANGEMENT's address across instead of the link's. Under the
     * other business that address reads as a link back to the one just left, so
     * the tab switched again, and again — see DeepLink.href.
     */
    readonly address?: string;
  }
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
  // `replace`, not `assign`: the address being left names a record in the OTHER
  // business, and leaving it in history means Back walks into a pane that cannot
  // load. Replacing drops it. Replacing with the SAME address still reloads, so
  // the link case needs nothing special.
  window.location.replace(options?.address ?? '/');
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
    // HOUSEKEEPING, and the flag is load-bearing on two counts. Without it the
    // status bar read this ping as the operator saving something and announced
    // "Saved just now" the moment the app booted — an assertion about work
    // nobody had done, in the one place people look to check their work is safe.
    // And if it fails, that is not news to a person who never asked for it, so
    // the failed-write net stays quiet (it still reports). See
    // components/write-failure-reporter.tsx.
    meta: { housekeeping: true },
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
