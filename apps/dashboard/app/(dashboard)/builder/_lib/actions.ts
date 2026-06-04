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
} from '@sparx/builder-schemas';

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function run<T>(
  fn: () => Promise<T>,
  revalidate: boolean,
  path = '/builder/page'
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
// mirror the page actions but revalidate /builder/site. Activate is the new op:
// it flips which published layout the storefront serves.

export async function createLayout(input: {
  name: string;
  tree?: BuilderNode;
}): Promise<ActionResult<BuilderLayoutDto>> {
  return run(() => api.post<BuilderLayoutDto>('/v1/builder/layouts', input), true, '/builder/site');
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
    '/builder/site'
  );
}

export async function deleteLayout(id: string): Promise<ActionResult<{ id: string }>> {
  return run(() => api.delete<{ id: string }>(`/v1/builder/layouts/${id}`), true, '/builder/site');
}

export async function publishLayout(id: string): Promise<ActionResult<BuilderLayoutDto>> {
  return run(
    () => api.post<BuilderLayoutDto>(`/v1/builder/layouts/${id}/publish`),
    true,
    '/builder/site'
  );
}

/** Make a published layout the live one — flips what the storefront serves. */
export async function activateLayout(id: string): Promise<ActionResult<BuilderLayoutDto>> {
  return run(
    () => api.post<BuilderLayoutDto>(`/v1/builder/layouts/${id}/activate`),
    true,
    '/builder/site'
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

/** Render + deliver the draft to one address — the staff smoke test. */
export async function testSendEmail(
  id: string,
  to: string
): Promise<ActionResult<{ id: string; provider: string; acceptedAt: string }>> {
  return run(
    () =>
      api.post<{ id: string; provider: string; acceptedAt: string }>(
        `/v1/builder/emails/${id}/test-send`,
        { to }
      ),
    false
  );
}
