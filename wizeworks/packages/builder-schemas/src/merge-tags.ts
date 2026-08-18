// Merge-tag discoverability (docs/52 §7, docs/91 §2) — the single source of truth
// for "what `{{token}}` can I type here?", shared by every consumer:
//   · the inline `{{` autocomplete in the Email Builder's text fields,
//   · the "Merge tags" reference panel,
//   · the MCP `list_merge_tags` tool (so an agent authoring an email knows the
//     vocabulary).
//
// A merge tag is one OBJECT-source field flattened to its `{{source.field}}` token
// (`{{site.name}}`, `{{customer.firstName}}`). ARRAY sources (products, posts, line
// items) are ITERATED through a repeater binding, so their fields are `item.*`
// inside that loop — never standalone tokens — and are intentionally excluded here.
//
// Pure functions + types (no zod, no DB, no React), like the rest of `binding.ts` /
// `email-tokens.ts` — client + server + MCP safe.

import {
  EMAIL_CATALOG,
  EMAIL_PERSONALIZED_ROOTS,
  type BindingCatalog,
  type FieldKind,
} from './binding';
import { SAMPLE_EMAIL_DATA } from './email-tokens';
import { resolvePath } from './runtime';

/** One discoverable merge token, with everything the UI + MCP need to present it. */
export interface MergeTag {
  /** The full insertable token, braces included: `{{site.name}}`. */
  token: string;
  /** The dotted source path: `site.name`. */
  path: string;
  /** Friendly two-part label: `Site › Name`. */
  label: string;
  /** The source this field belongs to (for grouping). */
  source: { key: string; label: string; module: string };
  /** The field's own label: `Name`. */
  field: string;
  /** When the value is known: `per-send` (site / products / promotion — resolved
   *  once) vs `per-recipient` (customer / order / cart / … — resolved per send). */
  scope: 'per-send' | 'per-recipient';
  /** A representative sample value from the editor sample data, when one is useful
   *  (e.g. `Alex` for `customer.firstName`). Display gloss only — omitted for URLs
   *  and any field with no plain-text sample. */
  sample?: string;
}

export interface MergeTagOptions {
  /** Sample data the per-tag preview values come from (default: the email sample). */
  sampleData?: Record<string, unknown>;
  /** Source keys resolved per recipient (default: the email personalized roots). */
  personalizedRoots?: readonly string[];
  /** Source keys to omit (e.g. the historical `recipient` alias of `customer`). */
  excludeKeys?: readonly string[];
}

// Only scalar text-ish fields become flat tokens. `image`/`images`/`file` are
// asset bindings; `list`/`group` are repeaters/objects (bound, not interpolated);
// `number`/`boolean`/`date`/`option`/`reference` don't occur on the email sources
// (every email field is display-ready text) but are excluded for safety.
const FLAT_TOKEN_KINDS: ReadonlySet<FieldKind> = new Set<FieldKind>(['text', 'richtext']);

/** A plain-text sample for `path` from `data`, or undefined when there's no useful
 *  one. The `#` placeholder URLs in the sample data aren't worth previewing. */
function sampleValue(data: Record<string, unknown>, path: string): string | undefined {
  const v = resolvePath({ root: data }, path);
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v === '#' || v === '' ? undefined : v;
  return undefined;
}

/** Flatten a binding catalog's OBJECT sources into the merge tags an author can
 *  type. The order follows the catalog (source order, then field order), so the
 *  reference panel reads in the same order everywhere. */
export function catalogMergeTags(catalog: BindingCatalog, opts: MergeTagOptions = {}): MergeTag[] {
  const sampleData = opts.sampleData ?? SAMPLE_EMAIL_DATA;
  const personalized = new Set(opts.personalizedRoots ?? EMAIL_PERSONALIZED_ROOTS);
  const excluded = new Set(opts.excludeKeys ?? []);
  const out: MergeTag[] = [];
  for (const source of catalog.sources) {
    if (source.cardinality !== 'object') continue; // array sources iterate (item.*)
    if (excluded.has(source.key)) continue;
    const scope: MergeTag['scope'] = personalized.has(source.key) ? 'per-recipient' : 'per-send';
    for (const field of source.fields) {
      if (!FLAT_TOKEN_KINDS.has(field.kind)) continue;
      const path = `${source.key}.${field.key}`;
      const sample = sampleValue(sampleData, path);
      out.push({
        token: `{{${path}}}`,
        path,
        label: `${source.label} › ${field.label}`,
        source: { key: source.key, label: source.label, module: source.module },
        field: field.label,
        scope,
        ...(sample !== undefined ? { sample } : {}),
      });
    }
  }
  return out;
}

