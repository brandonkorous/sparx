// The sparx binding catalog → silica's `DataSource[]` (docs/118 §4, Stage 3).
//
// silicaui-builder's built-in binding picker (`DataSection` → `flattenSources` /
// `scopeAt`) is driven by ONE flat catalog the host computes once. Its model is
// SCOPE-RELATIVE: a node that establishes a scope (a `collection` bind) carries
// `data.ref === <source key>`; a value node beneath it carries `data.ref ===
// <field's own key>`, resolved against the innermost `scope.item`. `scopeAt`
// narrows the pickable fields at each level by matching an ancestor collection's
// `ref` against a source `key` (recursively into `fields`).
//
// sparx's own `binding.ts` catalog (`DataSource` / `FieldSchema`) already carries
// exactly the shape silica needs — a source with a root `key` and typed,
// cardinality-tagged `fields` (with nested `fields` for group/list). So the map
// is a near-mechanical projection:
//   · a top-level source's silica `key` = sparx `source.key` (`commerce.product`,
//     `product`, `site.identity`, `cms.blog_post`) — the ref a scope node carries.
//   · a nested field's silica `key` = the field's OWN key (`title`, `items`) —
//     scope-relative, resolved against `scope.item` by `createSilicaResolver`.
//   · cardinality passes through 1:1 (`scalar` | `array` | `object`).
//
// The keys this emits are precisely the refs `decodeBindingRef` +
// `createSilicaResolver` consume, so picker → engine `scopeAt` → resolver all
// agree on one vocabulary (the coupling silica's `data-sources.ts` documents).

import type { DataSource as SilicaDataSource } from '@wizeworks/silicaui-html';

import type { DataSource, FieldSchema } from './binding';

/** A sparx `FieldSchema` → a silica nested `DataSource`. The field's own `key` is
 *  kept verbatim (scope-relative); `group`/`list` fields recurse so their inner
 *  fields become pickable once a repeat ancestor scopes them. `prefix` qualifies the
 *  emitted keys for an AMBIENT source (see `sourceToSilica`), where there is no
 *  ancestor scope to resolve a bare key against. */
function fieldToSilica(field: FieldSchema, prefix = ''): SilicaDataSource {
  const key = prefix ? `${prefix}.${field.key}` : field.key;
  const out: SilicaDataSource = {
    key,
    label: field.label,
    cardinality: field.cardinality,
  };
  if (field.fields && field.fields.length > 0) {
    return { ...out, fields: field.fields.map((f) => fieldToSilica(f, key)) };
  }
  return out;
}

/** A sparx catalog `DataSource` → a silica top-level `DataSource`. The source's
 *  root `key` (e.g. `commerce.product`) is the ref a scope/collection node carries; its
 *  fields are emitted FULLY-QUALIFIED under it (`commerce.product.title`).
 *
 *  Qualification is not cosmetic — a bare field key is not a ref, it's a ref FRAGMENT,
 *  and that breaks two ways:
 *   1. AMBIGUOUS. The picker's option `value` IS the ref, and silica keys its options by
 *      that value. Bare keys are unique only WITHIN a source, so the moment two sources
 *      share a field shape — `commerce.product` / `commerce.featured` / `commerce.new` /
 *      `commerce.related` / `product` all carry PRODUCT_FIELDS — the catalog emits
 *      `title` five times: five colliding React keys, and five options that all mean the
 *      same thing. (Real catalog before this: 88 options, 21 duplicate keys, 67 collisions.)
 *   2. UNRESOLVABLE at the root. `logo` resolves against `root.logo` — nothing. That is
 *      exactly how binding a tenant logo onto a wordmark silently blanked it (docs/122).
 *
 *  A qualified key is unique AND resolves at the root. Inside a repeat it is still correct:
 *  `resolveBinding` tolerates the source prefix when a scope is active (see
 *  `silica-resolve`), so `commerce.product.title` under a product repeat resolves against
 *  `scope.item`. Bare refs (code-authored composites, trees authored before this) keep
 *  working through the same path. */
function sourceToSilica(source: DataSource): SilicaDataSource {
  return {
    key: source.key,
    label: source.label,
    cardinality: source.cardinality,
    fields: source.fields.map((f) => fieldToSilica(f, source.key)),
  };
}

/** Project a sparx binding catalog (`BindingCatalog.sources` — the tenant CMS
 *  types via `mapCmsContentType` plus the code-defined COMMERCE/CRM/SITE/EMAIL
 *  sources) onto silica's `DataSource[]`, ready to return from a `BuilderHost`'s
 *  `dataSources()`. The engine's `scopeAt` derives per-node availability from it. */
export function toSilicaDataSources(sources: readonly DataSource[]): SilicaDataSource[] {
  return sources.map(sourceToSilica);
}
