# Content Architecture — Content, Components, Templates & Pages

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-03

---

## 1. Purpose & relationship to other docs

Building the site render path surfaced a structural problem the earlier docs each
saw one face of: **where content's _shape_ lives, and how a template attaches to it.**

This document is the **foundational content model**: what a content type _is_, what a
component _is_, how a template attaches to content, and where the field schema is owned
and authored. It is the content-side peer of the [composition model](40-sitebuilder-composition-model.md):
docs/40 says a page is a tree of nodes bound to a **typed schema** and that "CMS defines
the schema"; this doc specifies what that schema is attached to and how it is edited.

Where this doc and others disagree, **this doc wins** for the content/template relationship,
and the affected doc is amended in the phase that lands the change:

- [docs/12 — CMS PRD](12-cms-prd.md): content types are re-scoped to **page-level shapes**;
  widget-shaped builtins (`feature`, `faq_item`, `editorial_section`, `module`) are
  reclassified as components + nested fields.
- [docs/40 — Composition model](40-sitebuilder-composition-model.md): unchanged in spirit;
  this doc names where the "typed schema keystone" is owned (the content type) and adds that
  it is **authored from the builder**.
- [docs/41 — Builder page model](archive/41-builder-page-model.md) / [docs/44 — Site render](archive/44-builder-site-render.md):
  the `BuilderPage.record_type` **magic string** is replaced by a first-class link from a
  content type to its template, with a per-entry override.
- The legacy `Page` model ([10-cms-pages.prisma](../packages/db/prisma/schema/10-cms-pages.prisma))
  and `/cms/pages` are **retired**.

This is a model + decision + worklist doc. It locks vocabulary so we stop re-deriving it.

---

## 2. The problem today

Four overlapping systems each model "a page" or "a content shape," and the seams leak:

1. **Legacy `Page` model** (`cms_pages`) — a separate static-page table, unrelated to content
   entries or the builder. The site already serves pages via the `page` _content type_
   (`content_entries`), not this table. It is vestigial.
2. **Content types** house field schemas — but the builtin set mixes **page-level shapes**
   (`blog_post`, `page`) with **widget-shaped** types (`feature`, `faq_item`,
   `editorial_section`, `module`) that are really pieces of presentation, not standalone pages.
3. **Builder templates** (`BuilderPage`) attach to a content type by a **loose string**
   (`record_type = 'cms.blog_post'`). Nothing enforces the string points at a real content
   type. A seed rename drifted one tenant's blog template to `cms.post`, and it silently
   stopped resolving — the bug that triggered this doc.
4. **Schema authoring** happens in a content-types admin, **divorced from the builder** where
   the schema is actually consumed. You define fields in one place, then go bind them in another.

The through-line: the **content schema is not a first-class, integrity-checked thing that the
builder understands**, and **content types are doing two jobs** (page-level shapes _and_
widget data).

---

## 3. The model in one paragraph

**Content** is a page-level _shape_ — a field schema, owned independently of any presentation,
so it is consumable by the site, email, MCP, AI, and mobile alike. **Components** are
presentation widgets (FAQ, carousel, gallery, feature grid…) that **bind to** content fields —
including nested `list`/`group` fields — and decide how data is drawn; they never own the data.
**Templates** are builder node-trees that present a content shape; a content type has **one
default template**, **overridable per entry**. **Pages** are routes that resolve a record to its
template and render it. The schema is **owned by Content** (so one shape can have many templates)
but **authored from the Builder** (so you shape fields where you use them) — structured content
with page-first ergonomics.

---

## 4. The four concepts

### 4.1 Content — a page-level shape (owns the schema)

- A **content type** defines the field schema for a class of **page-level records** — a thing
  that gets its own URL and its own page template. `post`, `article`, `page`, a landing page.
- Storage is unchanged: one polymorphic `content_entries` table, `type_key` discriminator,
  `body` JSONB validated against the type's schema. **There is no per-type SQL table.**
