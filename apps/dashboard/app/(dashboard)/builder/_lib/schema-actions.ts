'use server';

// Server actions for authoring a content type's field schema from the builder —
// the docs/51 keystone ("schema OWNED by the content type, AUTHORED from the
// builder"). The Fields rail tab and the inspector's inline "+ New field" both
// compute a new `fields[]` and PUT it here.
//
// Editing a platform built-in transparently FORKS it into a tenant-owned copy
// server-side (PUT /v1/content/types/:key/schema); the dashboard never has to
// know whether it's editing a fork or an original. Saving revalidates the
// builder route so the binding catalog (a live server prop on BuilderApp) picks
// up the new fields on the next render without losing client editor state.

import { revalidatePath } from 'next/cache';
import { api, type ApiRestError } from '@/lib/api-rest-client';
import type { FieldDef } from '@sparx/cms-schemas';
import type { ActionResult } from './actions';

export interface ContentTypeSchemaDto {
  id: string;
  key: string;
  name: string;
  plural_name: string;
  is_built_in: boolean;
  schema_json: { fields: FieldDef[] };
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

/** Read the authored field schema for a content type. The API resolves the type
 *  by key with a tenant fork shadowing the platform built-in, so this always
 *  returns the schema the builder/storefront actually use. */
export async function getContentTypeSchema(
  key: string
): Promise<ActionResult<ContentTypeSchemaDto>> {
  return run(
    () => api.get<ContentTypeSchemaDto>(`/v1/content/types/${encodeURIComponent(key)}`),
    false
  );
}

/** Author the field schema (the keystone). The API forks a built-in on edit;
 *  `forked` in the result lets the UI surface "this is now your copy". */
export async function saveContentTypeSchema(
  key: string,
  fields: FieldDef[]
): Promise<ActionResult<ContentTypeSchemaDto & { forked: boolean }>> {
  return run(
    () =>
      api.put<ContentTypeSchemaDto & { forked: boolean }>(
        `/v1/content/types/${encodeURIComponent(key)}/schema`,
        { schema: { fields } }
      ),
    true
  );
}

/** Blast radius for the remove-field confirm: how many entries of this type
 *  currently exist (their stored values for the removed field are dropped on
 *  next save). Capped at 250 — `capped` true reads as "250+" in the dialog. */
export async function countTypeEntries(
  key: string
): Promise<ActionResult<{ count: number; capped: boolean }>> {
  return run(async () => {
    const { data } = await api.getPaged<unknown[]>(
      `/v1/content/entries?type=${encodeURIComponent(key)}&limit=250`
    );
    const count = Array.isArray(data) ? data.length : 0;
    return { count, capped: count >= 250 };
  }, false);
}
