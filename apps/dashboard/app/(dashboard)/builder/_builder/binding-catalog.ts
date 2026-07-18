// The editor's view of the binding schema (docs/43, the keystone). The backend
// derives WHAT a page can bind to from the tenant's real data
// (GET /v1/builder/binding-schema → BindingCatalog); this module turns that
// catalog into the things the editor needs, replacing the old hand-written mock
// (`BIND_PATHS` / `ITEM_PATHS` / `SAMPLE_DATA`):
//   · bindGroups / itemBindPaths — the inspector's binding-picker options
//   · scopeAt                     — which item.* fields are in scope for a node
//   · cardinalityForPath / bindHint — single-vs-iterate, and the picker hint
//   · buildPreviewData            — typed PLACEHOLDER data the canvas resolves
//                                   bindings against (real records come later)
//   · moduleForPath / moduleColor — color a binding by the module that owns it
//
// Everything here is pure + deterministic (no Date.now / Math.random) so the
// SSR'd canvas and its client hydration produce identical preview data.

import {
  COMMERCE_SOURCES,
  type BindingCatalog,
  type DataSource,
  type FieldSchema,
  type SourceModule,
} from '@sparx/builder-schemas';

import type { BuilderNode, Cardinality, DataSources } from './model';

export const EMPTY_CATALOG: BindingCatalog = { sources: [] };

// The PRODUCT field set (id / handle / title / price / images / …) a node inherits
// when an ancestor PINS a product or REPEATS a collection (docs/98 Pillar 7), so
// the descendant's field picker offers `item.title` / `item.price` / `item.images`.
const PRODUCT_SCOPE_FIELDS: FieldSchema[] =
  COMMERCE_SOURCES.find((s) => s.key === 'product')?.fields ?? [];

// The OWN-record fields a collection / category PIN scopes descendants to (docs/98
// Pillar 7 record-display) — a banner pinned to a category reads item.name /
// item.description / item.image, NOT a product's fields. Static (the record shape is
// fixed); a CMS pin instead reuses its content type's record source from the catalog.
const recordScopeFields = (idLabel: string): FieldSchema[] => [
  { key: 'id', label: `${idLabel} ID`, kind: 'text', cardinality: 'scalar' },
  { key: 'name', label: 'Name', kind: 'text', cardinality: 'scalar' },
  { key: 'handle', label: 'Handle (URL)', kind: 'text', cardinality: 'scalar' },
  { key: 'description', label: 'Description', kind: 'text', cardinality: 'scalar' },
  { key: 'image', label: 'Hero image', kind: 'image', cardinality: 'scalar' },
];
const COLLECTION_SCOPE_FIELDS = recordScopeFields('Collection');
const CATEGORY_SCOPE_FIELDS = recordScopeFields('Category');

// ── Module accent colors (editor chrome — independent of the tenant brand) ────
// Mirrors sample.ts MODULES. A bare binding path (e.g. `blog_post.title`) hides
// which module owns it, so we resolve the source via the catalog and color by
// its module.
const MODULE_COLOR: Record<string, string> = {
  cms: '#14b8a6',
  commerce: '#f97316',
  crm: '#06b6d4',
  events: '#a855f7',
  scheduling: '#f43f5e', // Rose — the Scheduling module accent (docs/79)
  site: '#6366f1', // the storefront/chrome lineage (docs/45)
};
const SCOPE_COLOR = '#6366f1'; // item.* / index — resolved from the enclosing scope

export function moduleColor(module: string | undefined): string {
  return (module ? MODULE_COLOR[module] : undefined) ?? SCOPE_COLOR;
}

/** The tenant's content types a node can PIN a single entry from (docs/98 Pillar 7
 *  record-display) — the catalog's CMS RECORD sources (one object source per type),
 *  as `{ key, name }`. `key` is the `cmsType` the binding carries. */
export function cmsTypesFromCatalog(catalog: BindingCatalog): { key: string; name: string }[] {
  return catalog.sources
    .filter((s) => s.module === 'cms' && s.cardinality === 'object')
    .map((s) => ({ key: s.key, name: s.label }));
}

// ── Path → source resolution ──────────────────────────────────────────────────

/** The source a non-scoped path roots at — the longest source key that is the
 *  path itself, its `[n]` element, or its `.field…` prefix. */
