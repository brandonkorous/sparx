# Handoff Spec — Declarative Custom Section Template Language (doc 38 Phase C)

**Version:** 1.0.1
**Author:** Brandon Korous
**Last Updated:** 2026-06-01
**Resolves:** [docs/38](../38-sitebuilder-extensible-sections.md) §4.3 + open question #1

---

## 1. What this resolves

Doc 38 establishes that letting tenants add components without a deploy reduces to one problem: **what
replaces the React renderer for a user-authored section.** Steps 1–3 and 5 of the add-a-section chain are
already data or trivial dispatch ([docs/38](../38-sitebuilder-extensible-sections.md) §1.1). This spec answers
the renderer question concretely and locks doc 38's open question #1 (bespoke AST vs. a string templating
grammar).

**Decision: a typed JSON component AST, interpreted server-side — not a string templating grammar.**

Rationale:

- **Token enforcement is structural.** Every styleable prop is a closed enum that maps to a `data-*` attribute
  on a fixed `sf-tpl-*` class. There is no path from definition data to a raw color, size, or class string.
  The brand rule (token-only, no Tailwind, [docs/37](../37-sitebuilder-section-system.md) §6,
  [[feedback_sparx_ui_decisions]]) is guaranteed by construction, not by review.
- **It is validatable + versionable.** The template is data with a Zod schema — author-time validation rejects
  unknown nodes/props/paths; versions diff and migrate.
- **It is SSR-safe.** The interpreter is a pure `AST → React element` walk over a closed primitive set. No HTML
  parsing, no `dangerouslySetInnerHTML` except sanitized RichText, no user code executes.

A string grammar (Liquid/Handlebars-style) would invert all three: arbitrary markup to sanitize after the
fact, classes/styles a tenant could inject, and a parser to harden.

---

## 2. How it plugs into the as-built system

The interpreter does **not** replace the existing code-section path — it extends it.

- **Registry merge.** `getSectionDefinition(type)` / `sectionsForTarget(targetId)`
  ([section-registry.ts](../../packages/sitebuilder-schemas/src/section-registry.ts)) consult the static
  `SECTION_REGISTRY` first, then the tenant's custom definitions (resolved with tenant context). A custom def
  yields a `SectionDefinition` whose `schema` is **derived** from its field spec (§6) and whose render is the
  interpreter, not a React component.
- **Dispatch.** [section-renderer.tsx](../../apps/storefront/components/section-renderer.tsx) gains one branch:
  a code `sectionType` hits the existing component map; a `custom:*` type is interpreted. The existing
  "skip unknown type" behavior stays as the final fallback.
- **Validation.** `parseSectionConfig` is unchanged in contract — it still validates + defaults config against
  a Zod schema; only the schema's _origin_ differs (derived vs. authored).
- **Snapshots.** Publishing pins the definition into the `SiteVersion` (§8) so render is deterministic.

The custom section stays inside the flat-stack model — one block, not a nesting mechanism — and on the
storefront's own CSS surface (it never consumes `@sparx/ui`).

---

## 3. The AST

A template is a single root node. Every node is `{ "type": <NodeType>, ...props, "children"?: Node[] }`.
The node set is **closed** — additive only by the platform.

### 3.1 Layout primitives

| Node    | Props (all enums → `data-*`)                                                                                                                  | Compiles to                                                                      |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `Stack` | `dir` col\|row · `gap` none\|xs\|sm\|md\|lg\|xl · `align` start\|center\|end\|stretch · `justify` start\|center\|end\|between · `wrap` bool   | `sf-tpl-stack[data-*]`                                                           |
| `Grid`  | `cols` 1\|2\|3\|4 · `gap`                                                                                                                     | `sf-tpl-grid[data-cols][data-gap]` (collapses 4/3→2→1 at the panels breakpoints) |
| `Box`   | `pad` none\|sm\|md\|lg\|xl · `tone` none\|surface\|subtle\|inverse\|brand-tint\|accent-tint · `radius` none\|sm\|md\|lg\|pill · `border` bool | `sf-tpl-box[data-*]`                                                             |

