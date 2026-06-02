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
import type { BuilderNode, BuilderPageDto, BuilderPageKind } from '@sparx/builder-schemas';

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function run<T>(fn: () => Promise<T>, revalidate: boolean): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    if (revalidate) revalidatePath('/builder/page', 'layout');
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

export async function deletePage(id: string): Promise<ActionResult<{ id: string }>> {
  return run(() => api.delete<{ id: string }>(`/v1/builder/pages/${id}`), true);
}

export async function publishPage(id: string): Promise<ActionResult<BuilderPageDto>> {
  return run(() => api.post<BuilderPageDto>(`/v1/builder/pages/${id}/publish`), true);
}

export async function reorderPages(
  orderedIds: string[]
): Promise<ActionResult<{ pages: BuilderPageDto[] }>> {
  return run(
    () => api.post<{ pages: BuilderPageDto[] }>('/v1/builder/pages/reorder', { orderedIds }),
    true
  );
}
