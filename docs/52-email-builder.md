# 52 · Email Builder

Version: 0.2.0
Author: Brandon Korous
Last Updated: 2026-06-04

The Email Builder is the third Builder surface — `/builder/email` — alongside
`/builder/page` and `/builder/site`. It edits an email as **one self-contained
node tree** (no site/page split) using the same composition model, editor brain,
and palette as the website builder ([docs/40](40-sitebuilder-composition-model.md),
[docs/41](41-builder-page-model.md), [docs/45](45-builder-site-layout.md)). It
**supersedes the flat section-list composer** ([docs/31](31-email-section-composer.md),
`@sparx/email-sections`) the way `/builder` superseded `/sitebuilder`: the
node-tree becomes the one email authoring model, and the section model is
migrated off and retired (§8).

---

## 1. Why one document

A website is _chrome (header/footer) wrapping many routed pages_ — hence the
two-surface split (`site` layout + `page` content, joined at an `Outlet`). An
email has no routing and no persistent cross-document chrome: it is a single
tree that renders top to bottom. So the Email Builder is **one surface, one
tree**, closest to `/builder/page`'s catalog model:

- A tenant keeps a **catalog** of email documents (`BuilderEmail`), each with the
  same draft → publish lifecycle as a page.
- There is **no `Outlet`, no "active" selection, no layout tier**. The branded
  frame (wordmark header + legal footer) is fixed chrome supplied by the renderer
  (`EmailLayout`), not an author-edited layout — the author edits only the body
  tree. (Making the frame author-editable is a later option, not Phase 1.)

## 2. The two models, and the decision

|           | Website (legacy)                      | Website (current)                                    | Email (legacy)                                   | **Email (this doc)**                               |
| --------- | ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------- |
| Model     | `@sparx/sitebuilder-schemas` sections | `@sparx/builder-schemas` node tree                   | `@sparx/email-sections` flat section list        | **`@sparx/builder-schemas` node tree**             |
| Editor    | `/sitebuilder`                        | `/builder/page` + `/builder/site`                    | `/email/templates`, `/email/broadcasts` composer | **`/builder/email`**                               |
| Renderer  | —                                     | `apps/site` `builder-renderer.tsx` (HTML + `--sf-*`) | `@sparx/email` `renderSections` (React Email)    | **`@sparx/email` `renderEmailTree` (React Email)** |
| Persisted | `sitebuilder_*`                       | `BuilderPage` / `BuilderLayout`                      | `EmailTemplate.body` / `Broadcast.body` JSON     | **`BuilderEmail` (draft/published tree)**          |

**Decision (locked):** the node tree is THE email authoring model. Broadcasts and
authored templates move to reference a published `BuilderEmail`; `@sparx/email-sections`
is sunset (§8). Hand-authored **transactional builtins** (OTP, password reset,
welcome) remain code React Email templates on the `template` send path — they are
out of scope for the section retirement.

## 3. The one hard part: the renderer

Editor reuse is cheap (§4). The renderer is the real work. The storefront renderer
([apps/site/components/builder-renderer.tsx](../apps/site/components/builder-renderer.tsx))
emits `<div>` + flexbox + `--sf-*` CSS variables — which mail clients won't render.
The Email Builder needs a **parallel renderer that walks the same `BuilderNode`
tree but emits table-based React Email components with inline styles**, reusing
the shared binding runtime (`resolvePath` / `cardinalityOf` from
`@sparx/builder-schemas/runtime`) so iterate/scope semantics never drift between
the storefront and email.

Email is **fixed-width and non-interactive**, which collapses most of the box
model:

- **Ignored axes:** `height`, `backgroundWidth`/`contentWidth` (fixed ~560px
  container), `overlay`, `textTone`, `pin`, `hiddenOn` device gating. These are
  hero/full-bleed/responsive concerns with no email analogue.
- **Honored axes:** `padding` (→ Section padding), `surface` (→ bg + fg color),
  `align` (→ `text-align`), and `layout` `direction`/`gap`/`columns` (stack = block
  children; row/grid = `<Row>`/`<Column>` at fixed column widths).
- **Leaves** map to the existing brand-aware email primitives
  ([packages/email/src/components/primitives.tsx](../packages/email/src/components/primitives.tsx)):
  `Heading→EmailHeading`, `Text→EmailParagraph`, `Button→EmailButton`,
  `Divider→EmailDivider`, `Spacer→EmailSpacer`, `Image→<Img>`.

