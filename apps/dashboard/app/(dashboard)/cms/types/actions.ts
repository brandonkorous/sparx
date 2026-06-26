'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { api, type ApiRestError } from '@/lib/api-rest-client';

// Generic CRUD over /v1/content/entries for ANY content type. Used by the
// schema-driven dashboard pages under /cms/types/[typeKey]. Distinct from
// `cms/actions.ts` (which is page-only), so the page-only flow stays
// unaffected by changes here.

const SlugSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and dashes.');

const TypeKeySchema = z.string().min(1).max(63);

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface ApiEntry {
  id: string;
  type_key: string;
  slug: string | null;
  status: string;
  body: Record<string, unknown>;
  seo: Record<string, unknown>;
  published_at: string | null;
  updated_at: string;
  created_at: string;
}

function friendly(err: unknown): string {
  const e = err as ApiRestError;
  if (e?.code === 'VALIDATION_ERROR' && Array.isArray(e.details) && e.details.length) {
    const first = e.details[0] as { path?: string; message?: string };
    return first.message ?? e.message ?? 'Invalid input.';
  }
  return e?.message ?? 'An error occurred.';
}

export async function createEntry(
  typeKey: string,
  body: Record<string, unknown>,
  slug?: string,
  authorId?: string
): Promise<ActionResult<{ id: string }>> {
  const typeParsed = TypeKeySchema.safeParse(typeKey);
  if (!typeParsed.success) return { ok: false, error: 'Invalid content type.' };

  const payload: Record<string, unknown> = {
    type_key: typeParsed.data,
    body,
  };
  if (slug) {
    const slugParsed = SlugSchema.safeParse(slug);
    if (!slugParsed.success) return { ok: false, error: slugParsed.error.issues[0]?.message };
    payload.slug = slugParsed.data;
  }
  // Author attribution sets content_entries.author_id (outside body). A UUID
  // from the wizard's author picker; the entries route validates it.
  if (authorId) {
    const authorParsed = z.string().uuid().safeParse(authorId);
    if (authorParsed.success) payload.author_id = authorParsed.data;
  }

  try {
    const entry = await api.post<ApiEntry>('/v1/content/entries', payload);
    revalidatePath(`/cms/types/${typeKey}`);
    revalidatePath('/cms/types');
    return { ok: true, data: { id: entry.id } };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function updateEntry(
  id: string,
  body: Record<string, unknown>,
  slug?: string
): Promise<ActionResult> {
  const payload: Record<string, unknown> = { body };
  if (slug) {
    const slugParsed = SlugSchema.safeParse(slug);
    if (!slugParsed.success) return { ok: false, error: slugParsed.error.issues[0]?.message };
    payload.slug = slugParsed.data;
  }
  try {
    const entry = await api.patch<ApiEntry>(`/v1/content/entries/${id}`, payload);
    revalidatePath(`/cms/types/${entry.type_key}`);
    revalidatePath(`/cms/types/${entry.type_key}/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

// Per-entry SEO (docs/50). The entry carries a `seo` JSONB the storefront reads
// (blog post title/description, canonical, OG, indexing). It rides the unified
// entry save (body + seo + slug in one PATCH), exactly as the Pages editor folds
// SEO into its update. The SEO shape mirrors the Pages editor's `SeoFields`
// (title/description/canonical/robots/ogImage) so the entry editor can reuse the
// full `SeoPanel` verbatim — robots is a free directive string, not the boolean
// `index` of the (now-retired) commit-on-blur EntrySeoSection. Empty fields are
// dropped so a blank input clears that key rather than pinning "".
export interface EntrySeoInput {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  ogImage: string;
}

function seoPayloadOf(seo: EntrySeoInput): Record<string, string> {
  return {
    ...(seo.title.trim() ? { title: seo.title.trim() } : {}),
    ...(seo.description.trim() ? { description: seo.description.trim() } : {}),
    ...(seo.canonical.trim() ? { canonical: seo.canonical.trim() } : {}),
    ...(seo.robots.trim() ? { robots: seo.robots.trim() } : {}),
    ...(seo.ogImage.trim() ? { ogImage: seo.ogImage.trim() } : {}),
  };
}

// Explicit "Save changes" for the entry editor: body + SEO (+ slug for routable
// types) in ONE PATCH, then revalidate the list + editor routes. The entries
// route treats body/seo/slug as independent optionals, so a single PATCH carries
// the whole edit. Last-write-wins, like every other dashboard editor — the CMS
// no longer runs autosave or ETag conflict detection (platform consistency).
export interface SaveEntryInput {
  body: Record<string, unknown>;
  seo: EntrySeoInput;
  /** Routable types only; omitted (and ignored server-side) otherwise. */
  slug?: string;
  // Model B per-site scoping (docs/49 §3): the web PROPERTIES this entry shows
  // on. EMPTY = all sites (the default). Full-replacement set; omit to leave the
  // scope unchanged. Only sent by multi-site tenants — the entry editor passes
  // `undefined` for single-site tenants so a stray PATCH never writes scope rows.
  propertyIds?: string[];
}

export async function saveEntry(
  id: string,
  typeKey: string,
  input: SaveEntryInput
): Promise<ActionResult> {
  const payload: Record<string, unknown> = { body: input.body, seo: seoPayloadOf(input.seo) };
  if (input.slug) {
    const slugParsed = SlugSchema.safeParse(input.slug);
    if (!slugParsed.success) return { ok: false, error: slugParsed.error.issues[0]?.message };
    payload.slug = slugParsed.data;
  }
  if (input.propertyIds !== undefined) payload.property_ids = input.propertyIds;
  try {
    await api.patch<ApiEntry>(`/v1/content/entries/${id}`, payload);
    revalidatePath(`/cms/types/${typeKey}`);
    revalidatePath(`/cms/types/${typeKey}/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

// Schedule a future publish (status → 'scheduled'); the publish route flips
// when `scheduled_at` is in the future. Mirrors `schedulePagePublish`.
export async function scheduleEntryPublish(
  id: string,
  typeKey: string,
  isoScheduledAt: string
): Promise<ActionResult> {
  const when = new Date(isoScheduledAt);
  if (Number.isNaN(when.getTime())) return { ok: false, error: 'Pick a valid future date/time.' };
  if (when.getTime() <= Date.now() + 60_000) {
    return { ok: false, error: 'Scheduled time must be at least one minute in the future.' };
  }
  try {
    await api.post(`/v1/content/entries/${id}/publish`, { scheduled_at: isoScheduledAt });
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
  revalidatePath(`/cms/types/${typeKey}`);
  revalidatePath(`/cms/types/${typeKey}/${id}`);
  return { ok: true };
}

// Per-record builder template OVERRIDE (docs/51 §6) — pin THIS entry to a
// specific collection template, or clear it (builderPageId=null) so it falls
// back to the content type's default. A content entry's recordType is
// `cms.<typeKey>`. Routes through the builder assignment endpoint; the picker
// only renders when the Builder module is on, so a 404 here is unexpected.
export async function setEntryTemplate(
  typeKey: string,
  itemRef: string,
  builderPageId: string | null
): Promise<ActionResult> {
  try {
    await api.put('/v1/builder/assignment', {
      recordType: `cms.${typeKey}`,
      itemRef,
      builderPageId,
    });
    revalidatePath(`/cms/types/${typeKey}/${itemRef}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function deleteEntry(id: string, typeKey: string): Promise<ActionResult> {
  try {
    await api.delete(`/v1/content/entries/${id}`);
    revalidatePath(`/cms/types/${typeKey}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

// ─── Custom content type CRUD ────────────────────────────────────────────

const TypeKeyFormat = z
  .string()
  .min(1)
  .max(63)
  .regex(
    /^[a-z][a-z0-9_]*$/,
    'Use lowercase letters, numbers, and underscores; start with a letter.'
  );

const SchemaJson = z
  .string()
  .min(2)
  .transform((raw, ctx) => {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !Array.isArray((parsed as { fields?: unknown }).fields)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Schema must be a JSON object with a `fields` array.',
        });
        return z.NEVER;
      }
      return parsed as { fields: unknown[] };
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Schema must be valid JSON.' });
      return z.NEVER;
    }
  });

const CreateTypeBody = z.object({
  key: TypeKeyFormat,
  name: z.string().min(1).max(120),
  plural_name: z.string().min(1).max(120),
  description: z.string().max(2048).optional(),
  url_pattern: z.string().max(255).optional(),
  is_singleton: z.boolean().optional(),
  schema: SchemaJson,
});

const UpdateTypeBody = z.object({
  name: z.string().min(1).max(120).optional(),
  plural_name: z.string().min(1).max(120).optional(),
  description: z.string().max(2048).optional(),
  url_pattern: z.string().max(255).optional(),
  is_singleton: z.boolean().optional(),
  schema: SchemaJson.optional(),
});

function readString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

export async function createContentType(
  formData: FormData
): Promise<ActionResult<{ key: string }>> {
  const parsed = CreateTypeBody.safeParse({
    key: readString(formData, 'key'),
    name: readString(formData, 'name'),
    plural_name: readString(formData, 'plural_name'),
    description: readString(formData, 'description') || undefined,
    url_pattern: readString(formData, 'url_pattern') || undefined,
    is_singleton: formData.get('is_singleton') === 'on',
    schema: readString(formData, 'schema'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  try {
    const created = await api.post<{ key: string }>('/v1/content/types', parsed.data);
    revalidatePath('/cms/types');
    return { ok: true, data: { key: created.key } };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function updateContentType(
  typeKey: string,
  formData: FormData
): Promise<ActionResult> {
  const parsed = UpdateTypeBody.safeParse({
    name: readString(formData, 'name') || undefined,
    plural_name: readString(formData, 'plural_name') || undefined,
    description: readString(formData, 'description') || undefined,
    url_pattern: readString(formData, 'url_pattern') || undefined,
    is_singleton: formData.get('is_singleton') === 'on',
    schema: readString(formData, 'schema') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  try {
    await api.patch(`/v1/content/types/${encodeURIComponent(typeKey)}`, parsed.data);
    revalidatePath('/cms/types');
    revalidatePath(`/cms/types/${typeKey}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function deleteContentType(typeKey: string): Promise<ActionResult> {
  try {
    await api.delete(`/v1/content/types/${encodeURIComponent(typeKey)}`);
    revalidatePath('/cms/types');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function setEntryStatus(
  id: string,
  typeKey: string,
  rawStatus: string
): Promise<ActionResult> {
  const StatusSchema = z.enum(['draft', 'published']);
  const parsed = StatusSchema.safeParse(rawStatus);
  if (!parsed.success) return { ok: false, error: 'Invalid status.' };

  try {
    if (parsed.data === 'published') {
      await api.post(`/v1/content/entries/${id}/publish`);
    } else {
      await api.post(`/v1/content/entries/${id}/unpublish`);
    }
    revalidatePath(`/cms/types/${typeKey}`);
    revalidatePath(`/cms/types/${typeKey}/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

interface TypeSchema {
  key: string;
  name: string;
  url_pattern: string | null;
  schema_json: { fields: unknown[] };
}

export async function getTypeSchema(typeKey: string): Promise<ActionResult<TypeSchema>> {
  const parsed = TypeKeySchema.safeParse(typeKey);
  if (!parsed.success) return { ok: false, error: 'Invalid content type key.' };
  try {
    const schema = await api.get<TypeSchema>(
      `/v1/content/types/${encodeURIComponent(parsed.data)}`
    );
    return { ok: true, data: schema };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}