function sourceForPath(catalog: BindingCatalog, path: string): DataSource | undefined {
  let best: DataSource | undefined;
  for (const s of catalog.sources) {
    if (path === s.key || path.startsWith(`${s.key}.`) || path.startsWith(`${s.key}[`)) {
      if (!best || s.key.length > best.key.length) best = s;
    }
  }
  return best;
}

/** The module that owns a binding path (undefined for item.* / index, which are
 *  resolved from the enclosing scope). */
export function moduleForPath(catalog: BindingCatalog, path: string): SourceModule | undefined {
  if (path.startsWith('item') || path === 'index') return undefined;
  return sourceForPath(catalog, path)?.module;
}

// ── Field walking ─────────────────────────────────────────────────────────────

function walkFields(fields: FieldSchema[], dotted: string): FieldSchema | undefined {
  let cursor: FieldSchema[] | undefined = fields;
  let found: FieldSchema | undefined;
  for (const seg of dotted.split('.').filter(Boolean)) {
    found = cursor?.find((f) => f.key === seg);
    if (!found) return undefined;
    cursor = found.fields;
  }
  return found;
}

function fieldAtSourcePath(catalog: BindingCatalog, path: string): FieldSchema | undefined {
  const src = sourceForPath(catalog, path);
  if (!src || !path.startsWith(`${src.key}.`)) return undefined;
  return walkFields(src.fields, path.slice(src.key.length + 1));
}

function fieldAtItemPath(scopeFields: FieldSchema[], path: string): FieldSchema | undefined {
  if (!path.startsWith('item.')) return undefined;
  return walkFields(scopeFields, path.slice('item.'.length));
}

function fieldCardinality(f: FieldSchema): Cardinality {
  if (f.cardinality === 'array') return 'array';
  if (f.cardinality === 'object') return 'object';
  return 'scalar';
}

// ── Scope (which item.* fields a node can read) ───────────────────────────────

export interface ScopeInfo {
  /** True when an enclosing list/record sets an `item` scope. */
  inScope: boolean;
  /** The fields available as `item.<key>`. */
  fields: FieldSchema[];
  /** The scope source/field label, for hints. */
  label?: string;
}

export const NO_SCOPE: ScopeInfo = { inScope: false, fields: [] };

/** Walk root→…→node and resolve the item scope its ancestors establish. An
 *  ancestor bound to a source (or its first element) scopes to that source's
 *  fields; one bound to an item.* group/list field descends into it. */
export function scopeAt(catalog: BindingCatalog, chain: BuilderNode[]): ScopeInfo {
  let fields: FieldSchema[] = [];
  let label: string | undefined;
  let active = false;
  for (const n of chain.slice(0, -1)) {
    const b = n.binding;
    if (!b) continue;
    // docs/98 Pillar 7: an entity pin (object) or a collection source (array) scopes
    // descendants to that record's fields. A product pin / any product source →
    // PRODUCT fields; a collection/category RECORD pin → its own fields; a CMS entry
    // pin → its content type's record fields (from the catalog). So a heading inside
    // offers item.title / item.name / item.body etc. for the pinned record.
    if (b.entity || b.source) {
      if (b.source) fields = PRODUCT_SCOPE_FIELDS;
      else if (b.entity === 'collection') fields = COLLECTION_SCOPE_FIELDS;
      else if (b.entity === 'category') fields = CATEGORY_SCOPE_FIELDS;
      else if (b.entity === 'cms')
        fields = catalog.sources.find((s) => s.key === b.cmsType)?.fields ?? [];
      else fields = PRODUCT_SCOPE_FIELDS; // entity === 'product'
      label = b.label ?? b.entity ?? 'product';
      active = true;
      continue;
    }
    const p = b.path;
    if (!p) continue;
    if (p.startsWith('item')) {
      const f = active ? fieldAtItemPath(fields, p) : undefined;
      if (f && (f.kind === 'group' || f.kind === 'list')) {
        fields = f.fields ?? [];
        label = f.label;
        active = true;
      }
      continue;
    }
    const src = sourceForPath(catalog, p);
    if (!src) continue;
    if (p === src.key || /\[\d+\]$/.test(p)) {
      // bound to the whole source (array → each item; object → the record),
      // or to one element of an array — either way item.* = the source fields.
      fields = src.fields;
      label = src.label;
      active = true;
    } else {
      const f = fieldAtSourcePath(catalog, p);
      if (f && (f.kind === 'group' || f.kind === 'list')) {
        fields = f.fields ?? [];
        label = f.label;
        active = true;
      }
    }
  }
  return { inScope: active, fields, label };
}

