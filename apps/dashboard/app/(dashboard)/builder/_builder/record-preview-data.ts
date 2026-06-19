// Live-record preview data for an embedded canvas (docs/51 §6) — the CMS
// entry-editor analogue of apps/site `loadBuilderData`'s single-record path, but
// CLIENT-side and synchronous so it re-runs on every keystroke.
//
// Given the binding catalog + the entry's in-editor `body`, it shapes the body
// into the one in-scope record the collection template binds (`<typeKey>.*`),
// resolving asset fields (media-id strings) to the `{ url, alt }` the Image leaf
// renders. It starts from `buildPreviewData` so EVERY other path the template
// binds (site chrome, an unrelated `cms.*` list, commerce placeholders) still
// resolves — only THIS record is real.
//
// It also derives the node↔field bridge maps the editor uses to link a clicked
// preview node back to its form field (and vice-versa): a node bound to
// `<typeKey>.title` or `item.title` maps to the `title` field.

import type { BindingCatalog, FieldSchema } from '@sparx/builder-schemas';
import { buildPreviewData, type SitePreviewData } from './binding-catalog';
import type { BuilderNode, DataSources } from './model';

// Browser-reachable public media redirect — the SAME origin + shape the storefront
// (apps/site/lib/media) and the brand canvas (`publicMediaUrl`) use. Inlined at
// build for the client bundle. An absolute http(s) ref passes straight through.
const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3100';

export function clientMediaUrl(assetId: unknown, tenantSlug: string): string | null {
  if (typeof assetId !== 'string' || assetId === '') return null;
  if (/^https?:\/\//i.test(assetId)) return assetId;
  return `${PUBLIC_API_URL}/v1/public/media/${encodeURIComponent(assetId)}?tenant=${encodeURIComponent(
    tenantSlug
  )}`;
}

/** A single asset id → the `{ url, alt }` the Image/ImageDisplay leaf reads, or
 *  null when unset (the leaf then shows nothing live / a slot in edit mode). */
function resolveImage(
  value: unknown,
  tenantSlug: string,
  alt: string
): { url: string; alt: string } | null {
  const url = clientMediaUrl(value, tenantSlug);
  return url ? { url, alt } : null;
}

/** The CMS record source for a content type: the catalog's OBJECT source whose
 *  key is the type key (its `fields` describe the record's shape + kinds). */
function recordFields(catalog: BindingCatalog, typeKey: string): FieldSchema[] {
  return catalog.sources.find((s) => s.key === typeKey && s.cardinality === 'object')?.fields ?? [];
}

/** Shape a body (or a nested group/list item) into the record the template binds:
 *  asset fields resolved to `{ url, alt }`; nested group/list shaped recursively;
 *  every scalar (text/richtext doc/number/boolean/date/option/reference) passes
 *  through verbatim, since `item.<field>` resolves directly against it. */
function shapeRecord(
  fields: FieldSchema[],
  body: Record<string, unknown>,
  tenantSlug: string,
  altFallback: string
): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const f of fields) {
    const v = body[f.key];
    switch (f.kind) {
      case 'image':
        rec[f.key] = resolveImage(v, tenantSlug, altFallback || f.label);
        break;
      case 'images':
        rec[f.key] = Array.isArray(v)
          ? v.map((id) => resolveImage(id, tenantSlug, altFallback || f.label)).filter(Boolean)
          : [];
        break;
      case 'file': {
        const url = clientMediaUrl(v, tenantSlug);
        rec[f.key] = url ? { url, name: f.label } : null;
        break;
      }
      case 'group':
        rec[f.key] =
          v && typeof v === 'object' && !Array.isArray(v)
            ? shapeRecord(f.fields ?? [], v as Record<string, unknown>, tenantSlug, altFallback)
            : v;
        break;
      case 'list':
        rec[f.key] = Array.isArray(v)
          ? v.map((it) =>
              shapeRecord(
                f.fields ?? [],
                (it ?? {}) as Record<string, unknown>,
                tenantSlug,
                altFallback
              )
            )
          : v;
        break;
      default:
        rec[f.key] = v;
    }
  }
  return rec;
}

/** The resolver `root` the canvas reads, with THIS entry's live body shaped into
 *  the record source the template binds (`root[typeKey]`). The placeholder base
 *  (buildPreviewData) keeps every other bound path resolving; the real site chrome
 *  (identity + social) overlays it so the header/footer match the live site. */
export function buildRecordPreviewData(
  catalog: BindingCatalog,
  typeKey: string,
  body: Record<string, unknown>,
  tenantSlug: string,
  sitePreview: SitePreviewData | null
): DataSources {
  const root = buildPreviewData(catalog.sources, sitePreview);
  const altFallback = typeof body.title === 'string' ? body.title : '';
  const record = shapeRecord(recordFields(catalog, typeKey), body, tenantSlug, altFallback);
  (root as Record<string, unknown>)[typeKey] = record;
  return root;
}

// ── Node ↔ field bridge (click a preview node → focus its form field) ─────────

/** The form field key a node's binding path edits, or null when the path isn't one
 *  of this record's fields (e.g. `site.identity`, or a nested `.sub` path — only the
 *  top-level field is editable as a unit). `<typeKey>.title` and `item.title` both
 *  map to `title`. */
export function fieldKeyForPath(
  path: string,
  typeKey: string,
  fieldKeys: ReadonlySet<string>
): string | null {
  let key: string | null = null;
  if (path === typeKey) return null;
  if (path.startsWith(`${typeKey}.`)) key = path.slice(typeKey.length + 1).split('.')[0] ?? null;
  else if (path.startsWith('item.')) key = path.slice('item.'.length).split('.')[0] ?? null;
  return key && fieldKeys.has(key) ? key : null;
}

export interface NodeFieldMaps {
  /** Node id → the field key it binds (for click-a-node → focus-its-field). */
  nodeToField: Map<string, string>;
  /** Field key → the FIRST node bound to it (for focus-a-field → highlight-its-node). */
  fieldToNode: Map<string, string>;
}

/** Walk the template tree once, building both directions of the node↔field bridge
 *  for the record's own fields. */
export function buildNodeFieldMaps(
  tree: BuilderNode,
  typeKey: string,
  fieldKeys: ReadonlySet<string>
): NodeFieldMaps {
  const nodeToField = new Map<string, string>();
  const fieldToNode = new Map<string, string>();
  const visit = (n: BuilderNode): void => {
    const p = n.binding?.path;
    if (p) {
      const key = fieldKeyForPath(p, typeKey, fieldKeys);
      if (key) {
        nodeToField.set(n.id, key);
        if (!fieldToNode.has(key)) fieldToNode.set(key, n.id);
      }
    }
    n.children?.forEach(visit);
  };
  visit(tree);
  return { nodeToField, fieldToNode };
}

/** The set of editable field keys for a content type (top-level record fields). */
export function fieldKeySet(catalog: BindingCatalog, typeKey: string): Set<string> {
  return new Set(recordFields(catalog, typeKey).map((f) => f.key));
}
