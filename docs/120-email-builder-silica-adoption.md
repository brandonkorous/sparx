# 120 — Email builder → silicaui adoption (the second engine cutover)

**Version:** 1.2
**Author:** Brandon Korous
**Last Updated:** 2026-07-12

> **STATUS (2026-07-12) — DONE. There is ONE email engine.** Slice 7 landed: `renderEmailTree`
> (583 lines + 378 of tests), the legacy `EmailBuilderApp` + its preview modal + merge-tags panel,
> `email-surface-data.ts`, the tree-shaped `resolveEmailData` / `emailDataResolver`, and the
> parallel-run branch in all four send callers are **deleted**. Every email — transactional,
> broadcast, preview, test-send — renders through `renderSilicaEmail` and only that.
>
> **The parallel run ended with a CONVERSION, not a reset.** The blocker was the ~260 rows
> authored on the sparx engine: 231 keyed and, critically, **30 custom-key** ones, which have no
> code default to fall back to. Resetting them to defaults would have silently destroyed edits and
> had no answer at all for the custom emails. So `emailTreeToSilica`
> ([wizeworks/packages/builder-schemas/src/email-legacy-to-silica.ts](../packages/builder-schemas/src/email-legacy-to-silica.ts))
> converts each row **from its own tree** — total over the ten node types the live table actually
> contains, with the ten mapping cleanly onto the slice-6 authoring kit (`conditional_block` →
> `when()`, `line_item_table` → `itemsTable()`, and the wordmark / unsubscribe / postal-address
> nodes → **nothing**, because the send now COMPOSES those). It runs in two places: on READ
> (`emailService`, so `silicaDoc` is never null and no send can break mid-deploy), and as a
> persisting **repair pass** inside `provisionDefaultEmails` — the per-tenant reconcile that
> already runs on module activation and every 6 hours, which makes it the only deployable place to
> land a backfill without a one-off DB script.
>
> **Two behaviour changes, both improvements, both deliberate.** (1) A broadcast now always
> DECLARES `emailType: 'marketing'`, so the CAN-SPAM postal-address gate applies to every one of
> them. (2) The "marketing email must contain an `unsubscribe_link` node" gate is **gone** — it
> existed because the sparx builder made the opt-out an optional node an author had to remember to
> place, i.e. an author could opt out of the opt-out. silica composes the legal footer into every
> marketing send, so the requirement is now satisfied structurally and cannot be authored away.
>
> **Still open (one deploy behind).** `builder_emails.draft_tree` / `published_tree` still exist as
> the conversion source. They get dropped — along with `emailTreeToSilica` and the sparx email node
> schema — once the repair pass has run for every tenant. Nothing reads them today.