// ── Cardinality of any path (drives hints + the iterate badge) ────────────────

export function cardinalityForPath(
  catalog: BindingCatalog,
  scope: ScopeInfo,
  path: string
): Cardinality {
  const t = path.trim();
  if (t === '' || t === 'item') return 'empty';
  if (t === 'index') return 'scalar';
  if (t.startsWith('item.')) {
    const f = fieldAtItemPath(scope.fields, t);
    return f ? fieldCardinality(f) : 'empty';
  }
  if (/\[\d+\]$/.test(t)) {
    // one element of an array source → a single record
    return sourceForPath(catalog, t) ? 'object' : 'empty';
  }
  const src = catalog.sources.find((s) => s.key === t);
  if (src) return src.cardinality;
  const f = fieldAtSourcePath(catalog, t);
  return f ? fieldCardinality(f) : 'empty';
}

export function bindHint(catalog: BindingCatalog, scope: ScopeInfo, path: string): string {
  if (path.startsWith('item') || path === 'index') {
    return 'Resolved per item from the enclosing list/record.';
  }
  switch (cardinalityForPath(catalog, scope, path)) {
    case 'array':
      return 'A list → this node repeats once per item, scoping each to item.*';
    case 'object':
      return 'A record → renders once and sets the scope for item.* below.';
    case 'scalar':
      return 'A single value → shown in place.';
    default:
      return 'No data at this path yet.';
  }
}

// ── Picker options ────────────────────────────────────────────────────────────

export interface BindGroup {
  module: string;
  paths: { path: string; label: string }[];
}

const MODULE_ORDER = ['site', 'cms', 'commerce', 'crm', 'events'];

/** Module-grouped paths the picker offers: an array source as a list (+ its
 *  first record), a record source plus each of its fields. The item.* paths
 *  come from `itemBindPaths(scope)`. */
export function bindGroups(catalog: BindingCatalog): BindGroup[] {
  const byModule = new Map<string, { path: string; label: string }[]>();
  const push = (m: string, path: string, label: string) => {
    const list = byModule.get(m) ?? [];
    list.push({ path, label });
    byModule.set(m, list);
  };
  for (const s of catalog.sources) {
    if (s.cardinality === 'array') {
      push(s.module, s.key, `${s.label} · list`);
      push(s.module, `${s.key}[0]`, `${s.label} · first`);
    } else {
      push(s.module, s.key, `${s.label} · record`);
      for (const f of s.fields) push(s.module, `${s.key}.${f.key}`, `${s.label} › ${f.label}`);
    }
  }
  const known = MODULE_ORDER.filter((m) => byModule.has(m));
  const extra = [...byModule.keys()].filter((m) => !MODULE_ORDER.includes(m));
  return [...known, ...extra].map((m) => ({ module: m, paths: byModule.get(m) ?? [] }));
}

/** `item.<field>` paths offered when a scope is active, plus `index`. */
export function itemBindPaths(scope: ScopeInfo): { path: string; label: string }[] {
  const out = scope.fields.map((f) => ({ path: `item.${f.key}`, label: `item.${f.key}` }));
  out.push({ path: 'index', label: 'index' });
  return out;
}

// ── Preview data (typed placeholders the canvas resolves bindings against) ────

const SAMPLE_TITLES = [
  'Built for the work',
  'A closer look at the craft',
  'Notes from the field',
  'Made to last',
  'The details that matter',
];
const SAMPLE_LINES = [
  'A short, human sentence standing in for the real copy.',
  'Placeholder text — the writer fills this in from the module form.',
  'Just enough preview copy to see the layout breathe.',
];
const SAMPLE_PARAS = [
  'A longer passage would run here. The template decides how it looks; the writer supplies the words in the module.',
  'Two or three sentences of body copy — enough to show measure and rhythm. Real content replaces this once the record is filled.',
];

function pick(arr: string[], i: number): string {
  return arr[i % arr.length] ?? '';
}
function titleish(key: string): boolean {
  return /(title|name|heading|headline|label|question)/i.test(key);
}
function imageValue(f: FieldSchema, i: number): { url: string; alt: string; description: string } {
  return { url: '', alt: `${f.label || 'Image'} ${i + 1}`, description: '' };
}

