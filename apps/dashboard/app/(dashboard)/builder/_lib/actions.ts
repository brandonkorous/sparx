'use server';

// Thin server-action adapters over api-rest for the Builder page catalog.
// Server actions inherit the session + JWT secret (held only on the dashboard
// server) so the editor never talks to api-rest from the browser.
//
// Structural ops (create / delete / publish / reorder) revalidate the route so
// a fresh navigation reflects the catalog. The high-frequency draft-tree
// autosave deliberately does NOT revalidate — the client already holds the
// latest tree, and revalidating on every keystroke-debounce would thrash the
// route cache for no gain.

import { revalidatePath } from 'next/cache';
import { api, type ApiRestError } from '@/lib/api-rest-client';
import type {
  BuilderEmailDto,
  BuilderLayoutDto,
  BuilderNode,
  BuilderPageDto,
  BuilderPageKind,
  ReleaseSummaryDto,
  RestoreResultDto,
  SilicaEmailDocument,
  SiteSyncInput,
  UsagePlacementDto,
} from '@sparx/builder-schemas';

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function run<T>(
  fn: () => Promise<T>,
  revalidate: boolean,
  // The unified editor (docs/builder/07) — page + layout mutations both reflect on
  // the one studio route now that the split editors are retired.
  path = '/builder/studio'
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    if (revalidate) revalidatePath(path, 'layout');
    return { ok: true, data };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: e.message ?? 'Something went wrong.' };
  }
}

export async function createPage(input: {
  name: string;
  kind?: BuilderPageKind;
  recordType?: string | null;
  tree?: BuilderNode;
}): Promise<ActionResult<BuilderPageDto>> {
  return run(() => api.post<BuilderPageDto>('/v1/builder/pages', input), true);
}

/** The autosave path — save the draft tree. No revalidate (see file header). */
export async function savePageTree(
  id: string,
  tree: BuilderNode
): Promise<ActionResult<BuilderPageDto>> {
  return run(() => api.patch<BuilderPageDto>(`/v1/builder/pages/${id}`, { tree }), false);
}

// ── silica-native site (docs/118) ────────────────────────────────────────────
// The silica `<Builder>` autosaves the WHOLE extracted site on every edit (its
// engine owns the multi-page model), so persistence is one whole-site reconcile,
// not the per-page PATCH above.

/** The silica autosave path — reconcile the whole extracted `Site` into the
 *  store. No revalidate (the client holds the live site; see file header). */
export async function syncBuilderSite(
  input: SiteSyncInput
): Promise<
  ActionResult<{ saved: boolean; pageUpdatedAt: Record<string, string>; seq: number | null }>
> {
  return run(
    () =>
      api.put<{ saved: boolean; pageUpdatedAt: Record<string, string>; seq: number | null }>(
        '/v1/builder/site',
        input
      ),
    false
  );
}

/** Publish the silica site — snapshot every draft tree → published. Revalidates
 *  the studio route so a fresh load reflects the published state.
 *
 *  Returns the sealed release (docs/126 §5.3): every publish is now an immutable,
 *  restorable point in the site's history, and the id/hash come back so the caller
 *  can name what it just published without a second round trip. */
export async function publishBuilderSite(): Promise<
  ActionResult<{ published: boolean; releaseId: string; hash: string }>
> {
  return run(
    () =>
      api.post<{ published: boolean; releaseId: string; hash: string }>('/v1/builder/site/publish'),
    true
  );
}

/** The property's publish history, newest first (docs/126 §5.3).
 *
 *  A server ACTION rather than a server-only reader in api.ts: the history drawer
 *  fetches it on open, from the client, so it reflects publishes made since the page
 *  loaded rather than a snapshot baked in at render.
 *
 *  Degrades to an empty list on failure. This drives a drawer the author opened on
 *  purpose, and "nothing to restore yet" is the honest message when we can't tell —
 *  it must never take down the editor around it. */
export async function getReleases(): Promise<ReleaseSummaryDto[]> {
  try {
    return await api.get<ReleaseSummaryDto[]>('/v1/builder/site/releases');
  } catch {
    return [];
  }
}

