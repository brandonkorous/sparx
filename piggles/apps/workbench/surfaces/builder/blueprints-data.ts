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
// api-rest is snake_case on the wire (see services/api-rest/src/routes/v1/
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

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
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
function useInvalidateBlueprints() {
    const queryClient = useQueryClient();
    return () => {
        void queryClient.invalidateQueries({ queryKey: blueprintKeys.lists() });
        void queryClient.invalidateQueries({ queryKey: blueprintKeys.installs() });
    };
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

export interface InstallResult {
    install_id: string;
    counts: Record<string, number>;
}

/** Stamp a blueprint into a chosen site (as drafts). Passing `propertyId`
 *  explicitly means the operator can install onto a site other than the one they
 *  are currently working in — the server validates it belongs to the tenant. */
export function useInstallBlueprint(key: string) {
    const invalidate = useInvalidateBlueprints();
    return useMutation({
        mutationFn: (propertyId: string) =>
            api.post<InstallResult>(`/v1/blueprints/${encodeURIComponent(key)}/install`, {
                property_id: propertyId,
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

/* ── Updating an install to a newer blueprint version ───────────────────── */

/** The preview of what updating an install to the catalog's current version would
 *  change — a three-way merge summary. `new` are artifacts the new version adds
 *  (e.g. a page the design didn't have before), `updated` fast-forward cleanly,
 *  `conflicts` are things BOTH you and the design changed (kept on your side by
 *  default). `updatable` is false when there is nothing newer to apply. */
export interface UpdatePlanSummary {
    updated: number;
    conflicts: number;
    auto: number;
    new: number;
    removed: number;
}
export interface UpdatePlan {
    installId: string;
    blueprintKey: string;
    fromVersion: string;
    toVersion: string;
    updatable: boolean;
    summary: UpdatePlanSummary;
}
export interface UpdateResult {
    installId: string;
    fromVersion: string;
    toVersion: string;
    applied: number;
    conflicts: number;
}

/** Preview the update for one install (read-only — nothing is written). Enabled only
 *  when an update is actually available, so the pane doesn't fetch a plan for an
 *  up-to-date install. Not cached: the catalog can move, so a preview is always fresh. */
export function useUpdatePlan(installId: string, enabled: boolean) {
    return useQuery({
        queryKey: [...blueprintKeys.installs(), 'update-plan', installId],
        queryFn: () => api.get<UpdatePlan>(`/v1/blueprints/installs/${installId}/update`),
        enabled: enabled && installId !== '',
        staleTime: 0,
    });
}

/** Apply the update — the three-way merge onto the install, keeping every edit you
 *  made by default (conflicts resolve to YOUR value; docs/55 U1). A live install
 *  re-publishes; a draft install stays draft. This is how a site picks up new pages a
 *  design added in a later version (e.g. the bespoke product page) without a
 *  delete-and-reinstall that would drop what you built on top. */
export function useUpdateInstall() {
    const invalidate = useInvalidateBlueprints();
    return useMutation({
        mutationFn: (installId: string) =>
            api.post<UpdateResult>(`/v1/blueprints/installs/${installId}/update`, { take_theirs: [] }),
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

/* ── Saying what a state means ──────────────────────────────────────────── */

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** What an install's status means, in an owner's words, with the tone that
 *  carries its color on a `<Badge>`. */
export function installState(status: string): { label: string; tone: Tone; detail: string } {
    switch (status) {
        case 'live':
            return {
                label: 'Live',
                tone: 'success',
                detail: 'This design has been published — visitors see it on your site now.',
            };
        case 'installed':
            return {
                label: 'Added as drafts',
                tone: 'info',
                detail:
                    'Everything this design adds is on your site as drafts — only you can see it. Review it, then publish it when you are ready.',
            };
        case 'running':
            return {
                label: 'Setting up',
                tone: 'warning',
                detail: 'This design is still being added. Give it a moment, then refresh.',
            };
        case 'failed':
        default:
            return {
                label: 'Setup stopped',
                tone: 'error',
                detail:
                    'Something went wrong partway through adding this design. Remove it to clear what was started, then try again.',
            };
    }
}

/** The friendly name for a module slug, for the "what this needs" note. Falls
 *  back to a capitalised slug so an unknown module still reads as words. */
export function moduleLabel(slug: string): string {
    const names: Record<string, string> = {
        builder: 'Site',
        commerce: 'Store',
        cms: 'Content',
        email: 'Email',
        crm: 'Customers',
        b2b: 'Wholesale',
        invoicing: 'Invoicing',
        inventory: 'Inventory',
        scheduling: 'Scheduling',
        dropship: 'Dropshipping',
    };
    return names[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

/** A short "what it creates" line for a card: the two or three biggest things,
 *  in plain words. Empty designs (a bare starting point) say so rather than
 *  showing nothing. */
export function contentsSummary(contents: BlueprintContents): string {
    const parts = contentsLines(contents);
    if (parts.length === 0) return 'A clean starting point';
    return parts
        .slice(0, 3)
        .map((line) => line.text)
        .join(' · ');
}

/** Every non-empty "what it creates" count as a labelled line, largest concepts
 *  first (the whole page structure, then what fills it). */
export function contentsLines(contents: BlueprintContents): { key: string; text: string }[] {
    const out: { key: string; text: string }[] = [];
    const add = (key: keyof BlueprintContents, one: string, many: string) => {
        const value = contents[key];
        if (typeof value === 'number' && value > 0) {
            out.push({ key, text: `${String(value)} ${value === 1 ? one : many}` });
        }
    };
    add('pages', 'page', 'pages');
    add('products', 'product', 'products');
    add('categories', 'category', 'categories');
    add('collections', 'collection', 'collections');
    add('content', 'piece of content', 'pieces of content');
    add('emails', 'email design', 'email designs');
    return out;
}

/** The server's own sentence for a 4xx, shown verbatim: the blueprint routes
 *  explain the real problem ("This template is already installed…") far better
 *  than a status code can. A 5xx carries no such sentence, so it falls back to
 *  the caller's wording. */
export function blueprintErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return error.message;
    }
    return fallback;
}

/** Medium date, or an em dash for nothing. */
export function formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}
