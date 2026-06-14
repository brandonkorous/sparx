# 43 — Builder: The Binding Schema (the keystone)

Version: 1.0
Author: Brandon Korous
Last Updated: 2026-06-02

> The composition model ([40](40-sitebuilder-composition-model.md)) calls a typed,
> introspectable schema "the keystone that powers it all." This doc defines that
> schema for the Builder — the contract that tells the editor **what a page can
> bind to** — and how it's derived from each module's real data. It builds on the
> persistence slice ([41](41-builder-page-model.md)); it does NOT touch the legal
> work in [42](42-legal-and-consent.md).

## 1. The problem

The `/builder` editor's binding picker and canvas preview are hardcoded mock
(`BIND_PATHS` / `ITEM_PATHS` / `SAMPLE_DATA`). To make Tier-2 components "point at
real data," the editor must offer the tenant's **actual** bindable sources — their
CMS content types, their Commerce product shape, their CRM lists — with each field's
**type and cardinality**, because cardinality drives single-vs-iterate and type
gates which component can bind where.

## 2. The contract — `BindingSchema`

A read-only, computed description (TS types, not persisted — so no Zod/migration):

```
BindingCatalog { sources: DataSource[] }   // named to avoid clashing with the
                                           // per-node BindingSchema in node.ts

DataSource {
  key:         string         // binding ROOT path — 'cms.post' (a list) or 'post' (one record)
  label:       string         // "Blog posts" / "Blog post"
  module:      'cms' | 'commerce' | 'crm'
  cardinality: 'array' | 'object'   // array → iterate; object → render-once + set scope
  recordType:  string         // 'post', 'product', 'list'
  fields:      FieldSchema[]
}

FieldSchema {
  key:         string         // 'title', 'cover', 'images'
  label:       string
  kind:        'text' | 'richtext' | 'number' | 'boolean' | 'date' | 'option'
             | 'reference' | 'image' | 'images' | 'file' | 'group' | 'list'
  cardinality: 'scalar' | 'object' | 'array'
  fields?:     FieldSchema[]   // group (object) / list (repeater) nesting
}
```

**Path convention.** A content type `<key>` yields up to two sources: a **collection**
(`cms.<key>`, cardinality `array` — for grids that iterate) and a **record**
(`<key>`, cardinality `object` — for a collection-page template bound to one record).
Fields resolve as `item.<field>` inside an iterating/scope container, or `<key>.<field>`
in a record-bound template. Singleton types emit only the record source.

## 3. Module ownership (docs/40 §5 — "who defines the schema differs")

- **CMS** — the LAYOUT/content type defines the fields. Sources are derived per-tenant
  from `content_types.schemaJson` (a `FieldDef[]`). This is the dynamic part.
- **Commerce** — the DOMAIN owns the schema (title/price/images/description/…). A
  **code-defined** `COMMERCE_SOURCES` constant; the layout binds, never invents.
- **CRM** — code-defined `CRM_SOURCES` (the newsletter list, etc.).

### CMS `FieldDef.type` → `FieldSchema.kind`

| FieldDef.type                         | kind               | cardinality                    |
| ------------------------------------- | ------------------ | ------------------------------ |
| text / long_text / slug / url / email | `text`             | scalar                         |
| rich_text                             | `richtext`         | scalar                         |
| number                                | `number`           | scalar                         |
| boolean                               | `boolean`          | scalar                         |
| date / datetime                       | `date`             | scalar                         |
| enum                                  | `option`           | scalar (array if `multiple`)   |
| reference                             | `reference`        | scalar (array if `multiple`)   |
| asset                                 | `image` / `images` | scalar / array (by `multiple`) |
| object                                | `group`            | object (nested `fields`)       |
| repeater                              | `list`             | array (nested `fields`)        |

The `kind` is what the editor uses (next phase) to gate bindings: Heading/Text →
`text`/`richtext`, PriceTag → `number`, ImageDisplay → `image`/`images`, an iterating
container → an `array` source or a `list` field.

## 4. Where the logic lives

- **`@sparx/builder-schemas`** (zod-free TS): the `DataSource`/`FieldSchema` types, the
  pure `mapCmsContentType(ct) → DataSource[]` mapper (accepts a structural CMS-field
  shape — no dependency on `@sparx/cms-schemas`), and the code-defined `COMMERCE_SOURCES`
  / `CRM_SOURCES`.
- **`@sparx/builder`** — `bindingService.getSchema(ctx)`: reads the tenant's content
  types (`withTenant` → `tx.contentType`, a read-only cross-module introspection — the
  builder must know what types exist to offer them), maps them, and concatenates the
  code-defined Commerce/CRM sources.
- **api-rest** — `GET /v1/builder/binding-schema` → `bindingService.getSchema`. Gated
  on the `site` flag like the rest of `/v1/builder/*`.

## 5. Phasing

- **Phase 1a (this slice):** the contract + mapper + `bindingService` + the endpoint.
  Backend-only, independently verifiable (curl returns the tenant's real content types
  as sources). No editor change.
- **Phase 1b (next):** the editor consumes it — the inspector binding picker is built
  from `sources`/fields, and the canvas preview renders typed **placeholder** values
  derived from the schema (`buildPreviewData(sources)`), replacing `BIND_PATHS` /
  `ITEM_PATHS` / `SAMPLE_DATA`. Real sample records (vs. placeholders) come later.
- **Later:** component↔kind binding gates; the site render path resolving real
  records ([41](41-builder-page-model.md) deferred item).