> **What this is.** The design for migrating sparx's Email Builder from its own
> `.bx-*` engine onto `@wizeworks/silicaui-builder/email` (the `<EmailBuilder>` shell +
> the `toEmailHtml` projector), now that **silicaui 0.17.0** shipped the email data
> layer requested in [doc 119 Part 10](119-silicaui-builder-gap-questions.md#part-10--the-email-editor-the-same-dynamic-content-gap-one-level-deeper-2026-07-11)
> (Q23 merge-token seam · Q24 repeat primitive · Q25 resolving projector). It is the
> **email twin of [doc 118](118-builder-silicaui-html-migration.md)** — same parallel-run
> playbook, same "keep the storefront/send working the whole way" discipline. The site
> builder is already on silica; this brings the email builder onto the same engine so the
> two surfaces are one product again.

---

## 1. Why now — the gap closed

Doc 119 Part 10 kept sparx's email builder because silica's email schema was **static**:
no `bind`, no `repeat`, no host resolver — so every transactional/data-bound email (order
confirmation with a line-item table, abandoned-cart product list, `{{customer.firstName}}`)
was unbuildable on it. **0.17.0 closes that gap** (verified against the published tarball):

- **`BaseNode.data?: DataBinding`** — every email node now carries the SAME opaque
  `{ kind, ref, attr? }` marker as the site engine's `Node` (reused type, not reinvented).
- **`EmailBuilderHost`** = `{ resolveBinding?, resolveCollection?, catalog?, dataSources?, inspectorPanels? }`
  — the email twin of the site `BuilderHost`. sparx already owns reference implementations
  of every callback from the site migration ([[project_silica_engine_adoption]]).
- **`resolveEmailTree(root, host, scope)`** + **`emailScopeAt(sources, ancestors)`** —
  value substitution, collection **repeat** (on `body/section/columns/column`, the nodes
  that have a `children` slot), and the scope-narrowing that powers a real binding picker.
- **`toEmailHtml(doc, resolver?)`** — the resolving projector: the SAME pass feeds the
  Inspector's live preview AND a host's real send, so preview == send is structural.

**Backward-compat check (done):** the site `<Builder>` react surface, the root engine, and
the `@wizeworks/silicaui-html` engine `.d.ts` are **byte-identical** 0.16 → 0.17 — only the
email data layer was added. The whole-family pin bump to `^0.17.0` (in
[pnpm-workspace.yaml](../pnpm-workspace.yaml)) does not touch the live site builder.

---

## 2. Current state — what we're replacing (and must not break)

sparx's email system is rich and **data-bound**, and it is the egress for far more than
marketing. One render primitive — `@wizeworks/email`'s **`renderEmailTree`**
([render-email-tree.tsx](../packages/email/src/builder/render-email-tree.tsx)) — walks a
`BuilderEmail` node tree → table HTML + auto plain-text, and it serves **four** callers:

| caller                     | file                                                                                         | purpose                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| editor preview / test-send | [builder-email-service.ts](../packages/email-platform/src/services/builder-email-service.ts) | `/builder/email` preview + "send me a test"                   |
| broadcasts                 | [broadcast-service.ts](../packages/email-platform/src/services/broadcast-service.ts)         | marketing blast render-once                                   |
| transactional by-key       | [tenant-email.ts](../services/api-rest/src/lib/tenant-email.ts)                              | order-confirmation / welcome / shipping / … (the 13 defaults) |
| scheduled dispatch         | `email-dispatch.ts` (shares `renderBuilderEmailDoc`)                                         | automation-queued sends                                       |

Storage: one row per email in [`BuilderEmail`](../packages/db/prisma/schema/51-builder.prisma)
— `(tenant, property?, key?)` with `draftTree` / `publishedTree` (sparx `BuilderNode`),
`subject`, `preheader`, `name`, `position`. The **per-site override + keyed-default**
machinery (override join `(tenant, property, key) → (tenant, key)`, two partial-unique
indexes, `provisionDefaultEmails`, `customizeForSite`) is mature and **stays exactly as-is**.

`renderEmailTree` does a lot silica's closed schema doesn't model natively — the migration's
real work is mapping each onto the 0.17 seam:

| sparx feature                                           | silica 0.17 mapping                                                                                               | where it lands             |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `{{source.field}}` scalar interpolation                 | `{{…}}` survives `toEmailHtml` verbatim → **post-projection interpolation pass** (reuse `interpolateEmailTokens`) | send primitive             |
| array iteration (`line_item_table`, product/post grids) | `data:collection` + `host.resolveCollection` repeat                                                               | host + a catalog composite |
| `conditional_block`                                     | `host.resolveBinding` → `{ visible: false }`                                                                      | host                       |
| `unsubscribe_link` / `physical_address` (CAN-SPAM)      | **not in schema** → injected legal-footer section at send                                                         | send primitive             |
| `email_wordmark` header                                 | injected header section (Image/Text bound to brand) at send, or a `catalog()` block                               | send primitive + catalog   |
| `Prose` (TipTap richtext)                               | `HtmlNode` passthrough (serialize doc → inline HTML)                                                              | host resolve / authoring   |
| auto plain-text (`render({plainText:true})`)            | **not in `toEmailHtml`** → html-to-text over projected HTML                                                       | send primitive             |
| branded `EmailLayout` frame + `theme`                   | silica `theme` prop (colors) + injected frame sections                                                            | send primitive             |

Everything maps. Nothing here is a silica blocker — it's host composition, which is exactly
where doc 119's generic-first boundary puts it ("engine owns layout/projection; host owns
what a token/collection means").

---

## 3. Design decisions (locked)

**D1 — Parallel-run storage; reuse the whole override system.** Add nullable
`silica_draft_document` / `silica_published_document` `JSONB` columns to `builder_emails`
(mirroring `builder_pages.silica_*_tree`). Each column holds ONE silica `EmailDocument`
(subject + preheader + root). The existing `draftTree`/`publishedTree` stay as the **fallback**
until an email is re-authored. **sparx does NOT store a silica `EmailProject`** — the "project
roster" IS the sparx catalog of `BuilderEmail` rows; silica mounts one document at a time (D3).
The `(tenant, property?, key?)` + provisioning + fork machinery is untouched — a silica email
is the same row, carrying a silica document instead of a sparx tree.

**D2 — One resolving send primitive, host-composed frame.** New `@wizeworks/email/silica`
export `renderSilicaEmail(doc, { host, brand, compliance, marketing, subject, preheader })`:

1. compose the **send document** = branded wordmark header section ⊕ `doc.root.children` ⊕
   legal-footer section (unsubscribe link + `physical_address`, only for `marketing`);
2. `toEmailHtml(sendDoc, host)` — `host` = sparx's `resolveBinding`/`resolveCollection` so
   `data:value`/`data:collection` markers resolve (line-item tables, product grids);
3. **`{{token}}` interpolation** — silica 0.17's `resolveEmailTree` **already interpolates**
   `{{source.field}}` in text bodies + button labels natively (via `host.resolveBinding`, with
   HTML-escaping), so scalar merge tags work **identically, with zero re-authoring of token
   syntax** the moment the host resolves dotted paths. A thin supplementary pass covers what
   the resolver doesn't reach — subject/preheader (not nodes), and `{{…}}` inside `href`/image
   `src`/`alt`/`HtmlNode` — using the same `interpolateEmailTokens` + `resolvePath`;
4. **plain-text** via an html-to-text pass over the final HTML.
   The `theme` (light-mode hex) carries brand color; the frame sections carry logo/legal.
   This is the Q25 single-projector direction: preview, test, broadcast, and transactional
   all call `renderSilicaEmail`, so what you author is what ships.

**D3 — Host owns the catalog + lifecycle; silica is a single-document editor.** Mount
`<EmailBuilder document={activeDoc} host theme onChange onSendTest />` — one email at a time —
inside a thin sparx strip that keeps the existing catalog + lifecycle (switch · new · rename ·
delete · **fork for this site** · keyed-default badges · **Publish**). `subject`/`preheader`
MOVE into silica (they're `EmailDocument` fields, edited via the root-node inspector); sparx
reads them off `onChange(project)` (`project.templates[0].document`) and persists. This reuses
100% of the override/provisioning/compliance system and changes the least.
_Open UX nit:_ `<EmailBuilder>` renders its own header and exposes no `toolbarSlot` (unlike the
site `<Builder>`), so the sparx lifecycle strip sits ABOVE the editor. If the double-chrome
reads badly once built, request a `headerSlot`/`toolbarSlot` on `<EmailBuilder>` (small,
generic silica ask) — deferred until we see it, not a blocker.

**D4 — Reuse the site builder's host modules.** `host.resolveBinding`/`resolveCollection` =
`@wizeworks/builder-schemas/silica-resolve`; `host.dataSources()` = `silica-data-sources` narrowed
to the email binding catalog; `host.catalog().extend` = email composites (line-item table,
product grid, wordmark) authored from silica primitives; `host.inspectorPanels(node)` = a
sparx **merge-tag picker** panel over `emailMergeTags()` (the structured counterpart to typing
`{{`). No `validateClass` (email has no class strings). The email host also has no `pickAsset`
— but `inspectorPanels` is the seam that makes one unnecessary: the CMS media library bridges
in as a host panel on the three asset-bearing kinds (§6).

**D5 — Compliance gate survives.** The marketing gate (`treeHasNodeType(tree,
'unsubscribe_link')`) becomes "the send composes a legal footer" — since `renderSilicaEmail`
injects the unsubscribe section for `marketing` sends, the gate is satisfied structurally; a
marketing send with no configured `physicalAddress`/unsubscribe still refuses, unchanged.

---

## 4. Staged slices (each gate-clean, storefront/send never broken)

0. **0.17 install + pin bump.** Pins bumped to `^0.17.0`. Needs one `pnpm install` (user) +
   dev restart. Site builder verified byte-safe.
1. **This doc** — approve the shape.
2. **Storage (D1).** Migration `builder_emails.silica_draft_document`/`silica_published_document`
   `JSONB` (additive, nullable, RLS inherited — the table is already ENABLE+FORCE) +
   `BuilderEmail.silicaDraftDocument`/`silicaPublishedDocument Json?` + `EmailDocument`
   zod/types in `@wizeworks/builder-schemas` (opaque, like `site-sync`). Author files; user runs
   install; I run `prisma generate` + `migrate deploy` (authorized per the established pattern,
   [[feedback_wait_for_db_impact]]).
3. **Send primitive (D2).** `@wizeworks/email/silica` `renderSilicaEmail` (frame inject + resolving
   `toEmailHtml` + `{{token}}` pass + html-to-text) + unit tests (a bound line-item table, a
   `{{token}}`, an injected legal footer, plain-text parity).
4. **Editor swap (D3/D4).** `/builder/email` mounts `<EmailBuilder>` inside the sparx lifecycle
   strip; `onChange` persists the silica doc to the active row's `silica_draft_document`; new/
   rename/delete/switch/fork/publish preserved; host wired to the reused resolve/dataSources/
   catalog/merge-tag-panel modules.
5. **Send wiring (D2).** Branch preview/test/broadcast/transactional/dispatch to
   `renderSilicaEmail` **when the email has a silica document**, else fall through to
   `renderEmailTree`. Parallel-run: an un-migrated email keeps rendering exactly as today.
6. **Re-author the 24 defaults** ([default-emails.ts](../packages/builder-schemas/src/default-emails.ts))
   as silica `EmailDocument`s; provisioning writes the silica doc going forward. Until a default
   is re-authored, it serves via the sparx-tree fallback. **DONE** — the bodies live in
   [default-emails-silica.ts](../packages/builder-schemas/src/default-emails-silica.ts), authored
   through a [silica-email-kit](../packages/builder-schemas/src/silica-email-kit.ts) vocabulary, and
   `doc` is DERIVED per entry from `key` + `subject` + `preheader` (so a new default with no silica
   body throws at module load rather than provisioning silently as legacy-only). Three things this
   slice had to solve, none of them obvious from the schema:
   - **The conditional.** Legacy `conditional_block` has no silica equivalent — but a bound
     `section` fills no field (section has no default bindable field), so it's a pure show/hide
     wrapper as soon as the resolver can say "this is absent." `createSilicaResolver` gained an
     **opt-in** `hideWhenEmpty` (silica's `visible:false`), used by the email path only: turning it
     on globally would make bound-but-empty nodes vanish from published SITES, which rely on the
     opposite (keep the authored placeholder).
   - **The brand.** Email HTML has no CSS custom properties, so a theme can only reach an email by
     rewriting node values. The defaults ship in silica's neutral palette with every `*Auto` flag
     set, and [brand-colors.ts](../packages/email/src/silica/brand-colors.ts) repaints them per send
     — so one engine-neutral authoring pass serves every tenant, and a brand change reaches every
     already-provisioned email with no re-provisioning.
   - **The `??` fallback.** `{{customer.firstName ?? "there"}}` still works: silica's native token
     regex only matches bare paths, so a token with a fallback passes through projection untouched
     and is then interpolated by sparx's own pass over the projected HTML, which understands it.
7. **Flip + delete — ✅ DONE (2026-07-12).** Every path is silica. `renderEmailTree`, the email
   leaf renderer, `EmailBuilderApp` (+ preview modal + merge-tags panel), `email-surface-data.ts`,
   and the tree-shaped `resolveEmailData`/`emailDataResolver` are deleted; the parallel-run branch
   is gone from all four send callers and the dispatch tick. `@wizeworks/email`'s atomic components
   stay (the injected frame sections still use them / their tokens). Pre-cutover rows are
   CONVERTED, not reset — see `emailTreeToSilica` + the repair pass in `provisionDefaultEmails`.
   The `draft_tree`/`published_tree` columns survive one more deploy as the conversion source.

---

## 5. Risks & how they're contained

- **Transactional email is the highest-stakes surface.** Parallel-run (D1/slice 5) held it open
  until every default was silica and proven. Closing it (slice 7) kept the same discipline: the
  conversion runs on READ as well as in the repair pass, so an order confirmation cannot break in
  the window between deploy and reconcile, and it is covered by render tests that assert the
  tenant's own copy, tokens, `??` fallbacks, line-item repeat, conditional drop, and the composed
  footer all survive the move — not just that the node shapes are right.
- **Merge-token regression.** Scalars stay `{{token}}` (D2.3) rendered by the same
  `interpolateEmailTokens` — no author relearns syntax, and existing copy is untouched.
- **Plain-text fidelity.** New html-to-text pass replaces React Email's `plainText` render;
  covered by a parity test (slice 3). Mailgun requires a text part — non-negotiable.
- **Double chrome (D3 nit).** Cosmetic; resolved by a small silica `toolbarSlot` ask if needed.
- **Asset picking.** ~~0.17's email asset fields are URL inputs, not the CMS media picker.~~
  Closed: the library is bridged in as a host `inspectorPanels` panel (§6) — no silica ask.

---

## 6. Does silicaui need to provide more? — no for the core, 3 small polish asks

**The migration is unblocked; the core is complete in 0.17.** Verified against the compiled
`resolveEmailTree`: value binding (with `attr` targeting, and the site engine's Q22
"stops resolving children after an attr fill" bug is already fixed here), collection **repeat**,
**conditional visibility** (`visible === false` drops the node), **native `{{token}}`
interpolation** in text + button labels, binding-picker scope narrowing (`emailScopeAt` /
`flattenEmailSources`), and the resolving projector are all present. Everything left is host
composition (frame, plain-text, subject/preheader token pass, catalog composites) — which
doc 119's generic-first boundary deliberately puts in the host, not the engine. **We do not
need to gate the migration on any silica change.**

Two **small, cosmetic** asks remain worth sending (each has a clean host-side workaround, so
neither blocks a slice):

- **A1 — `toolbarSlot`/`headerSlot` on `<EmailBuilder>`.** The site `<Builder>` has
  `toolbarSlot` (sparx renders its lifecycle controls inside the editor chrome); the email
  shell exposes none, so the sparx catalog/lifecycle strip (switch · new · fork · publish) must
  stack ABOVE the editor. Ergonomic parity, not correctness.
- **A2 — `omitWhenEmpty` on a `collection` bind**, so an empty line-item table renders
  **nothing** (sparx's current behavior) instead of the one authored placeholder row. Worked
  around with a `visible:false` wrapper.

### Two earlier asks are now closed — one was our job, one was already free

- **~~`pickAsset` on `EmailBuilderHost`~~ — ours to build, not silica's.** The email host has
  no `pickAsset` (its asset fields are plain URL inputs, and 0.17's source says so explicitly),
  but it **does** expose `inspectorPanels?(node)`, whose `EmailInspectorPanelCtx.update()` writes
  through the engine's own mutation path. A host panel on the three asset-bearing kinds — `image`
  (src), `video` (thumbnail), `section` (bgImage) — is all a picker needs. Built as
  [email-asset-panel.tsx](<../apps/dashboard/app/(dashboard)/builder/_builder/email-asset-panel.tsx>),
  reusing the same `<MediaPicker>` the CMS and site builder already use. Not optional polish:
  asking a business owner to paste an image URL is a technical act.
- **~~Native `{{token}}` interpolation for `href` / `src` / `HtmlNode`~~ — already free.**
  `renderSilicaEmail` interpolates over the **projected HTML string**, so every token silica
  doesn't natively handle (it covers text + button labels) is picked up at zero cost.

The one live ask extends [doc 119 Part 10](119-silicaui-builder-gap-questions.md); if sent
upstream they'd become Q26–Q27. Neither changes the slice plan.

## 7. Definition of done

- [x] All four render callers + the dispatch tick route EVERY email through one `renderSilicaEmail`.
- [x] Line-item tables, product/post grids, conditionals, `{{token}}` scalars, the legal
      footer, and plain-text all verified on the silica path.
- [x] The email builder is `<EmailBuilder>` on silica; the site + email builders are one engine.
- [x] The provisioned defaults are silica `EmailDocument`s; provisioning writes silica.
- [x] Legacy `renderEmailTree` + `EmailBuilderApp` deleted; `@wizeworks/email` atomic components kept.
- [x] Pre-cutover rows CONVERTED from their own trees (never reset), on read + via a persisting
      repair pass; proven by unit tests on the mapping and render tests on the resulting email.
- [x] Per-site override + keyed-default behavior unchanged end-to-end. Compliance changed
      DELIBERATELY: marketing intent is declared, not sniffed, and the opt-out is composed rather
      than author-placed — so it can no longer be omitted.
- [ ] `draft_tree` / `published_tree` dropped + `emailTreeToSilica` deleted (one deploy behind:
      gated on the repair pass having run for every tenant).