/** Where a saved component is PLACED across the property's trees (docs/126 §5.4).
 *  Read before offering to delete one, so "what breaks if I remove this?" has a real
 *  answer instead of the delete being a blind write. */
export async function getSymbolUsages(
  symbolId: string
): Promise<ActionResult<UsagePlacementDto[]>> {
  return run(
    () =>
      api.get<UsagePlacementDto[]>(
        `/v1/builder/site/symbols/${encodeURIComponent(symbolId)}/usages`
      ),
    false
  );
}

/** Roll the live site back to an earlier publish (docs/126 §5.3).
 *
 *  This is a PUBLISH, not a rewind: the old manifest is republished forward as a new
 *  release, so the history keeps growing and the restore is itself restorable. The
 *  result reports what actually moved — including pages created after the target
 *  release, which get unpublished (their drafts survive untouched). */
export async function restoreRelease(releaseId: string): Promise<ActionResult<RestoreResultDto>> {
  return run(
    () => api.post<RestoreResultDto>(`/v1/builder/site/releases/${releaseId}/restore`),
    true
  );
}

/** Restore the header + footer to the current starter chrome — the recovery path
 *  for a frame stamped before the brand mark became a live host core, which no
 *  amount of logo uploading can reach. Rewrites the DRAFT only: pages, theme, and
 *  what visitors are served all stay put, so the author reviews the restored chrome
 *  and publishes it themselves.
 *
 *  Revalidates the studio route, but the CALLER must reload rather than rely on it:
 *  silica's engine reads `document` once at mount, so a refreshed server tree alone
 *  would leave the editor holding the old frame — and its next autosave would write
 *  that old frame straight back over the reset. See `resetFrame` in silica-studio. */
export async function resetSiteFrame(): Promise<ActionResult<{ frame: unknown }>> {
  return run(() => api.post<{ frame: unknown }>('/v1/builder/site/frame/reset'), true);
}

export async function renamePage(id: string, name: string): Promise<ActionResult<BuilderPageDto>> {
  return run(() => api.patch<BuilderPageDto>(`/v1/builder/pages/${id}`, { name }), true);
}

/** Set (or clear, with '') the page's storefront slug (docs/44). An empty string
 *  sends null to clear it; a value is validated server-side against PageSlug. */
export async function setPageSlug(id: string, slug: string): Promise<ActionResult<BuilderPageDto>> {
  const value = slug.trim() === '' ? null : slug.trim();
  return run(() => api.patch<BuilderPageDto>(`/v1/builder/pages/${id}`, { slug: value }), true);
}

/** Retarget a collection template at the record source it renders per record
 *  (docs/51 §6) — a content type (`cms.<key>`) or a code-defined domain source
 *  (`commerce.product`). Picking from the real binding catalog (vs. a hand-typed
 *  string) is what keeps the template↔content link from drifting. Null clears it. */
export async function retargetPage(
  id: string,
  recordType: string | null
): Promise<ActionResult<BuilderPageDto>> {
  return run(() => api.patch<BuilderPageDto>(`/v1/builder/pages/${id}`, { recordType }), true);
}

/** Make a collection template the DEFAULT for its recordType (docs/51 §6) — the
 *  per-type winner the storefront renders when a record has no per-record
 *  override. Mirrors the layout "activate" action. */
export async function setPageDefault(id: string): Promise<ActionResult<BuilderPageDto>> {
  return run(() => api.post<BuilderPageDto>(`/v1/builder/pages/${id}/default`), true);
}

/** Update a singleton page's SEO (docs/50). Empty strings clear a field
 *  (stored null server-side). No revalidate — the editor holds the latest values
 *  and only the published storefront read consumes them. */
export async function updatePageSeo(
  id: string,
  seo: {
    seoTitle: string;
    seoDescription: string;
    canonical: string;
    ogImage: string;
    noindex: boolean;
  }
): Promise<ActionResult<BuilderPageDto>> {
  return run(() => api.patch<BuilderPageDto>(`/v1/builder/pages/${id}`, seo), false);
}

