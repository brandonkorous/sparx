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

/** A sparx `FieldSchema` → a silica nested `DataSource`. The field's own `key`
 *  is kept verbatim (scope-relative); `group`/`list` fields recurse so their
 *  inner fields become pickable once a repeat ancestor scopes them. */
function fieldToSilica(field: FieldSchema): SilicaDataSource {
  const out: SilicaDataSource = {
    key: field.key,
    label: field.label,
    cardinality: field.cardinality,
  };
  if (field.fields && field.fields.length > 0) {
    return { ...out, fields: field.fields.map(fieldToSilica) };
  }
  return out;
}

/** A sparx catalog `DataSource` → a silica top-level `DataSource`. The source's
 *  root `key` (e.g. `commerce.product`) is the ref a scope/collection node
 *  carries; its fields are scope-relative. */
function sourceToSilica(source: DataSource): SilicaDataSource {
  return {
    key: source.key,
    label: source.label,
    cardinality: source.cardinality,
    fields: source.fields.map(fieldToSilica),
  };
}

/** Project a sparx binding catalog (`BindingCatalog.sources` — the tenant CMS
 *  types via `mapCmsContentType` plus the code-defined COMMERCE/CRM/SITE/EMAIL
 *  sources) onto silica's `DataSource[]`, ready to return from a `BuilderHost`'s
 *  `dataSources()`. The engine's `scopeAt` derives per-node availability from it. */
export function toSilicaDataSources(sources: readonly DataSource[]): SilicaDataSource[] {
  return sources.map(sourceToSilica);
}
