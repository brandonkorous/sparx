'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE BLUEPRINTS DATA LAYER
//
// A blueprint is a ready-made site design — a whole starter (pages, a matching
// look, and optionally content, products and email designs) that installs into
// ONE site as drafts you review before anything goes live. The gallery and the
// detail pane both read through here, so they can never disagree about a field
// one of them forgot to fetch, and installing from the detail refreshes the
// gallery's "Installed" badges docked beside it.
//
// api-rest is snake_case on the wire (see wizeworks/services/api-rest/src/routes/v1/
// blueprints/index.ts). We carry those names verbatim rather than re-mapping, so
// there is exactly one spelling of each field between the server and the screen.
//
// TWO DISTINCT server concepts, kept distinct here too:
//   • A BLUEPRINT is a catalog entry — the design itself (`/v1/blueprints`).
//     Its `install` field on the LIST is the state for the ACTIVE site only,
//     because a blueprint installs per-site.
//   • An INSTALL is the record of a blueprint stamped into one specific site
//     (`/v1/blueprints/installs`) — which carries the site id, so the detail
//     pane reads it to know the state for whichever site is chosen there.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** What a blueprint creates, as the catalog summarises it. Every field is
 *  optional and read defensively: the marketplace stores this as free-form JSON,
 *  so a design that adds no products simply omits the key rather than sending 0,
 *  and a field this build doesn't know is ignored rather than breaking. */
export interface BlueprintContents {
  products?: number;
  categories?: number;
  collections?: number;
  content?: number;
  pages?: number;
  emails?: number;
  /** What the design puts in the diary — a place, the people who work there, and
   *  the menu of what they do. All three are examples (issue 098). */
  schedulingLocations?: number;
  schedulingResources?: number;
  schedulingServices?: number;
  theme?: string;
  hasFrame?: boolean;
}

/** The lifecycle of one install row. `running` is mid-install, `installed` is
 *  drafts waiting to be published, `live` has been gone-live, `failed` stopped
 *  partway (and can be removed to clear it). */
export type InstallStatus = 'running' | 'installed' | 'live' | 'failed';

/** The active site's install state, as it rides on each catalog LIST row. */
export interface BlueprintInstallState {
  id: string;
  status: string;
  version: string;
  update_available: boolean;
}

/** One catalog entry. `install` is present only on the LIST (active-site state);
 *  the single-blueprint GET omits it, which is why it is optional. */
export interface Blueprint {
  key: string;
  name: string;
  summary: string;
  vertical: string | null;
  version: string;
  requiredModules: string[];
  preview?: string;
  contents: BlueprintContents;
  install?: BlueprintInstallState | null;
}

/** One install of a blueprint into one site — the per-site record the detail
 *  pane reads to know the state for a chosen site. */
export interface BlueprintInstall {
  id: string;
  property_id: string;
  blueprint_key: string;
  blueprint_version: string;
  status: string;
  /** Whether the design's examples came in with it. Read from the server rather
   *  than guessed from a zero count: an install that declined the examples and
   *  one that failed before writing them look identical from the counts alone. */
  sample_data: boolean;
  counts: Record<string, number>;
  installed_at: string;
  live_at: string | null;
}

/* ── The query-key tree ─────────────────────────────────────────────────── */

export interface BlueprintQuery {
  installedOnly: boolean;
  take: number;
  skip: number;
}

export const blueprintKeys = {
  all: ['builder', 'blueprints'] as const,
  lists: () => [...blueprintKeys.all, 'list'] as const,
  list: (query: BlueprintQuery) => [...blueprintKeys.lists(), query] as const,
  detail: (key: string) => [...blueprintKeys.all, 'detail', key] as const,
  installs: () => [...blueprintKeys.all, 'installs'] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

/** The catalog of ready-made designs. `installedOnly` maps to the server's
 *  `installed=true`, which restricts the list AND the total to what the active
 *  site has installed — a real server filter, not a browser slice of one page. */
export function useBlueprints(query: BlueprintQuery) {
  return useQuery({
    queryKey: blueprintKeys.list(query),
    queryFn: () =>
      api.list<Blueprint>('/v1/blueprints', {
        ...(query.installedOnly ? { installed: 'true' } : {}),
        take: query.take,
        skip: query.skip,
      }),
    // Keep the current page on screen while the next loads, so paging and the
    // filter don't blink the gallery out to an empty state and back.
    placeholderData: (previous) => previous,
  });
}

/** One blueprint's full summary — what the detail pane previews. */
export function useBlueprint(key: string) {
  return useQuery({
    queryKey: blueprintKeys.detail(key),
    queryFn: () => api.get<Blueprint>(`/v1/blueprints/${encodeURIComponent(key)}`),
    enabled: key !== '',
    // A 404 means the design was pulled from the catalog, not a broken server —
    // don't retry it into a generic failure.
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/** Every install this tenant has, across all its sites. The detail pane filters
 *  it down to the one site it is targeting. Kept short-lived because installing,
 *  publishing and removing all change it and the operator wants to see that. */
export function useBlueprintInstalls() {
  return useQuery({
    queryKey: blueprintKeys.installs(),
    queryFn: () =>
      api.get<{ installs: BlueprintInstall[] }>('/v1/blueprints/installs').then((r) => r.installs),
    staleTime: 30_000,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

/** The one way anything here says "that changed": refresh every catalog list
 *  (their per-site badges may have moved) and the installs list. */
export function useInvalidateBlueprints() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: blueprintKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: blueprintKeys.installs() });
  };
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

export interface InstallResult {
  install_id: string;
  sample_data: boolean;
  counts: Record<string, number>;
}

export interface InstallRequest {
  propertyId: string;
  /** Bring the design's example products, articles and diary with it. */
  sampleData: boolean;
}

/** Stamp a blueprint into a chosen site (as drafts). Passing `propertyId`
 *  explicitly means the operator can install onto a site other than the one they
 *  are currently working in — the server validates it belongs to the tenant.
 *  `sampleData` is the owner's answer about the examples, sent every time rather
 *  than only when it is false: the server records it on the install, and the
 *  answer is read again months later when a feature is switched on. */
export function useInstallBlueprint(key: string) {
  const invalidate = useInvalidateBlueprints();
  return useMutation({
    mutationFn: (input: InstallRequest) =>
      api.post<InstallResult>(`/v1/blueprints/${encodeURIComponent(key)}/install`, {
        property_id: input.propertyId,
        sample_data: input.sampleData,
      }),
    onSuccess: () => {
      invalidate();
    },
  });
}

/** Publish everything an install created — the drafts go live in one step. */
export function useGoLiveInstall() {
  const invalidate = useInvalidateBlueprints();
  return useMutation({
    mutationFn: (installId: string) =>
      api.post<{ id: string; status: string }>(`/v1/blueprints/installs/${installId}/go-live`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/** Remove a design — tears down everything it created in that site. Destructive;
 *  the surface gates it behind a confirm. */
export function useUninstallInstall() {
  const invalidate = useInvalidateBlueprints();
  return useMutation({
    mutationFn: (installId: string) =>
      api.delete<{ id: string; status: string }>(`/v1/blueprints/installs/${installId}`),
    onSuccess: () => {
      invalidate();
    },
  });
}
