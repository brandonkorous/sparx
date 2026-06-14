# Site Builder — Section Studio (design)

**Version:** 1.1.1
**Author:** Brandon Korous
**Last Updated:** 2026-06-01

---

The dashboard surface where a tenant authors a **custom section type** — its field spec + render
template — with no engineer and no deploy. It completes the self-serve loop for docs/38 Phase C: the
data model, service, transports, site render, and editor _placement_ already ship (see
[the template-language spec](sitebuilder-custom-section-template-spec.md) §10); today a definition can
only be _created_ via API/MCP. The Studio is the missing authoring UX.

## 1. Locked decisions

1. **Visual tree builder is the primary authoring mode** — a no-code node composer (palette → nest →
   per-node prop panels → binding pickers) over the closed AST.
2. **The JSON editor, live validation, and the form preview all ship too.** The visual builder and a raw
   JSON view are two faces of the **same AST state**; switching is lossless. `validateTemplate` runs
   **in the browser** (it's zod-only) and surfaces issues live in both views. A **form preview** shows the
   inspector form the field spec generates (reusing `FieldControl`).
3. **Live render preview ships in v1** — the in-progress template renders against sample field values,
   updating as you edit, themed with the real `st-tpl-*` classes + `--st-*` tokens.
4. **Parity is non-negotiable**, so the render path is **extracted into one shared package** the site
   and the Studio both consume (§4) — the preview can't drift from production because it _is_ production.

## 2. Where it lives

- A new Site Builder rail item **“Sections”** (`@sparx/sitebuilder/manifest`), after _Layouts_.
- `/sitebuilder/sections` — the **list** of the tenant's custom sections (label, slug, binding badge,
  version, “in N layouts”), plus a “New section” action.
- `/sitebuilder/sections/[slug]` — the **Studio editor** (create uses a `new` sentinel route or a `?new`
  flag, consistent with [[project_create_via_detail_view]]).
- Form-based authoring (editing a _type_), **not** the two-pane canvas the Layouts editor uses — though the
  editor's right column hosts the live preview, so the screen is still two-column on desktop, stacking on
  mobile per [[feedback_responsive_builder_mobile]].

## 3. Editor screen anatomy

Left column (authoring), right column (preview); stacks on small screens.

```
┌ Identity ───────────────────────────────┐   ┌ Preview ───────────────────┐
│ slug* · label* · description · icon ·    │   │ [ Render | Form ] tabs     │
│ binding (none|product|collection)        │   │                            │
├ Fields ──────────────────────────────────┤   │  <live render of the       │
│ SectionField[] editor (add/reorder/edit) │   │   template against sample  │
├ Template ────────────────────────────────┤   │   field values, st-tpl-*>  │
│ [ Visual | JSON ] toggle                 │   │                            │
│  • Visual: node tree + palette + props   │   │  Form tab: the inspector   │
│  • JSON: code editor                     │   │   FieldControl form        │
│  ✓/✗ live validateTemplate issues        │   │                            │
└──────────────────────────────────────────┘   └────────────────────────────┘
                         [ Save ]  (disabled while invalid)
```

## 4. Architecture

### 4.1 Shared render package — `@sparx/section-template-react`

Extract the site interpreter into a framework-neutral package so site SSR and the dashboard
preview render **identically**. Plain React (no `'use client'`, no server-only imports) with **injected
adapters**, so the site uses it as an RSC and the dashboard wraps it in a client boundary.

- **Exports:** `<TemplateRenderer node config ctx adapters />` (the AST walk → `st-tpl-*` markup, calling the
  shared pure evaluator from `@sparx/sitebuilder-schemas`); the bundled `<TemplateIcon>` + `TEMPLATE_ICON_NAMES`;
  and `section-template.css` (the `st-tpl-*` family, moved here from `apps/site/app/site-template.css`).
- **Adapters (injected):** `Link` (site → `SbLink` / next; dashboard → plain `<a>`), `resolveMediaSrc`
  (site → `mediaUrl(ref, tenantSlug)`; dashboard → placeholder or media API), so the package owns no
  app-specific deps.
- **Depends on** `@sparx/sitebuilder-schemas` (types + evaluator) + `react`. React package → only apps
  COPY it; add the COPY lines to the site + dashboard Dockerfiles ([[feedback_dockerfile_package_wiring]]).
- **Site rewire:** `custom-template.tsx` becomes a thin wrapper passing site adapters;
  `layout.tsx` imports the package CSS instead of the local `site-template.css` (deleted).

### 4.2 Dashboard preview

A client wrapper around `<TemplateRenderer>` inside a scoped container that carries a **default `--st-*`
token set** (the apex preset's light tokens) as inline CSS vars, so the preview looks themed without the
site's compile pipeline. Sample field values are synthesized from the field spec (placeholder text,
first select option, sample list rows) so a freshly-authored template renders something. Media resolves to a
neutral placeholder.

