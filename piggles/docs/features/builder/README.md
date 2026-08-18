# Piggles builders — our own editing engine

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-16

Piggles replaces silicaui's `<Builder>` / `<EmailBuilder>` with its own theme,
layout, page, component and email builders — each self-contained in one pane, all
of them open at once, over a document model that matches the store instead of
fighting it.

Tasks and progress: [TASKS.md](TASKS.md).

## Why

The console already has multi-window and multi-tab. The builders cannot use it.

`<Builder>` is an application: it owns the whole site in memory, in one blob, with
one Save and one Publish. Mount it twice and you get **two independent drafts of
the same site** — two dirty flags, two undo stacks, two whole-site `PUT`s. They
reconcile through the server, so a second pane of your own appears to the first as
a remote **peer**: a "2 editing" badge for yourself, and a 6-second `claim` that
greys out and refuses edits on the block you are working in
([builder-live.tsx](../../../apps/workbench/surfaces/builder/studio/builder-live.tsx)).
Opening theme beside layout — the reason multi-window exists — is the gesture that
breaks it.

## The model, and why the blob is wrong

Themes, layouts and pages are three things with three lifecycles. Nothing inherits
by containment:

```
Theme    system | tenant | marketplace   ·  tenant-scoped, reused across sites
   ↑ applied by
Layout   one per site                    ·  the chrome + the Outlet
   ↑ wrapped around
Page     many per site                   ·  the body
```

Components are site-scoped symbol masters, applied wherever they are placed.
Email is its own document with its own lifecycle and no site tier at all.

**The database already says this.** Layouts and pages are separate tables with
their own `silica_draft_tree` / `silica_published_tree` / `published_at`, and a
page names its chrome through
[`BuilderPage.frameId`](../../../../packages/db/prisma/schema/51-builder.prisma) —
`null` = the site default, `'none'` = render bare, or a layout id — with a
`published_frame_id` beside it so the choice obeys the publish lifecycle.
`BuilderLayout`'s own comment is explicit that theme and symbols do **not** belong
to the chrome.

silica's `Site = { pages, frame, symbols, theme, savedThemes }` flattens all of
that into one document. The cost is
[site-service.ts](../../../../packages/builder/src/services/site-service.ts) —
**2,313 lines whose entire job is assembling and shredding**, plus a family of
guards (`wouldClobberSite`, `pagesToDelete`, `framesToDelete`) that exist only
because whole-blob writes are dangerous. Its `load` is theme-less, because the
theme was never really part of the blob; its `sync` writes the frame onto _the
active layout_, because a blob has room for exactly one.

## What we build, and what we never touch

The document format stays silica's. `wizeworks/apps/site` and api-rest read published trees
directly and have never heard of the builder, so a new editor changes nothing
downstream.

**Reused, never forked:**