function placeholder(f: FieldSchema, i: number): unknown {
  switch (f.kind) {
    case 'richtext':
      return pick(SAMPLE_PARAS, i);
    case 'number':
      return /price/i.test(f.key) ? 24 + i * 10 : i + 1;
    case 'boolean':
      return i % 2 === 0;
    case 'date':
      return '2026-01-15';
    case 'option':
      return f.cardinality === 'array' ? ['Sample', 'Tag'] : 'Sample';
    case 'reference':
      return f.cardinality === 'array' ? [`${f.label} A`, `${f.label} B`] : `${f.label}`;
    case 'image':
      return imageValue(f, i);
    case 'images':
      return [0, 1, 2].map((k) => imageValue(f, k));
    case 'file':
      return { url: '', name: `${f.label || 'file'}.pdf` };
    case 'group':
      return buildRecord(f.fields ?? [], i);
    case 'list':
      return [0, 1].map((k) => buildRecord(f.fields ?? [], k));
    case 'text':
    default:
      return titleish(f.key) ? pick(SAMPLE_TITLES, i) : pick(SAMPLE_LINES, i);
  }
}

function buildRecord(fields: FieldSchema[], i: number): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const f of fields) rec[f.key] = placeholder(f, i);
  return rec;
}

function setAtPath(root: DataSources, dottedKey: string, value: unknown): void {
  const segs = dottedKey.split('.');
  let cursor = root as Record<string, unknown>;
  for (let i = 0; i < segs.length - 1; i += 1) {
    const seg = segs[i] ?? '';
    const next = cursor[seg];
    if (typeof next !== 'object' || next === null) cursor[seg] = {};
    cursor = cursor[seg] as Record<string, unknown>;
  }
  cursor[segs[segs.length - 1] ?? ''] = value;
}

/** The tenant's REAL brand identity, shaped exactly like the storefront's
 *  `site.identity` resolver root (apps/site `siteRoot`) — name, tagline, and both
 *  logos. Overlaid onto the placeholder preview data so the canvas header matches the
 *  live/published site instead of showing a generic placeholder.
 *
 *  Must stay field-for-field in step with `siteRoot()` and with `SITE_SOURCES`: the
 *  picker offering a field is a promise that it resolves, and a field the canvas
 *  resolves but the storefront doesn't (or vice versa) makes the editor lie. */
export interface SiteIdentityPreview {
  name: string;
  /** `null`, not '': an empty string is a known-but-empty value that the resolver
   *  fills over the authored content, blanking the node. */
  tagline: string | null;
  logo: { url: string; alt: string } | null;
  logoDark: { url: string; alt: string } | null;
}

/** The tenant's REAL site-chrome data — the `site.*` resolver roots the storefront
 *  loads (apps/site loadSiteData): brand identity + social links. Overlaid onto the
 *  synthetic preview data so the canvas's header AND footer chrome match the live
 *  site instead of binding to generic placeholders. */
export interface SitePreviewData {
  identity: SiteIdentityPreview;
  social: { platform: string; url: string }[];
}

/** Build placeholder data shaped to the catalog so every offered path resolves:
 *  an array source → 3 placeholder records; a record source → one. When the real
 *  tenant `site` chrome is supplied it overrides the synthetic `site.identity` +
 *  `site.social`, so the header (Logo/Wordmark) and footer (SocialLinks) preview
 *  the actual brand/links (parity with the live site) instead of placeholder text. */
export function buildPreviewData(
  sources: DataSource[],
  site?: SitePreviewData | null
): DataSources {
  const root: DataSources = {};
  for (const s of sources) {
    const value =
      s.cardinality === 'array'
        ? [0, 1, 2].map((i) => buildRecord(s.fields, i))
        : buildRecord(s.fields, 0);
    setAtPath(root, s.key, value);
  }
  // Real chrome wins over the placeholder. Set even when the page catalog has no
  // `site.*` source (the page editor's locked chrome still binds them), so
  // /builder/page's header + footer resolve too. `site.social` is overwritten even
  // when empty — an empty array lets SocialLinks fall back to its own clean
  // placeholder icons instead of the synthetic record garbage.
  if (site) {
    setAtPath(root, 'site.identity', site.identity);
    setAtPath(root, 'site.social', site.social);
  }
  return root;
}