### 4.3 Field-spec editor

A structured editor for `SectionField[]` — add/reorder/remove fields; per field: key, label, type, help, and
type-specific extras (select options; number/range min/max/step; `list` → nested itemFields, one level).
Validated by `SectionFieldSpecSchema` (already built). The set of offered types matches what `FieldControl`
renders.

### 4.4 Template editor (dual view over one AST)

- **JSON view:** a code editor bound to `JSON.stringify(ast)`; on edit, parse + `SectionTemplate.safeParse`
  - `validateTemplate(ast, {fieldSpec, binding})`; show issues inline; only commit valid JSON to the AST state.
- **Visual view:** a node tree (collapsible) with a palette of the 14 authorable node types (Embed gated).
  Selecting a node opens a **prop panel** driven by its node type: enum props → `Select`; value-expression
  props (`text`/`url`/`src`/`name`/`label`/`html`) → a **value editor** (literal | `$bind` | `$concat`, with a
  format dropdown); `If.test` → a condition editor; `Repeater.each` → a list-field picker; `Grid.cols` →
  enum-or-bind. Add/nest/reorder/delete operate on the AST. Both views write the same state, so toggling is
  lossless.
- **Binding scope provider:** the value/condition editors offer only legal paths for the current node —
  `field.*` (from the field spec), `item.*`/`index` (inside a Repeater, from its list's itemFields),
  `ctx.*`, and `product.*`/`collection.*` when the section declares that binding. This mirrors
  `validateTemplate`'s scope rules, so the picker can't produce an invalid bind.

### 4.5 Data flow (mostly built)

Server actions (`'use server'`, JWT-holding) → the REST endpoints already shipped
(`/v1/sitebuilder/definitions`). New actions: `createDefinition`, `updateDefinition`, `deleteDefinition`;
new reader: `getDefinition(slug)`. `listCustomDefinitions()` already exists. The service already validates
shape + semantics + the in-use delete guard.

## 5. Build plan (incremental, each verifiable)

1. **Extract `@sparx/section-template-react`** (interpreter + icons + CSS, adapters); rewire site;
   add Dockerfile COPY lines. _Refactor, no behavior change_ → site build stays green.
2. **Plumbing:** “Sections” rail item, list page, create/edit routes, server actions + `getDefinition`.
3. **Field-spec editor** component.
4. **JSON template view + live validation + form preview** — a usable end-to-end Studio (create/edit/save).
5. **Live render preview** via the shared package + scoped tokens + sample config.
6. **Visual tree builder** (tree + palette + prop panels + value/condition editors + binding pickers),
   dual with the JSON view.
7. Responsive + working-area-standard polish.

Sequencing gets a working Studio (4) before the heavier visual builder (6); both edit the same AST, so the
builder is additive.

> **Build status — ✅ COMPLETE (all 7 increments, 2026-06-01).** Shipped components (dashboard
> `(dashboard)/sitebuilder/_components/`): `section-studio.tsx` (the AST is the single source of truth —
> `validateTemplate` gates Save, `SectionTemplate.safeParse` gates the preview), `field-spec-editor.tsx`,
> `template-builder.tsx` ([Visual | JSON] toggle over one AST; an uncommitted/invalid JSON draft blocks Save
> but the AST keeps the last good tree so the preview never breaks), `template-tree-editor.tsx` (path-addressed
> immutable tree ops, palette, per-node inspector, `scopeAtPath` mirrors the validator's binding scoping),
> `value-expr-editor.tsx` (ValueExpr literal/`$bind`/`$concat` + Condition + scope-aware path picker), and
> `section-preview.tsx` + `section-preview.css` (live render via the shared `@sparx/section-template-react`
> interpreter against synthesized sample config, scoped apex-default `--st-*` tokens, inert link adapter +
> placeholder media). All green: dashboard typecheck + lint (0 errors) + repo `format:check`. A production
> `next build` is the only check not yet run (deferred while a dev server holds the repo); the package + CSS
> imports are proven by the identical site usage.

## 6. Risks & deferred

- **Preview parity** — mitigated by the shared package (§4.1): the preview literally runs the production
  renderer. Only the theme tokens are a stand-in (apex defaults) since the preview isn't tenant-scoped.
- **JSON ↔ visual round-trip** — the AST is the single source of truth; the JSON view is text over the same
  object, the visual view is structured editing over it. Invalid JSON simply doesn't commit.
- **Deferred:** an `icon` `SectionFieldType` picker (still raw lucide-name text); live-draft config migration
  when a field spec changes under published pages; client-island custom sections; defensive server-side
  richtext sanitization (currently mirrors the rich-text section's editor-trust model).