- The schema is **presentation-independent**. It is the single source of truth that the
  site, email, MCP/AI, and any API client read. This is non-negotiable — it is why
  Content owns the schema and the builder does not.
- A content type's schema may contain **nested structure** — `group` (a sub-record) and `list`
  (a repeatable sub-record) field kinds. Repeatable sub-content (a page's FAQ entries, a
  feature row, a gallery) lives here as fields, **not** as separate content types.

### 4.2 Components — presentation that binds to content

- A **component** is a builder node (Tier-1 primitive or Tier-2 data-aware), dropped into a
  template. FAQ, carousel, gallery, feature grid, stat row are components.
- A component **binds to content fields** and decides presentation. An FAQ component binds to
  a `faqs: list<{ question, answer }>` field and iterates it; it does **not** store the Q&A.
- Components are **tenant-extensible** ([docs/38](38-sitebuilder-extensible-sections.md),
  [docs/47](47-class-first-authoring-model.md)) and live under `/builder/components`.
- **Rule:** make a new _component_ when you want a different way to present data. Make a new
  _content type_ only when the _fields_ genuinely differ. Never spawn a content type just to
  get a different layout.

### 4.3 Templates — presentations of a shape

- A **template** is a builder page-tree authored against a content type's schema (its bindings
  reference that schema's fields).
- A content type has **one default template**. An individual **entry may override** with a
  different template. Resolution order: **entry override → type default → built-in fallback.**
- One shape → many templates. _This is the reason the schema must live on the content type,
  not the template:_ if the schema lived in a template, a type with three templates would have
  to triplicate its schema. The multi-template model **requires** Content to own the schema.

### 4.4 Pages — routes that resolve record → template

- A request for `/blog/<slug>` resolves the entry, picks its template (entry → type → fallback),
  binds the record in, and renders the tree (the per-record router, [docs/44](archive/44-builder-site-render.md) §3 B).
- Singleton routed pages (an About page) are the degenerate case: one entry, one template.

---

## 5. The keystone — schema owned by Content, **authored in the Builder**

The schema is **owned** by the content type and **edited** from inside `/builder/page`.

**Why both:** structured-content integrity (one schema, many presentations, API/MCP-first)
_plus_ page-first ergonomics (don't define fields in one admin then bind them in another).
This is what mature visual CMSes do — the collection schema is a first-class object, but you
shape it inside the designer.

**The flow:**

1. In the builder, you're authoring a template **for a content type** (the template declares
   which type it targets — §6).
2. You drop a component and bind it. The binding picker offers the content type's existing
   fields. If the field you need doesn't exist, you **add it right there** — name, kind
   (text / richtext / image / number / date / option / `group` / `list` / reference), required.
3. That write goes to the **content type's schema** (not the template). It immediately appears
   in the binding picker, in the CMS entry-editor form, and in the API/MCP introspection — one
   source of truth, edited from a convenient surface.
4. Components that present repeatable sub-content (FAQ, gallery) add a `list`/`group` field and
   bind to it; the entry form renders a repeater for that field.

**Invariants:**

- The builder **edits** the schema; it never **stores** a private copy. Removing a field is a
  schema change with the usual safeguards (impact warning, confirm — destructive per
  [feedback]).
- The schema remains valid for **all** of the type's templates and every headless consumer, not
  just the template being edited.

---

## 6. The first-class link (replacing the magic string)

A template attaches to content by **identity**, not a hand-typed string.