/** The Email Builder's merge tags — the code-defined email sources flattened. The
 *  per-tenant catalog merges in CMS COLLECTION sources, but those are arrays
 *  (iterated, not flat tokens), so the flat token list is the constant email set.
 *  The historical `recipient` alias is hidden in favor of canonical `customer.*`. */
export function emailMergeTags(): MergeTag[] {
  return catalogMergeTags(EMAIL_CATALOG, {
    sampleData: SAMPLE_EMAIL_DATA,
    personalizedRoots: EMAIL_PERSONALIZED_ROOTS,
    excludeKeys: ['recipient'],
  });
}

/** Group merge tags by source, preserving first-seen order — the reference panel +
 *  autocomplete render section headers from this. */
export function groupMergeTags(
  tags: MergeTag[]
): { source: MergeTag['source']; tags: MergeTag[] }[] {
  const order: string[] = [];
  const map = new Map<string, { source: MergeTag['source']; tags: MergeTag[] }>();
  for (const tag of tags) {
    let group = map.get(tag.source.key);
    if (!group) {
      group = { source: tag.source, tags: [] };
      map.set(tag.source.key, group);
      order.push(tag.source.key);
    }
    group.tags.push(tag);
  }
  return order.map((key) => map.get(key)!);
}

// ── Inline-autocomplete caret helpers (pure, so they're unit-tested here rather
//    than in the dashboard's Playwright-only suite) ────────────────────────────

/** The `{{…}}` token being typed at `caret`, if any: the slice from the nearest
 *  unclosed `{{` to the caret, with the path fragment after it. Returns null when
 *  the caret isn't inside an open token, or the fragment isn't a bare path (a space
 *  or a `?? "fallback"` clause ends path autocompletion). */
export function findTokenQuery(
  value: string,
  caret: number
): { start: number; query: string } | null {
  const before = value.slice(0, Math.max(0, caret));
  const open = before.lastIndexOf('{{');
  if (open === -1) return null;
  const between = before.slice(open + 2);
  if (between.includes('}}')) return null; // the token already closed before the caret
  const query = between.replace(/^\s+/, '');
  if (!/^[\w.]*$/.test(query)) return null; // a space / `??` fallback ends the path
  return { start: open, query };
}

/** Replace the in-progress `{{`+fragment (`start`..`caret`) with the full
 *  `{{path}}` token. Returns the new string + the caret position after the token. */
export function insertMergeTag(
  value: string,
  start: number,
  caret: number,
  path: string
): { value: string; caret: number } {
  const token = `{{${path}}}`;
  const next = value.slice(0, start) + token + value.slice(caret);
  return { value: next, caret: start + token.length };
}

/** Filter + rank merge tags for an autocomplete/search `query` — matches path or
 *  label case-insensitively, a path-prefix match ranking first. Empty query → all
 *  tags in catalog order. */
export function filterMergeTags(tags: MergeTag[], query: string): MergeTag[] {
  const q = query.trim().toLowerCase();
  if (q === '') return tags;
  const scored: { tag: MergeTag; rank: number }[] = [];
  for (const tag of tags) {
    const path = tag.path.toLowerCase();
    let rank = -1;
    if (path.startsWith(q)) rank = 0;
    else if (path.includes(q)) rank = 1;
    else if (tag.label.toLowerCase().includes(q)) rank = 2;
    if (rank >= 0) scored.push({ tag, rank });
  }
  scored.sort((a, b) => a.rank - b.rank);
  return scored.map((s) => s.tag);
}