Module color / `--module-active` and the `sf-*` recipe classes do **not** apply in
email; styling resolves from `BrandTokens` (`useBrand()`), exactly as the existing
templates do.

## 4. Editor surface reuse

The editor is fully surface-parameterized: `EditorSurface = 'page' | 'site'`
([registry.tsx](<../apps/dashboard/app/(dashboard)/builder/_builder/registry.tsx>)),
one shared `useBuilderEditor` brain + `BuilderWorkspace` body, one `registry`
palette filtered per surface. The Email Builder adds:

- **`EditorSurface = 'email'`.** `paletteForSurface('email')` is **opt-in** (unlike
  page/site, where an omitted `surfaces` means both): a component appears in email
  only if its `surfaces` list includes `'email'`. This keeps interactive/site-only
  components (Outlet, NavMenu, Logo, SocialLinks, Carousel, Video, Map, ProductForm
  and the commerce atoms) out of email entirely.
- **`EmailBuilderApp`** (`_builder/email-builder-app.tsx`) — modeled on `BuilderApp`:
  a catalog of emails (switcher · rename · new · delete), device preview, Save /
  Publish, plus **Test send** and **Preview**. Subject + preheader are document-level
  fields shown in an `EmailSettings` inspector panel (the no-selection panel, where
  page shows `PageSettings`).
- The shared `BuilderWorkspace` renders the canvas/inspector/layers unchanged with
  `surface="email"`. Slice 1 reuses the editor canvas for WYSIWYG; the **true**
  email render (table HTML) drives the Preview iframe + Test send (Phase 2).

## 5. Persistence (mirrors BuilderPage)

New Prisma model `BuilderEmail` in
[51-builder.prisma](../packages/db/prisma/schema/51-builder.prisma), tenant-scoped

- FORCE RLS (hand-added in the migration, like every `builder_*` table):

```
BuilderEmail
  id, tenantId
  name        VarChar(255)
  subject     VarChar(255)        -- the email subject line
  preheader   VarChar(255)?       -- inbox preview text
  draftTree   Json                -- editable BuilderNode root
  publishedTree Json?             -- last published snapshot
  publishedAt DateTime?
  position    Int                 -- catalog ordering
  createdAt, updatedAt
  @@index([tenantId, position]); @@map("builder_emails")
```

`emailService` (`packages/builder/src/services/email-service.ts`) mirrors
`pageService` exactly: `listOrSeed / get / create / update / remove / reorder /
publish`, plus `getPublishedById` (the broadcast read). Routes mount at
`/v1/builder/emails` next to pages/layouts. Publish snapshots draft → published and
emits `builder.email.published`.

## 6. Send / broadcast wiring

A published `BuilderEmail` becomes a broadcast body. `Broadcast` gains an optional
`builderEmailId`; `broadcastService.renderBody` branches:

- **Builder email** → `renderEmailTree({ tree, subject, preheader, data }, { brand })`.
- **Legacy section list** → `renderSections(...)` (until §8 completes).

Static / per-send emails render **once** into the existing `raw` dispatch payload —
the per-send data (products/promotion/posts) is resolved once and the same body
fans out. Per-recipient emails **defer**: `treeIsEmailPersonalized(tree)` (true when
any node binds `recipient`/`order`/`cart`/`loyalty`) makes `enqueueAndMark` write a
`defer.builderEmailId` payload instead of a rendered body; the email-dispatch tick
([services/api-rest/src/lib/email-dispatch.ts](../services/api-rest/src/lib/email-dispatch.ts))
reloads the published tree, resolves THIS recipient's data via the injected
`resolveEmailData`, and renders per recipient — exactly the branch the section
`defer.templateId` path already takes. `@sparx/email-platform` stays commerce-free:
api-rest injects `emailDataResolver(ctx)` (which has `@sparx/commerce`).

## 7. Binding catalog (`EMAIL_CATALOG`)