### 3.2 Content primitives

| Node       | Props                                                                                                           | Compiles to                                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `Heading`  | `level` 1\|2\|3 · `text` _value-expr_                                                                           | `<h1\|h2\|h3 class="sf-h{level}">` (reuses existing type scale)                                                                        |
| `Text`     | `text` _value-expr_ · `tone` default\|secondary\|muted · `size` sm\|md\|lg                                      | `<p class="sf-tpl-text" data-*>`                                                                                                       |
| `RichText` | `html` _value-expr_ (must reference a `richtext` field)                                                         | `<div class="sf-prose">` — **sanitized**                                                                                               |
| `Image`    | `src` _value-expr_ (media ref) · `alt` _value-expr_ · `ratio` auto\|1:1\|4:3\|16:9\|21:9 · `fit` cover\|contain | `<img class="sf-tpl-img" data-*>` — `src` resolved via the storefront media resolver                                                   |
| `Icon`     | `name` _value-expr_ (allowlisted lucide name) · `size` sm\|md\|lg · `tone`                                      | inline SVG from the bundled lucide subset, `sf-tpl-icon[data-*]`                                                                       |
| `Button`   | `label` _value-expr_ · `url` _value-expr_ · `variant` solid\|light\|dark\|ghost\|link                           | `SbLink` + `sf-btn sf-btn--{variant}` (the exact CTA mapping in [\_shared.tsx](../../apps/storefront/components/sections/_shared.tsx)) |
| `Link`     | `label` · `url`                                                                                                 | `SbLink` + `sf-tpl-link`                                                                                                               |
| `Divider`  | —                                                                                                               | `<hr class="sf-tpl-divider">`                                                                                                          |
| `Spacer`   | `size` sm\|md\|lg\|xl                                                                                           | `sf-tpl-spacer[data-size]`                                                                                                             |

### 3.3 Data / control

- **`Repeater`** — `{ "type":"Repeater", "each":"<listFieldKey>", "children":[...] }`. Iterates a `list` field;
  inside `children`, `item.<k>` resolves to the current item's fields and `index` to its 0-based position.
  Hard cap: 50 iterations (defensive; logged if exceeded).
- **`If`** — `{ "type":"If", "test":<condition>, "children":[...], "else"?:[...] }`. The condition ceiling is a
  single test — no boolean algebra, no arithmetic:
  - `{ "$exists": "<path>" }` — true when the resolved value is non-empty.
  - `{ "$eq": ["<path>", <literal>] }` — equality.

### 3.4 Embed (gated)

- **`Embed`** — `url` · `title` · `ratio`. Host **allowlist-validated** at author time and publish; renders a
  sandboxed `<iframe>`. Ships only once the embed allowlist + CSP `frame-src` work lands
  ([docs/37](../37-sitebuilder-section-system.md) §9). Not in the Phase C spike.

---

## 4. Value expressions — the binding surface

A prop value is one of exactly three shapes:

```jsonc
"Shop now"                                              // literal
{ "$bind": "field.heading", "default": "", "format": "none" }   // bound
{ "$concat": ["From ", { "$bind": "field.price", "format": "money" }, "/mo"] }  // mixed text
```

`format` is a **closed** named set: `none | money | number | date`. No other transforms exist.

Paths resolve against a fixed scope; **any other path is an author-time validation error** and resolves to
empty at render (defensive):

| Path prefix                                  | Resolves to                        | Available when                                   |
| -------------------------------------------- | ---------------------------------- | ------------------------------------------------ |
| `field.<key>`                                | the section's own validated config | always                                           |
| `item.<key>`                                 | the current `Repeater` item        | inside a `Repeater`                              |
| `index`                                      | current `Repeater` index (0-based) | inside a `Repeater`                              |
| `ctx.currency` `ctx.locale` `ctx.tenantSlug` | read-only render context           | always                                           |
| `product.<key>` / `collection.<key>`         | the bound item                     | only when the definition declares that `binding` |