- **Template → content type.** A collection `BuilderPage` references the content type it
  presents by stable identity (the content type's id/key), aligning with the sections tier's
  `cms:content-type:<id>` target id ([docs/36](36-sitebuilder-layering-model.md)). `record_type`
  string matching is retired.
- **Content type → default template.** The content type carries (or resolves) its default
  template, so "render any `post`" has a definite answer.
- **Entry → template override (optional).** An entry may point at a specific template, beating
  the type default for that one record.
- **Resolver.** `entry.template ?? contentType.defaultTemplate ?? builtInFallback`. Replaces
  `getPublishedByRecordType`'s "lowest-position published string match," which was a weak proxy
  for "the type's default template."

Commerce/CRM sources (`commerce.product`, …) are **not** content types; they keep their
code-defined target identifiers. The unification is: a template's **target** is either a
content type (by id) or a code-defined domain source — exactly the two cases the binding
catalog already exposes ([docs/43](archive/43-builder-binding-schema.md)).

---

## 7. Naming & granularity

- **Rule restated:** content type granularity follows **schema**, not topic or presentation.
  Same fields → same type (vary by template/taxonomy). Different fields → different type.
- **Editorial:** blogs / articles / news share a shape → a single generic **`post`** (or
  `article`) is the target end-state, distinguished by taxonomy + template, not by separate
  types. Keeping today's concrete `blog_post` is acceptable interim; the `blog_post → post`
  rename is **optional and deferred** (the first-class link in §6 makes the drift irrelevant
  regardless of the key, so no rename is required to be correct).
- **Landing/static:** `page` stays as the one-off page shape.
- **Reclassify (not content types):** `feature`, `faq_item`, `editorial_section`, `module`
  become **components + nested fields**. A marketing "module page" becomes a `page`/`post`-class
  shape with nested `features: list<…>` rendered by a feature-grid component.

---

## 8. What retires

- **`Page` model + `/cms/pages`** — deleted once confirmed nothing live reads `cms_pages` (the
  site already uses the `page` content type). Any rows migrate to `page` entries.
- **`BuilderPage.record_type` string** — replaced by the §6 link.
- **Widget-shaped builtin content types** — reclassified per §7 (a migration touching `sparx/apps/web`,
  which currently renders its marketing pages from `feature`/`module` types).

---

## 9. Build phases

Deploy small ([feedback]); each phase is independently shippable and testable.

- **Phase 1 — First-class link + resolver + target UI.** Add the content-type ↔ template link
  and per-entry override; swap the resolver to entry → type-default → fallback; add a "Targets
  [content type ▾]" control to collection templates in the builder. _Fixes the drift; makes the
  per-record render correct; unblocks the blog-post end-to-end test._ Migration authored locally,
  applied via the pipeline ([db README](../packages/db/README.md)).
- **Phase 2 — Builder-authored schema (the keystone, §5).** Inline add/edit of a content type's
  fields from the binding picker, writing back to the content type. Entry form + API
  introspection pick it up automatically.
- **Phase 3 — Retire the `Page` model + `/cms/pages` (§8).**
- **Phase 4 — Reclassify marketing builtins (§7).** `feature`/`faq_item`/`module`/
  `editorial_section` → components + nested fields; migrate `sparx/apps/web`.
- **Phase 5+ — Component library.** FAQ / carousel / gallery / feature-grid as data-bound,
  tenant-extensible components ([docs/38](38-sitebuilder-extensible-sections.md)).

The site blog render path (`/blog/[slug]`, the `Prose` rich-text node) and the
`postToBuilderRecord` mapper already landed against the old string link; Phase 1 re-points them
at the resolver and they continue to work.

---

## 10. Open questions / deferred

- **Default-template storage.** Default template as a column on the content type, vs. reuse the
  sections tier's `SiteLayoutDefault`/`SiteLayoutAssignment` (which already model type-default +
  per-item override, keyed by content-type id). Strong candidate: converge on one assignment
  table across both tiers rather than two parallel ones. Decided in Phase 1.
- **Schema-edit safety.** Field rename/delete impact analysis (which entries, which templates,
  which bindings) — surfaced as a warning before a destructive schema change.
- **Generic `post` migration.** If/when `blog_post → post`, taxonomy carries the
  blog/article/news distinction; URL pattern becomes a content-type setting.
- **Versioned schema vocab** for tenant-extensible components ([docs/47](47-class-first-authoring-model.md) §contract).