`EMAIL_SOURCES` (`@sparx/builder-schemas/binding`) fixes the code-defined sources:
**recipient** (personalized), **order / cart / loyalty** (personalized), **products
/ active promotion** (per-send). Email products carry DISPLAY-ready fields
(`priceLabel`/`imageUrl`/`url`) rather than the page catalog's raw numeric `price`,
since email leaves bind to plain text/image. The per-tenant catalog is served by
api-rest's `bindingService.getEmailSchema` (`/v1/builder/email-binding-schema`):
`EMAIL_SOURCES` **plus the tenant's CMS COLLECTION sources** (e.g. latest posts) —
record (object) CMS sources are dropped, an email has no in-scope single record.
Shapes are fixed; the **data** is produced at send/preview by `resolveEmailData`
(§6), which resolves only the sources a tree binds.

## 8. Migration & sunset of `@sparx/email-sections`

1. Ship `/builder/email` + renderer + broadcast wiring (Phases 1–3).
2. Port the data-aware sections to node components (Phase 4) so there is no
   capability regression.
3. Convert existing authored `EmailTemplate.body` section lists → node trees
   (one-time, lossless: each section → its node equivalent), and repoint the
   `/email/templates` authored editor at `/builder/email`.
4. Remove `@sparx/email-sections`, `@sparx/email`'s `sections/*`, and the legacy
   composer once no body references the section shape.

Transactional code builtins are untouched throughout.

## 9. Phase plan

- **Phase 1 — Foundation (static).** Schema (email DTO, starters, `EMAIL_CATALOG`,
  import/export) · persistence (`BuilderEmail` + migration + `emailService` + routes
  - event) · editor surface (`'email'` palette, `EmailBuilderApp`, route, manifest,
    `EmailSettings`, dashboard actions/api). End-to-end author → autosave → publish,
    static primitives + brand chrome. **Deployable.**
- **Phase 2 — Renderer + preview + test-send.** `renderEmailTree` in `@sparx/email`;
  Preview iframe (server-rendered real HTML); Test-send-to-me. **Deployable.**
- **Phase 3 — Broadcast send.** `Broadcast.builderEmailId`; `broadcastService` render
  branch; worker raw path; composer picks a Builder email; send to a segment.
  **Deployable.**
- **Phase 4 — Data-aware. _(Built 2026-06-04.)_** The email `DataSources` resolver
  ([services/api-rest/src/lib/email-data.ts](../services/api-rest/src/lib/email-data.ts),
  `resolveEmailData`/`emailDataResolver`) reads commerce + CRM + CMS and resolves
  only the sources a tree binds (`bindingSourceKey` over its paths). The editor
  receives the real `EMAIL_CATALOG` (`/v1/builder/email-binding-schema` =
  `EMAIL_SOURCES` + the tenant's CMS collections), so nodes bind to recipient /
  order / cart / loyalty / products / promotion / latest-posts; the data-aware
  leaves `Image` (static or bound URL) and `ImageDisplay` (bound) join the palette.
  **Per-recipient deferred render:** `treeIsEmailPersonalized` decides the dispatch
  shape — a tree binding a per-recipient source (recipient/order/cart/loyalty)
  defers (`defer.builderEmailId`); the dispatch tick reloads the published tree,
  resolves THIS recipient's data, and renders per recipient. A per-send tree
  (products/promotion/posts) resolves once and fans out as `raw`. Preview +
  test-send resolve the tree's per-send data so the editor shows real content.
  **Deferred within P4:** `Prose` (bound richtext → HTML) in email — needs a
  TipTap→table-safe HTML serializer, not yet wired; product/cart images are empty
  until a product carries an explicit PRIMARY image (`productService.list` returns
  `imageUrl: null` today). Bind a `Text` to `item.excerpt` for post teasers meanwhile.
- **Phase 5 — Migrate & retire.** Convert authored bodies; retire the section model.

## 10. Non-obvious commitments

- **Email is opt-in in the palette** — never inherit page/site components by
  default (§4); an interactive control in an email is a defect.
- **One renderer, one binding runtime** — the email renderer reuses
  `resolvePath`/`cardinalityOf`; it must never fork iterate/scope semantics (§3).
- **`@sparx/email` gains a `@sparx/builder-schemas` dependency** — add it to the
  package and to **every consumer Dockerfile** (api-rest, email-worker, dashboard)
  per the workspace-wiring rule, or image builds fail at runtime.
- **Branded frame stays fixed chrome** in Phase 1 — the legal footer (physical
  address + unsubscribe) is not author-removable.
