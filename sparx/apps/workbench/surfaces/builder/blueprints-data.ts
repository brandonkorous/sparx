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
import { apiErrorMessage } from '../../lib/api-error';
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
  /** Words to find in a design's name or description; '' for none. */
  q?: string;
  /** One kind of business ('retail', 'services', 'content', 'b2b'), or 'all'. */
  vertical?: string;
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
        ...(query.q ? { q: query.q } : {}),
        ...(query.vertical && query.vertical !== 'all' ? { vertical: query.vertical } : {}),
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
 *  answer is read again months later when a module is switched on. */
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
export function installState(
  status: string,
  /** Whether the public site is currently dark. A suspended account serves the
   *  "Temporarily unavailable" overlay instead of its pages, so nobody is
   *  looking at the design however published it is. */
  siteIsDark = false
): { label: string; tone: Tone; detail: string } {
  switch (status) {
    case 'live':
      return {
        label: 'Live',
        tone: 'success',
        detail: siteIsDark
          ? 'This design has been published. Your site is offline right now, so it goes up the moment your site is back.'
          : 'This design has been published: visitors see it on your site now.',
      };
    case 'installed':
      return {
        label: 'Added as drafts',
        tone: 'info',
        detail:
          'Everything this design adds is on your site as drafts. Only you can see it. Review it, then publish it when you are ready.',
      };
    case 'replaced':
      // None of its pages are left (persona issue 273): most often a design added
      // after it replaced them. It used to keep saying "Added as drafts" over
      // pages that were gone. The words say what is known, not a guessed cause.
      return {
        label: 'Pages gone',
        tone: 'warning',
        detail:
          'None of the pages this design added are on your site now. They go when another design is added to the site, or when they are deleted. To bring them back, remove this design and add it again. Removing it clears what else it left behind, and keeps the header, footer and look your site has now.',
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

/**
 * What this console calls a part of the platform.
 *
 * ONE table, in `lib/surfaces/nav.ts`. This file kept its own, and so did five
 * others; measured 2026-09-25, `commerce` alone had SIX names across the two
 * consoles — Sell (the Piggles rail), Selling, Online store, Online stores,
 * Store, and the raw slug — and a shop owner could meet four of them on four
 * screens. Same defect as one order reading four ways on four screens (issue
 * 260), one level up: the apps themselves.
 */
export { moduleLabel } from '../../lib/surfaces/nav';

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

export interface ContentsLine {
  key: string;
  text: string;
}

/** What the design brings, split the way the install itself splits it: the
 *  structure it always brings, and the examples that are a choice (issue 098). */
export interface ContentsGroups {
  structure: ContentsLine[];
  examples: ContentsLine[];
}

function counted(
  contents: BlueprintContents,
  keys: [keyof BlueprintContents, string, string][]
): ContentsLine[] {
  const out: ContentsLine[] = [];
  for (const [key, one, many] of keys) {
    const value = contents[key];
    if (typeof value === 'number' && value > 0) {
      out.push({ key, text: `${String(value)} ${value === 1 ? one : many}` });
    }
  }
  return out;
}

/** The two groups, largest concepts first inside each. The pages, the shelves and
 *  the email designs are the design; the stock on the shelves, the articles and
 *  the diary are somebody else's business, kept only if the owner asks for them. */
export function contentsGroups(contents: BlueprintContents): ContentsGroups {
  return {
    structure: counted(contents, [
      ['pages', 'page', 'pages'],
      ['categories', 'category', 'categories'],
      ['collections', 'collection', 'collections'],
      ['emails', 'email design', 'email designs'],
    ]),
    examples: counted(contents, [
      ['products', 'example product', 'example products'],
      ['content', 'example article', 'example articles'],
      ['schedulingServices', 'example service', 'example services'],
      ['schedulingResources', 'example team member', 'example team members'],
      ['schedulingLocations', 'example place', 'example places'],
    ]),
  };
}

/** Every non-empty "what it creates" count as a labelled line, structure first. */
export function contentsLines(contents: BlueprintContents): ContentsLine[] {
  const groups = contentsGroups(contents);
  return [...groups.structure, ...groups.examples];
}

/** What taking (or leaving) the examples actually does, for a confirm. */
export function examplesSentence(sampleData: boolean): string {
  return sampleData
    ? 'Its example products, articles and bookings come too, so there is something real on every screen to look at and change.'
    : 'Its examples are left out, so nothing arrives that is not yours. The pages and shelves come in empty, ready for your own.';
}

/* ── What adding a design DOES to the site it is pointed at ────────────────── */

/**
 * A design is a whole site, and adding one to a site that has pages REPLACES
 * them. This is the sentence that says so, sized to the chosen site.
 *
 * It exists because this pane promised the opposite in three places: "nothing
 * here replaces what you already have", and a confirm reading "Your existing
 * pages and products are left exactly as they are". The install path is
 * `siteService.installSite`, which syncs with `allowReplace: true`, and
 * `pagesToDelete` then returns every stored page absent from the incoming
 * roster. That is all of them, since an install mints fresh page ids. Adding a
 * design to a nine-page site left nine pages, all of them the design's.
 *
 * And it cannot be undone from here. A draft version restore brings back the
 * content of pages that still exist and never resurrects a deleted one, so the
 * sentence says that too rather than implying a recovery that is not there.
 *
 * What genuinely survives is everything that is not the site itself. The
 * installer only DELETES builder pages; products, articles, customers and
 * orders are added to, never removed. Saying so is the difference between a
 * warning somebody can act on and one that reads as "you may lose everything".
 */
export interface InstallImpact {
  /** True when pages will be destroyed, which is what makes this a danger. */
  readonly replaces: boolean;
  /** How many go. Null when nobody counted, never 0, which would mean "empty". */
  readonly pages: number | null;
  readonly sentence: string;
}

/** `pageCount` is the sites LIST's count (`Site.pageCount`). Undefined means it
 *  was not counted (the list has not landed, or a server predating the field),
 *  and the sentence then says what is true either way instead of guessing. */
export function installImpact(siteName: string, pageCount: number | undefined): InstallImpact {
  const kept =
    'Everything else stays as it is: your products, articles, customers and orders are not touched.';

  if (pageCount === 0) {
    return {
      replaces: false,
      pages: 0,
      sentence: `${siteName} has no pages yet, so this design gives it its first ones. They arrive as drafts only you can see, and nothing is live until you publish it.`,
    };
  }

  // Nobody counted. Say the thing that is true either way rather than guessing
  // at a number, and never the reassuring half.
  if (pageCount === undefined) {
    return {
      replaces: true,
      pages: null,
      sentence: `A design is a whole site, not a set of pages added to one. Whatever ${siteName} has now is replaced by this design, along with its header, footer and look, and that cannot be undone. ${kept}`,
    };
  }

  const many = pageCount === 1 ? 'its 1 page' : `all ${String(pageCount)} of its pages`;
  return {
    replaces: true,
    pages: pageCount,
    sentence: `A design is a whole site, not a set of pages added to one. ${siteName} has ${pageCount === 1 ? '1 page' : `${String(pageCount)} pages`} now, and adding this design replaces ${many}, along with its header, footer and look. That cannot be undone. ${kept}`,
  };
}

/** The server's own sentence for a 4xx, shown verbatim: the blueprint routes
 *  explain the real problem ("This template is already installed…") far better
 *  than a status code can. A 5xx carries no such sentence, so it falls back to
 *  the caller's wording. */
export function blueprintErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

/** Medium date, or an em dash for nothing. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}