export async function deletePage(id: string): Promise<ActionResult<{ id: string }>> {
  return run(() => api.delete<{ id: string }>(`/v1/builder/pages/${id}`), true);
}

export async function publishPage(id: string): Promise<ActionResult<BuilderPageDto>> {
  return run(() => api.post<BuilderPageDto>(`/v1/builder/pages/${id}/publish`), true);
}

/** Mint a short-lived site-preview token so the editor's "Preview" tab can open
 *  the live site showing this page's DRAFT (docs/45 §2.6). No revalidate — it's a
 *  read that returns a fresh token each call. */
export async function mintBuilderPreviewToken(): Promise<ActionResult<{ token: string }>> {
  return run(() => api.get<{ token: string }>('/v1/builder/preview-token'), false);
}

export async function reorderPages(
  orderedIds: string[]
): Promise<ActionResult<{ pages: BuilderPageDto[] }>> {
  return run(
    () => api.post<{ pages: BuilderPageDto[] }>('/v1/builder/pages/reorder', { orderedIds }),
    true
  );
}

// ── Surface preview (docs/47 §5) ─────────────────────────────────────────────
// Compile the class set the editor collected from the working tree into CSS for
// the canvas (the `temp.css` live-preview path). Stateless + high-frequency
// (debounced on edits), so — like autosave — it never revalidates.
export async function compileSurfacePreview(
  classes: string[]
): Promise<ActionResult<{ css: string }>> {
  return run(() => api.post<{ css: string }>('/v1/builder/surface/compile', { classes }), false);
}

// ── Site layout catalog (the chrome shells — docs/45) ────────────────────────
// A tenant keeps many layouts; exactly one is ACTIVE (the live chrome). These
// mirror the page actions, revalidating the unified studio. Activate is the new
// op: it flips which published layout the storefront serves.

export async function createLayout(input: {
  name: string;
  tree?: BuilderNode;
}): Promise<ActionResult<BuilderLayoutDto>> {
  return run(
    () => api.post<BuilderLayoutDto>('/v1/builder/layouts', input),
    true,
    '/builder/studio'
  );
}

/** The autosave path — save the layout's draft tree. No revalidate. */
export async function saveLayoutTree(
  id: string,
  tree: BuilderNode
): Promise<ActionResult<BuilderLayoutDto>> {
  return run(() => api.patch<BuilderLayoutDto>(`/v1/builder/layouts/${id}`, { tree }), false);
}

export async function renameLayout(
  id: string,
  name: string
): Promise<ActionResult<BuilderLayoutDto>> {
  return run(
    () => api.patch<BuilderLayoutDto>(`/v1/builder/layouts/${id}`, { name }),
    true,
    '/builder/studio'
  );
}

export async function deleteLayout(id: string): Promise<ActionResult<{ id: string }>> {
  return run(
    () => api.delete<{ id: string }>(`/v1/builder/layouts/${id}`),
    true,
    '/builder/studio'
  );
}

export async function publishLayout(id: string): Promise<ActionResult<BuilderLayoutDto>> {
  return run(
    () => api.post<BuilderLayoutDto>(`/v1/builder/layouts/${id}/publish`),
    true,
    '/builder/studio'
  );
}

/** Make a published layout the live one — flips what the storefront serves. */
export async function activateLayout(id: string): Promise<ActionResult<BuilderLayoutDto>> {
  return run(
    () => api.post<BuilderLayoutDto>(`/v1/builder/layouts/${id}/activate`),
    true,
    '/builder/studio'
  );
}

// ── Email Builder catalog (the email documents — docs/52) ────────────────────
// Mirror the page actions but revalidate /builder/email. An email is ONE
// self-contained body tree, with document-level subject + preheader fields.

export async function createEmail(input: {
  name: string;
  subject?: string;
  preheader?: string | null;
  tree?: BuilderNode;
}): Promise<ActionResult<BuilderEmailDto>> {
  return run(() => api.post<BuilderEmailDto>('/v1/builder/emails', input), true, '/builder/email');
}

