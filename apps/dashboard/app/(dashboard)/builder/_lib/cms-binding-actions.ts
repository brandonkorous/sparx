'use server';

// CMS reads for the Builder's Data panel + canvas preview (docs/98 Pillar 7
// record-display). The inspector's "pin a content entry" picker and the canvas's
// real-record overlay call these. They read the PUBLIC content surface scoped by the
// tenant slug — the same endpoints the live site uses (apps/site/lib/content) — so
// the canvas resolves the exact entry the published page will, no parallel mapping to
// drift. Distinct from commerce-binding-actions (content ≠ commerce module).

import { api } from '@/lib/api-rest-client';
import {
  PINS_ROOT,
  entityPinKey,
  type BindingRefs,
  type DataSources,
} from '@sparx/builder-schemas';

import { getTenant, publicMediaUrl } from '../_brand/lib/api';

// The public content entry wire shape (mirror apps/site/lib/content ApiEntry).
interface WireEntry {
  id: string;
  slug: string | null;
  status: string;
  body: Record<string, unknown>;
  published_at: string | null;
}

/** A pickable entry option (the inspector's "pin a content entry" select). */
export interface EntryPick {
  id: string;
  name: string;
}

async function tenantSlug(): Promise<string> {
  return (await getTenant()).slug;
}

/** A readable label for an entry — its `title` field, else its slug, else its id. */
function entryName(e: WireEntry): string {
  const title = e.body.title;
  if (typeof title === 'string' && title.trim()) return title;
  return e.slug ?? e.id;
}

/** Published entries of a content type for the "pin a content entry" picker.
 *  Degrades to [] so the picker stays usable when the type is empty / CMS is off. */
export async function listCmsEntriesForBuilder(type: string): Promise<EntryPick[]> {
  if (!type) return [];
  try {
    const slug = await tenantSlug();
    const params = new URLSearchParams({ tenant: slug, type, limit: '50' });
    const data = await api.get<WireEntry[]>(`/v1/public/content/entries?${params.toString()}`);
    return data.map((e) => ({ id: e.id, name: entryName(e) }));
  } catch {
    return [];
  }
}

/** Resolve a CMS entry body's conventional asset field (`featuredImage` = a media id)
 *  to a `{ url, alt }`, mirroring the site loader (`resolveEntryBodyAssets`) so a
 *  pinned post's image previews. Other fields pass through untouched. */
function resolveBodyAssets(body: Record<string, unknown>, slug: string): Record<string, unknown> {
  const b = { ...body };
  if (typeof b.featuredImage === 'string') {
    const url = publicMediaUrl(b.featuredImage, slug);
    const alt = typeof b.title === 'string' ? b.title : '';
    b.featuredImage = url ? { url, alt } : null;
  }
  return b;
}

/** Hydrate the CMS entries a tree PINS by id into the reserved `__pins` root the
 *  shared resolver reads — so the canvas previews the real pinned entry (canvas ==
 *  live, docs/98 Pillar 7). Degrades to {} on any failure. */
export async function hydrateCmsForBuilder(refs: BindingRefs): Promise<DataSources> {
  try {
    const ids = refs.entities.filter((e) => e.entity === 'cms').map((e) => e.id);
    if (ids.length === 0) return {};
    const slug = await tenantSlug();
    const pins: Record<string, unknown> = {};
    await Promise.all(
      ids.map((id) =>
        api
          .get<WireEntry>(
            `/v1/public/content/entries/${encodeURIComponent(id)}?tenant=${encodeURIComponent(slug)}`
          )
          .then((entry) => {
            pins[entityPinKey('cms', id)] = resolveBodyAssets(entry.body, slug);
          })
          .catch(() => undefined)
      )
    );
    return Object.keys(pins).length > 0 ? { [PINS_ROOT]: pins } : {};
  } catch {
    return {};
  }
}