**No function calls, no operators, no arbitrary expressions.** A variant prop (e.g. `Grid.cols`) _may_ be
bound, but the resolved value must be a valid enum token or the interpreter falls back to the prop's default.

---

## 5. The CSS contract (`sf-tpl-*`)

The interpreter emits **only** the closed `sf-tpl-*` family plus the existing `sf-*` classes it reuses
(`sf-h1/2/3`, `sf-prose`, `sf-btn--*`, `sf-cta-row`). The family is defined **once** in
[storefront.css](../../apps/storefront/app/storefront.css), every value reading a `--sf-*` token — identical
to how `sf-sb-panels[data-cols]` / `sf-sb-hero[data-height]` already work. Consequences:

- Tenant `StorefrontTheme` overrides + light/dark cascade in automatically (token-driven).
- It is ESLint-clean (no Tailwind utilities, the storefront's standing rule).
- A tenant **cannot** express an off-token color, arbitrary spacing, or a raw class — the prop enums are the
  only inputs, and they map to `data-*` attributes the CSS interprets.

Token mapping examples (the full table ships with the CSS):

```
[data-gap]   xs→--sf-space-2  sm→--sf-space-3  md→--sf-space-4  lg→--sf-space-6  xl→--sf-space-10
[data-pad]   sm→--sf-space-4  md→--sf-space-6  lg→--sf-space-8  xl→--sf-space-12
[data-tone]  surface→--sf-surface  subtle→--sf-bg-subtle  inverse→(--sf-base-content / --sf-base-100)
             brand-tint→--sf-primary-tint  accent-tint→--sf-accent-tint
[data-radius] sm→--sf-radius-field  md→--sf-radius-box  pill→--sf-radius-selector
```

The only inline style any node emits is a resolved background/`<img src>` URL (the established Hero/banner
pattern) — never a color or layout value.

---

## 6. Deriving the validator from the field spec

Custom sections do not hand-write Zod. A compiler maps `SectionField[] → ZodType` so `parseSectionConfig`
validates + defaults custom configs exactly like code sections:

| `SectionFieldType`           | Derived Zod                                              |
| ---------------------------- | -------------------------------------------------------- |
| `text` `textarea` `richtext` | `z.string().max(…)` (sanitized at render for `richtext`) |
| `url`                        | bounded string (internal `/x` or `https://…`)            |
| `select`                     | `z.enum(options)`                                        |
| `number` `range`             | `z.number().min(min).max(max)`                           |
| `boolean`                    | `z.boolean()`                                            |
| `color` `font`               | token-key enum (never a raw value)                       |
| `media`                      | `MediaRef` (id or URL — reuses `common.ts`)              |
| `collection` `products`      | id / id-array refs                                       |
| `list`                       | `z.array(<derived from itemFields>).max(…)`              |

This is the same field system the dashboard already renders forms from ([fields.ts](../../packages/sitebuilder-schemas/src/fields.ts)),
so a custom section's inspector form is free.

---

## 7. Worked example — `custom:icon-grid`

A genuinely new section (not a stock type): a row of N items, each an icon + title + blurb.

**Field spec** (authored once per definition):

```jsonc
[
  { "key": "heading", "label": "Heading", "type": "text" },
  {
    "key": "columns",
    "label": "Columns",
    "type": "select",
    "options": [
      { "label": "Two", "value": "2" },
      { "label": "Three", "value": "3" },
      { "label": "Four", "value": "4" },
    ],
  },
  {
    "key": "items",
    "label": "Features",
    "type": "list",
    "itemLabel": "Feature",
    "itemFields": [
      { "key": "icon", "label": "Icon", "type": "text", "help": "A lucide icon name" },
      { "key": "title", "label": "Title", "type": "text" },
      { "key": "body", "label": "Text", "type": "textarea" },
    ],
  },
]
```

**Template AST:**

```jsonc
{
  "type": "Stack",
  "gap": "lg",
  "children": [
    {
      "type": "If",
      "test": { "$exists": "field.heading" },
      "children": [{ "type": "Heading", "level": 2, "text": { "$bind": "field.heading" } }],
    },
    {
      "type": "Grid",
      "cols": { "$bind": "field.columns" },
      "gap": "lg",
      "children": [
        {
          "type": "Repeater",
          "each": "items",
          "children": [
            {
              "type": "Stack",
              "gap": "sm",
              "children": [
                {
                  "type": "Icon",
                  "name": { "$bind": "item.icon" },
                  "size": "lg",
                  "tone": "accent",
                },
                { "type": "Heading", "level": 3, "text": { "$bind": "item.title" } },
                { "type": "Text", "text": { "$bind": "item.body" }, "tone": "secondary" },
              ],
            },
          ],
        },
      ],
    },
  ],
}
```

**A tenant's config** (validated by the derived Zod, stored as `SiteSection.config` JSON):

```jsonc
{
  "heading": "Why fleets choose us",
  "columns": "3",
  "items": [
    { "icon": "wrench", "title": "On-site service", "body": "We come to your yard." },
    { "icon": "clock", "title": "24/7 dispatch", "body": "Day or night, every day." },
    { "icon": "shield-check", "title": "2-year warranty", "body": "Parts and labor covered." },
  ],
}
```

**Emitted HTML** (abridged — note: only `sf-tpl-*`/`sf-*` classes + `data-*`, zero inline style):

```html
<div class="sf-tpl-stack" data-gap="lg">
  <h2 class="sf-h2">Why fleets choose us</h2>
  <div class="sf-tpl-grid" data-cols="3" data-gap="lg">
    <div class="sf-tpl-stack" data-gap="sm">
      <span class="sf-tpl-icon" data-size="lg" data-tone="accent"><svg>…wrench…</svg></span>
      <h3 class="sf-h3">On-site service</h3>
      <p class="sf-tpl-text" data-tone="secondary">We come to your yard.</p>
    </div>
    <!-- …two more items… -->
  </div>
</div>
```

The tenant authored a new section type, themed correctly on any tenant palette, with **no deploy** — and
it renders identically forever once published (§8).

---

## 8. Snapshot pinning

At `publishNow`, for every `custom:*` section in the draft, the resolved definition is captured into the
`SiteVersion`. To avoid duplicating a definition used by many sections, store a sibling
`definitionsSnapshot: { "custom:icon-grid@3": { fieldSpec, template, binding } }` map and have each snapshot
section reference `slug@version`. The interpreter reads the **pinned** definition, never the live
`tenant_section_definitions` row.

Guarantees: editing or deleting the live definition does not alter a published page; rollback restores the
pinned definition exactly; a snapshot missing a referenced definition degrades via the existing "skip unknown"
path rather than crashing.

---

## 9. Bound custom sections

A definition may declare `binding: 'product' | 'collection'` (the same `TargetBinding` code sections use). It
is then allowed only in targets of that binding (the existing `isSectionAllowedInTarget` gate), and its
template may resolve `product.*` / `collection.*` paths against the bound item the renderer already supplies on
`SectionContext`. Everything else is identical.

---

## 10. Phase C spike — scope & exit criteria

**Build status (2026-06-01): COMPLETE — built + green end-to-end.** Every layer below is implemented,
typechecked, linted, and tested (schemas 70 tests, sitebuilder 37 tests incl. a definition-lifecycle +
publish-pinning integration test, storefront production build, dashboard typecheck/lint). The migration is
applied to local docker; prod applies via the DB Migrate pipeline on push.

**Ships (server-safe split per [[feedback_dockerfile_package_wiring]]):**

- ✅ `@sparx/sitebuilder-schemas` (zod-only, no React): the `SectionTemplate` AST schema, value-expression +
  condition schemas, the author-time validator, `fieldSpecToZod`, the pure evaluator
  (`resolveValue` / `evalCondition` / `resolveEnum` / formatters), **and `custom-section.ts`** — the
  `custom:<slug>` namespace, `toCustomSectionDefinition` (stored record → registry-shaped definition),
  the custom-aware lookups (`resolveSectionDefinition` / `parseSectionConfigWith` /
  `isSectionAllowedInTargetWith` / `mergedSectionsForTarget`), the `SectionField[]` CRUD schema, and the
  `SectionDefinitionInput` write contract. `CreateSectionInput.sectionType` now accepts code OR `custom:<slug>`.
- ✅ Storefront (React): the thin interpreter [`custom-template.tsx`](../../apps/storefront/components/sections/custom-template.tsx),
  the bundled icon subset, the `sf-tpl-*` CSS family ([`storefront-template.css`](../../apps/storefront/app/storefront-template.css)),
  **and the `SectionRenderer` `custom:*` branch** — it resolves a section's pinned template from
  `snapshot.definitions` (threaded through all four page routes) and renders it. Image node = token-driven
  background-image div, not `<img>`.
- ✅ `@sparx/db`: `TenantSectionDefinition` model + the hand-edited RLS migration
  `20260617000000_sitebuilder_section_definitions` (ENABLE+FORCE RLS + `tenant_isolation` policy per
  [[feedback_sparx_db_rls_pattern]]), plus a `definitions_snapshot` JSONB column on `sitebuilder_versions`.
- ✅ `@sparx/sitebuilder` service: `definition-service.ts` (CRUD + version bump + in-use delete guard +
  semantic `validateTemplate` on write), `section-service` validates/scope-checks `custom:<slug>` writes via
  the loaded tenant definitions, and `publishWithinTx` **pins** the referenced definitions into
  `definitionsSnapshot` (getDraftSnapshot pins too, for live preview). Rollback re-references live defs.
- ✅ Transports: REST `/v1/sitebuilder/definitions` (list/create/get/PUT/delete by slug), MCP read tools
  (`list_custom_sections`, `get_custom_section`) + write tools (`create_/update_/delete_custom_section`), and
  the public storefront endpoint passes `definitions` through verbatim.
- ✅ Dashboard editor: the section library merges the tenant's custom sections (a "Custom" badge), placing one
  works, and the inspector auto-renders its fields from the field spec.

**Exit (met):** a tenant (via API/MCP) defines `custom:icon-grid`, the dashboard auto-generates its inspector
form from the field spec, the tenant places + configures it, publishes, and it renders theme-correct on the
storefront — **no engineer, no deploy** — and a rollback reproduces it exactly (the integration test asserts the
publish pin + version).

**Deferred (own slices):** the visual template-authoring UI (a non-developer builds the AST — §11.2, aligns
with doc 38's "visual schema editor"); a dedicated `icon` `SectionFieldType` picker (§11.1); live-draft config
migration when a field spec changes under published pages (§11.3); client-island interactivity (§11.4).
Write-time richtext sanitization currently mirrors the existing rich-text section's trust model (the dashboard
editor sanitizes); a defensive server-side pass is a future hardening.

---

## 11. Remaining sub-questions

1. **Icon picker.** v1 takes a lucide name as `text`; a dedicated `icon` `SectionFieldType` (searchable picker,
   constrained to the bundled subset) is a clean follow-up.
2. **Section studio UX.** How a non-developer composes a template tree (visual primitive builder vs. guided
   form). Its own design slice; the AST + interpreter are authorable by API/MCP first regardless.
3. **Definition migration.** When a tenant changes a field spec under live + published pages — what migrates
   vs. stays pinned (§8 covers published; live drafts need a config-migration pass).
4. **Interactivity.** Custom sections are static (RSC) in v1; client-island custom sections (carousels, etc.)
   stay platform-only, consistent with [docs/37](../37-sitebuilder-section-system.md) §7 Phase E.