/** The autosave path — save the email's draft body tree. No revalidate. */
export async function saveEmailTree(
  id: string,
  tree: BuilderNode
): Promise<ActionResult<BuilderEmailDto>> {
  return run(() => api.patch<BuilderEmailDto>(`/v1/builder/emails/${id}`, { tree }), false);
}

export async function renameEmail(
  id: string,
  name: string
): Promise<ActionResult<BuilderEmailDto>> {
  return run(
    () => api.patch<BuilderEmailDto>(`/v1/builder/emails/${id}`, { name }),
    true,
    '/builder/email'
  );
}

/** Set the email subject line. No revalidate — the editor holds the latest value
 *  and only the send/preview read consumes it. */
export async function setEmailSubject(
  id: string,
  subject: string
): Promise<ActionResult<BuilderEmailDto>> {
  return run(() => api.patch<BuilderEmailDto>(`/v1/builder/emails/${id}`, { subject }), false);
}

/** Set (or clear, with '') the inbox preheader. An empty string sends null. */
export async function setEmailPreheader(
  id: string,
  preheader: string
): Promise<ActionResult<BuilderEmailDto>> {
  const value = preheader.trim() === '' ? null : preheader;
  return run(
    () => api.patch<BuilderEmailDto>(`/v1/builder/emails/${id}`, { preheader: value }),
    false
  );
}

export async function deleteEmail(id: string): Promise<ActionResult<{ id: string }>> {
  return run(() => api.delete<{ id: string }>(`/v1/builder/emails/${id}`), true, '/builder/email');
}

export async function publishEmail(id: string): Promise<ActionResult<BuilderEmailDto>> {
  return run(
    () => api.post<BuilderEmailDto>(`/v1/builder/emails/${id}/publish`),
    true,
    '/builder/email'
  );
}

/** The silica autosave path (docs/120) — persist the `<EmailBuilder>` document on
 *  every debounced edit. No revalidate; the editor is authoritative. Mirrors the
 *  site builder's `syncBuilderSite`. */
export async function syncSilicaEmail(
  id: string,
  doc: SilicaEmailDocument
): Promise<ActionResult<BuilderEmailDto>> {
  return run(() => api.put<BuilderEmailDto>(`/v1/builder/emails/${id}/silica`, { doc }), false);
}

/** Snapshot a silica email's draft → published (docs/120). Revalidates the catalog
 *  route so the published badge refreshes. */
export async function publishSilicaEmail(id: string): Promise<ActionResult<BuilderEmailDto>> {
  return run(
    () => api.post<BuilderEmailDto>(`/v1/builder/emails/${id}/silica/publish`),
    true,
    '/builder/email'
  );
}

/** "Customize for this site" (docs/49 Phase 7b): fork a tenant-wide default into
 *  a per-site DRAFT override the active site edits independently. Idempotent — a
 *  repeat returns the existing override. The tenant default keeps sending for the
 *  site until the override is published (getPublishedByKey's per-site fallback).
 *  No revalidate — the editor swaps to the returned override in place. */
export async function customizeEmailForSite(
  propertyId: string,
  key: string
): Promise<ActionResult<BuilderEmailDto>> {
  return run(
    () => api.post<BuilderEmailDto>(`/v1/builder/emails/site/${propertyId}/customize`, { key }),
    false
  );
}

/** Render the email's DRAFT body to inlined HTML for the editor preview iframe
 *  (docs/52 Phase 2). No revalidate — a stateless render. */
export async function previewEmail(
  id: string
): Promise<ActionResult<{ subject: string; html: string; text: string }>> {
  return run(
    () =>
      api.get<{ subject: string; html: string; text: string }>(`/v1/builder/emails/${id}/preview`),
    false
  );
}

/** Render the draft + queue delivery via the email-worker — the staff smoke test.
 *  Delivery is async (the worker sends through the configured provider), so this
 *  resolves once the send is queued, not once it's accepted by the provider. */
export async function testSendEmail(
  id: string,
  to: string
): Promise<ActionResult<{ queued: boolean; to: string }>> {
  return run(
    () => api.post<{ queued: boolean; to: string }>(`/v1/builder/emails/${id}/test-send`, { to }),
    false
  );
}