| From                                              | What                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@wizeworks/silicaui-html`                        | schema (`Site`/`Page`/`Node`/`Theme`/`SymbolDef`), `toHtml` · `renderPage` · `composeFrame` · `expandComponent`, `stamp` · `stampTree` · `assignOrds` · `generateKeyBetween`, `validateClassString` · `composeValidators` · `lintTree`, `resolveThemeTokens` · `deriveContent` · `contrastRatio` |
| `@wizeworks/silicaui-builder`                     | the pure helpers only — `splitToken` · `setTokenAt` · `tokenStateAt` · `declaredBreakpoints`, `mergeCatalog` · `paletteGroups` · `themeShelves`                                                                                                                                                  |
| `@wizeworks/silica-catalog`                       | `SPARX_CATALOG` · `SITE_CATALOG` · `HOST_COMPONENTS` · `SPARX_THEME_GROUPS` (20 system themes) · the starter seeds                                                                                                                                                                               |
| `@wizeworks/builder-schemas`                      | the binding resolver, the class validator, the DTOs                                                                                                                                                                                                                                              |
| `@wizeworks/silicaui-react` + the Tailwind plugin | every control in the chrome (root RULE #1 still binds)                                                                                                                                                                                                                                           |

**Built:** the session (documents in memory + the resolution chain), the op log and
its inverse for undo, canvas render/select/drag-drop, palette, inspector,
navigator, the pane chrome, and per-document save/preview/publish.

## The package

`wizeworks/packages/studio`, published as **`@wizeworks/studio`** — shared platform, per root
CLAUDE.md's ownership table, so sparx can adopt it later. Piggles is the only
consumer at first; sparx's workbench stays on `<Builder>` untouched.

The scope is `@wizeworks`, not `@sparx`: a package Piggles is the first consumer of
should not make Piggles take a new dependency on the other brand's name. The twenty
`@sparx/*` packages the console already imports are unaffected — RULE #0's ownership
table permits them, and they are libraries rather than an app.

Two entry points, mirroring silicaui's own split:

- `@wizeworks/studio` — headless. Documents, session, ops, undo, the resolution chain.
  No React, so api-rest and workers can import the types.
- `@wizeworks/studio/react` — the pane-ready builders and their chrome.

## Panes

Each pane owns **one** document and **reads** the ones above it as inert context.
Everything a builder needs — canvas, insert, inspector, navigator — lives inside
its own pane.

| Pane              | Owns              | Reads                                 |
| ----------------- | ----------------- | ------------------------------------- |
| Theme builder     | a theme           | —                                     |
| Layout builder    | the site's layout | its theme                             |
| Page builder      | one page body     | the layout (inert chrome) + its theme |
| Component builder | one symbol master | the theme                             |
| Email builder     | one email         | — (own session)                       |

Edit a token in the theme pane and every open layout and page pane repaints,
because they subscribe to that theme document — they never hold a copy. Same for
layout: the page canvas renders inside its chrome as non-editable context, which
is what `composeFrame` already does.

Three things fall out of this rather than needing design:

- **Per-pane undo is automatic.** Different panes hold different documents, so
  their histories were never one stack.
- **Save and publish get their real granularity.** Publish a page. Publish the
  layout without the pages. Publish a theme. That is what `published_at` on each
  table was always for.
- **The peer collision disappears.** Your own panes share a session, so nothing
  round-trips through the socket, and presence goes back to meaning other people.

## Themes become rows

The one real schema change. Today a tenant's saved themes are a JSON library on
`builder_sites` — per-site, authoring-only, with no published copy — which cannot
express a theme reused across sites, and cannot express a creator selling one.

`builder_themes`, tenant-scoped, with its own `draft_tokens` / `published_tokens`
pair. A site applies one through `builder_sites.theme_id` / `published_theme_id`
— the same draft/published pointer pair `BuilderPage.frameId` already uses, so
trying a different look cannot repaint the live site until it is published.

**Three tiers, and only one of them is a row.** The first version of this section
put system themes in the same table under a null tenant, which needed an RLS
policy unlike every other `builder_*` table — readable by everyone, writable by
nobody. Building it showed that was solving a problem the repo had already
solved: platform presets ship in code
([`SPARX_THEME_GROUPS`](../../../../packages/silica-catalog/src/themes.ts), 20 of
them), and marketplace listings already live in
[`marketplace_themes`](../../../../packages/db/prisma/schema/68-marketplace.prisma)
with their publisher, price and install count. So:

| Tier                | Lives in             | Using it                   |
| ------------------- | -------------------- | -------------------------- |
| System preset       | code                 | copies into a row          |
| Marketplace listing | `marketplace_themes` | installs a copy into a row |
| The tenant's own    | `builder_themes`     | is the row                 |

Copy-on-use rather than a reference, so a preset or a listing changing under a
live site can never repaint it, and an author can always edit what they picked.
`origin` (`custom` / `preset` / `marketplace`) plus `source_key` /
`marketplace_theme_id` keep the provenance. `builder_themes` gets the ordinary
FORCE-RLS tenant policy with no exception.

The migration is `20270327000000_builder_themes` — after
`20270326000000_marketplace_origin_brand`, per
[wizeworks/packages/db/CLAUDE.md](../../../../packages/db/CLAUDE.md). Its backfill turns
each site's active theme and its saved-theme library into rows, and **loops
tenants setting `app.tenant_id` per tenant**: both tables are FORCE RLS and
`sparx_owner` is a non-superuser in production, so an unscoped pass reads zero
rows there while passing locally under a superuser.

## Decisions taken

- **One layout per site.** The table supports a catalog with `is_active`; the
  console will only ever create one. `frameId = 'none'` stays as the per-page
  "render bare" escape for a landing page, since the column and its CHECK
  constraint already exist. Say so if you want that gone too.
- **Components are site-scoped**, matching `builder_sites.silica_draft_symbols`.
- **Email keeps its own session** — its own document, its own publish, sharing
  only the chrome and the save spine.
- **We write past `site-service`.** New per-document endpoints talk to the three
  tables directly, running beside the existing blob route until sparx moves over.
  Deleting the assemble/shred is most of the win and it cannot happen while the
  blob route is the only writer.

## Risks

- **We own the editor forever.** silicaui builder improvements stop arriving free.
  Accepted: the blob is the thing we cannot live with, and it is structural.
- **The Inspector is the long pole** — semantic class-token controls across the
  whole silica + Tailwind vocabulary. The token helpers are reused, the UI is not.
- **Phase 0 is a real gate.** If the canvas cannot be rebuilt to the standard the
  current one sets, we stop and re-plan rather than shipping a worse editor.
- **The current files are inherited sparx code in violation of piggles RULE #0.5**
  (studio-surface 1,290 lines · email-editor 1,532 · site-check 855). Nothing new
  here may repeat that.
