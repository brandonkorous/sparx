# Piggles builders — tasks

**Version:** 1.10
**Author:** Brandon Korous
**Last Updated:** 2026-08-18

Progress for the plan in [README.md](README.md). One line per task. Tick a box
only when the thing is built to production quality — not stubbed, not "wired but
untested". Phases are ordered; **Phase 0 is a gate.**

Legend: `[ ]` open · `[~]` in progress · `[x]` done · `[!]` blocked (say why)

---

## Phase 0 — the gate (spike)

The one question the plan cannot answer from the types: can we rebuild the canvas
to the standard the current one sets? If not, stop and re-plan.

- [x] 0.1 Throwaway pane rendering a silica `Node` tree to real DOM with
      `data-sui-id` per element, inside a `[data-theme]` island
- [x] 0.2 Click-to-select + hover/selection outline rings (non-layout, no reflow)
- [x] 0.3 Drag to reorder within the tree; drop resolves before/after/inside off
      the hovered node's real DOM neighbours (the `siblingAxis` behaviour)
- [x] 0.4 Two panes over ONE in-memory theme: edit a token in pane A, pane B
      repaints, no socket, no second copy
- [x] 0.5 Written verdict in this file — go, or what blocks it

**Verdict: GO.** The canvas was built for real rather than thrown away — silica's
`Node` schema, `composeFrame`, `expandComponent`, `applyOverrides` and the class-
token helpers carry the parts that would have been expensive, and the drop rule is
pure geometry that tests without a browser. The three questions the plan could not
answer from the types are answered in code and covered by tests: 58 pass. What is
still unproven is how it FEELS in a browser, which is task 9.4.

## Phase 1 — the package

- [x] 1.1 `wizeworks/packages/studio` — both exports (`.` and `./react`), in the
      workspace glob, typecheck + lint clean, 94 tests. Built by hand rather than
      through the `new-workspace-package` skill, which is why this sat open; the
      package it produced is complete either way
- [x] 1.2 Document types — `ThemeDoc`, `LayoutDoc`, `PageDoc`, `ComponentDoc`,
      `EmailDoc`; each with identity, draft tree/tokens, and publish state
- [x] 1.3 `Session` — holds open documents, subscriptions, dirty state; one per
      site, one for email
- [x] 1.4 Op log — the op union, `apply`, and `inverse` for undo
- [x] 1.5 Per-document undo/redo stacks
- [x] 1.6 The resolution chain — `resolve(page) → { body, chrome, theme }` for
      the canvas, off `composeFrame` + `resolveThemeTokens`
- [x] 1.7 Class-token read/write over the reused silica helpers
- [x] 1.8 Unit tests: ops round-trip, inverse restores, resolution chain

## Phase 2 — data

- [x] 2.1 Migration `20270327000000_builder_themes` — `builder_themes` with
      `origin` (`custom` | `preset` | `marketplace`), `draft_tokens` /
      `published_tokens`, `source_key`, `marketplace_theme_id` + version
- [x] 2.2 RLS on `builder_themes` — the ordinary FORCE-RLS tenant policy, no
      exception. The planned null-tenant rows are gone: presets live in code and
      listings in `marketplace_themes`, so nothing shared needs a row here. See
      README "Themes become rows".
- [x] 2.3 `builder_sites.theme_id` / `published_theme_id` (additive; sparx's
      `site-service` untouched)
- [x] 2.4 Backfill: `silica_draft_saved_themes` → `builder_themes` rows per tenant
- [x] 2.5 Serve the 20 `SPARX_THEME_GROUPS` presets read-only from code
      (`GET /v1/builder/themes/presets`). No seed and no data stage: nothing is
      stored until an author uses one, and then it is THEIR row.
- [x] 2.6 Per-document endpoints. Themes are new (`/v1/builder/themes/*` +
      `/selection`). Pages, layouts and components ALREADY had them — the blob was
      never the only writer, it was just the only one the editor used.
- [x] 2.6b TRUE per-row writes — `writePageRoot` and `writeFrameRoot`: one row, one
      UPDATE, nothing else read or written. **This was not the optimisation it was
      filed as.** The old path spliced the document into a whole-site payload and
      handed it to `sync`, which upserts EVERY page in the roster — so two panes
      saving two different pages could put a stale copy of one back over a save that
      had already landed. Deletion was never the exposure (`pagesToDelete` refuses to
      infer a removal from absence), which is exactly why nothing caught it: what it
      cost was the CONTENT of a page nobody had open. Components were already narrow
- [x] 2.7 Version history for every document type. Pages, the chrome and saved
      pieces are DERIVED from the existing site snapshots (`documentHistoryService`,
      see 8.2). A LOOK gets its own table — `builder_theme_versions`, migration
      `20270328000000` — because a look is TENANT-wide and those snapshots are
      PROPERTY-scoped: a history keyed by property could only say when one of the
      sites wearing it happened to be saved, never when the look itself changed.
      Sealed on save, publish and restore, deduped by content hash so a rename adds
      no row, pruned on a 30-newest + 90-day window. The backfill gives every
      existing look a first version, so the pane never opens on "nothing saved yet"
      for something someone has been using for months
- [x] 2.8 Marketplace looks — a third shelf in the look dialog, under the business's
      own and the ready-made ones. Installing COPIES the listing into a
      `builder_themes` row tagged with which listing and which version, so "there is
      a newer version of this" stays answerable while the row is theirs from the
      moment it lands. A pointer would be the other design and it is the wrong one
      for a LIVE site: a publisher revising their theme would repaint someone's shop
      with no warning. A listing with no token bag resolves by slug from code and is
      left OUT of the shelf rather than shown with a button that cannot work
- [x] 2.9 `check:routes`, `check:events` and `check:migration-order` pass; the
      blob route still serves sparx unchanged
- [x] 2.10 The storefront reads the new pointer — `resolveStagedTheme` and
      `effectiveTheme` prefer the `builder_themes` row, falling through to the
      legacy column and then to brand-derived
- [x] 2.11 Site publish moves `published_theme_id`, so choosing a look never
      repaints the live site on Save

## Phase 3 — theme builder pane

- [x] 3.1 Pane shell + registry entry (`builder.theme`, "Look & feel"), and the
      session provider it binds to, mounted ABOVE the dock in both shells
- [x] 3.2 Token editing — every color, radius, control-size, depth, focus and
      motion token silica declares, driven off `SEMANTIC_ROLES` / `SURFACE_TOKENS`
      / `SCALAR_TOKENS` rather than a hand-written list, with live contrast
      warnings and a real-component preview
- [x] 3.3 Theme library: the tenant's own + the 20 ready-made shelves; picking one
      COPIES it and applies it, and the marketplace shelf beside them (2.8)
- [x] 3.4 Duplicate, rename and DELETE, from the look's own row. The confirm NAMES
      the sites wearing it, read at the moment of asking rather than held from when
      the pane opened — and `themeService.usages` now returns those names, because a
      property id answers nothing a business owner can act on. Delete stays refused
      server-side while a site wears it, and the server's own sentence is what the
      toast shows
- [x] 3.5 Save · publish for the theme alone. History pane is 8.2

## Phase 4 — layout builder pane

- [x] 4.0 `PUT /v1/builder/layouts/silica` — the layout's own Save
- [x] 4.0b `GET /v1/builder/layouts/silica` — the layout's own LOAD. One row, so
      opening the pane costs the same on a three-page site and a three-hundred-page
      one; `siteService.loadFrame` seeds the starter chrome when nobody has authored
      any, and says which it handed back (`stored`)
- [x] 4.0c `POST /v1/builder/layouts/silica/publish` — the chrome goes live ALONE.
      The release it seals carries the previous release's manifest forward with this
      layout swapped in, so every release stays a complete site and rollback keeps
      working (`siteService.publishFrame`)
- [x] 4.1 Pane shell + registry entry (`builder.layout`, "Header & footer")
- [x] 4.2 Canvas over the frame tree with the Outlet pinned. Structural, not a
      guard list: the Outlet is not an `AddressableNode`, so it has no id to select,
      no Navigator row, and nothing to drag — and `canRemove` refuses any node whose
      SUBTREE holds it, so deleting the wrapper around it is refused too
- [x] 4.3 Insert palette scoped to chrome + host cores. A layout sees 143 items
      (all 10 navbars + footers, the announcement bar, contact strip, onward links,
      opening hours, find-us, newsletter signup, map/embed) against a page's 258 —
      no heroes, pricing, testimonials or galleries. Host cores reach the palette
      for the FIRST time here (`HOST_COMPONENTS` → `hostCore`); a layout gets the
      chrome ones (brand, theme toggle, legal links, map), a page gets all 17.
      The sparx-side list is an ALLOWLIST, so a section added next month is page
      content until someone decides otherwise
- [x] 4.4 Inspector; theme read live from the theme document through the session
- [x] 4.5 Navigator
- [x] 4.6 Save · publish for the layout alone. History is 8.2, as for the theme
- [x] 4.7 Host cores DRAW on the canvas (the real brand mark, a skeleton for the
      page-sized ones) and bound text resolves through the platform's own resolver
      — `renderHostNode` + `resolveBinding` are wired, so a header previews the
      business's actual logo instead of a grey box
- [x] 4.8 The saved-piece library loads into the session up front. Without it a
      layout holding a saved design rendered "This saved design is no longer
      available" over a piece sitting safely in the library — a lie an author would
      reasonably act on by rebuilding something they never lost

## Phase 5 — page builder pane

- [x] 5.0 `PUT /v1/builder/pages/:id/silica` — one page's own Save
- [x] 5.0b `GET /v1/builder/pages/:id/silica` — one page's own LOAD (body +
      settings). Several page panes open together is the ordinary case here, so the
      cost is per pane rather than per pane × per page in the site
- [x] 5.0c `POST /v1/builder/pages/:id/silica/publish` — one page goes live, WITH
      the chrome pointer it asks for. Same manifest carry-forward as the layout, and
      it re-grades that page's SEO afterwards (advisory; a failed audit never fails
      the publish that earned it)
- [x] 5.1 Pane shell + registry entry (`builder.page`), opened with `{pageId}`.
      Opened WITHOUT one it shows the page list rather than a blank canvas, and
      picking a page `replace`s that pane — so the picker never lingers behind the
      editor it opened
- [x] 5.2 Canvas: page body editable, layout chrome rendered inert around it.
      `resolveCanvas` composes the two and hands back the page root's id; the canvas
      refuses selection, drag and drops outside it, and the Navigator lists only the
      page's own tree
- [x] 5.2b The chrome is opened by the PROVIDER, not by the layout pane. A page pane
      on its own would otherwise find no layout, fall back to drawing the page bare,
      and show an author a missing header that looks exactly like a header they
      deliberately removed. Two opposite states must never render the same
- [x] 5.3 Full insert palette — `SPARX_CATALOG` + `SITE_CATALOG` + all 17 host cores
- [x] 5.4 Inspector incl. the page's own settings, under the page root. The host
      seam now carries WHICH document and whether the node is its root
      (`InspectorContext`), which is what lets an app put a document-level panel
      there at all
- [x] 5.5 Navigator
- [x] 5.6 Page settings: name, address, what wraps it (`frameId`, incl. 'none' for a
      bare landing page), which products a product template is for, and the search
      wording. Every one of them is an OP on the document — so they mark the pane
      unsaved, undo with ⌘Z, and go to the server on the same Save as the words on
      the page. A settings drawer with its own Save button is two saves wearing one
      pane
- [x] 5.7 Data bindings through the platform's own `createSilicaResolver`, over the
      same preview root the brand mark draws from — one answer about who this
      business is, not two
- [x] 5.8 Device widths driving real `@container` reflow (no second mobile editor) —
      the sized canvas element IS the container, so `@3xl:`/`@5xl:` classes in the
      tree reflow against the device the author picked
- [x] 5.9 Save · publish for the page alone. History is 8.2, as for theme and layout
- [x] 5.10 Several page panes open at once, each on a different page. Free from the
      dock: `descriptorKey` includes params, so `builder.page?pageId=A` and
      `?pageId=B` are two panes. The list carries an explicit "open alongside" —
      side by side is the reason this builder is per-document, so it is an action on
      the row rather than something to discover in a menu

## Phase 6 — component builder pane

- [x] 6.0 **The two stores, finally straight.** A saved piece lives in one of two
      places and a page tells them apart by ONE character: the tenant LIBRARY
      (`builder_components`, shared across every site the business owns) is referred
      to as `tenant:<key>`, and a site's OWN pieces
      (`builder_sites.silica_draft_symbols`) carry silica-minted ids with no colon.
      Every read merges both; every write routes on the prefix
- [x] 6.0b `GET/PUT/DELETE /v1/builder/site/symbols[/:id]` — the site half had no
      per-document surface at all, only the whole-site blob. `setSymbol` is a
      read-modify-write of ONE json column, so a piece pane saving a master can never
      overwrite a page another pane is editing
- [x] 6.1 Pane shell + registry entry (`builder.piece`), opened with `{pieceId}`;
      the list when opened without one, with open-alongside per row
- [x] 6.2 Edit a master; instances in open page panes update live. Free from the
      session: `symbols()` prefers a LIVE store over the loaded copy, so the page
      canvas and the piece pane are reading one object
- [x] 6.3 Create from selection · rename · delete. "Save as piece" replaces the
      selection with an INSTANCE of the new master in the same act, so the page looks
      identical afterwards — saving and then re-placing by hand is the round trip
      that means nobody uses the feature. Delete is behind `useConfirm` and names
      where it is used, fetched at the moment of asking rather than held from when
      the pane opened
- [x] 6.4 Instance overrides preserved — the canvas draws through `applyOverrides`
      and a save writes only the master root, so a per-instance override is never in
      the payload to be lost
- [x] 6.5 A piece has NO Publish of its own, and the pane says so: it goes live with
      whatever page or layout carries it, on that document's Publish. A button here
      would promise something the storefront does not do

## Phase 7 — email builder pane

- [x] 7.1 Own session document, own undo, own op set. `EmailTreeOp` is a SEPARATE
      union from `TreeOp`, not a dialect of one: an email node has no class, no tag
      and no attributes, and its children arrays are typed per kind — so one
      `email.patch` covers every visual decision, and its inverse is the previous
      value of exactly the keys it wrote. `isEmailTreeOp` is a listed set rather
      than a prefix match, because `email.setSubject` is a FIELD op sharing the
      prefix and routing it into the tree applier would silently stop renames working
- [x] 7.1b Structure is adjudicated by silica's own `canHold`, never a second local
      answer. Drops CLIMB (`resolveEmailDrop`): in a closed vocabulary half the
      aimed drops are illegal, so a drag that ends with nothing happening reads as a
      broken editor rather than as a rule. A band aimed at a line of copy lands
      above that line's section
- [x] 7.2 Canvas, palette, layers and inspector for the whole email vocabulary — all
      thirteen kinds, every field on each. Authored values reach the canvas as a
      real stylesheet scoped by attribute, never a `style` prop. `lineHeight` is a
      PX count (the projector emits it as one); written unitless a 16px line draws
      24 lines tall
- [x] 7.3 Subject + preheader are DOCUMENT fields, edited in the Inspector with
      nothing selected — so changing the subject marks the pane unsaved, undoes with
      ⌘Z, and saves with the words. The email's own name is there too
- [x] 7.4 Merge tags resolve on canvas against EMAIL sample data, through the
      platform's own evaluator — the same one the send uses, so `?? "there"` reads
      the same on screen as in the inbox. Its own host seam (`emailPreview`), never
      the site canvas's: on an email `customer.firstName` means the recipient, and
      resolving it against the site's preview root prints a plausible WRONG name.
      An unrecognised tag stays exactly as authored — blanking it would make a typo
      look like a value that happened to be empty
- [x] 7.5 Save · publish per email. Publish saves first: publishing a draft the
      server has not seen would send the PREVIOUS email and report success. History
      is Phase 8.2, like every other document's
- [x] 7.6 One pane per email, opened from the list, with open-alongside per row.
      Delete (behind `useConfirm`, and it says when the email is live) and
      make-this-site's-own are on the ROW, not in the pane: both are decisions about
      the catalog, not things you do while designing
- [x] 7.7 The picture browser reaches the studio at last — `pickAsset` is wired on
      the host, so every image field in EVERY builder offers the business's own
      library instead of asking for a web address. It was only ever wired into the
      old email editor; the site builder's image field had been a bare URL box

## Phase 8 — lifecycle panes

- [x] 8.0 **Every studio pane had an address at last.** `check:routes` scanned
      sparx's catalog ALONE, so six panes built across Phases 3–8 — page, header &
      footer, look, saved piece, history, preview — went the whole way with no route.
      Nothing failed: an unaddressed pane falls back to `/`, so the bar goes blank
      when you focus it and a link to a page editor cannot be sent. The script now
      scans BOTH consoles, which is what stops it happening again
- [x] 8.1 Preview pane — the real page, served by the real storefront, in a pane
      BESIDE the canvas. The token no longer reaches an address bar, browser history
      or a paste buffer, and it is re-minted per preview (a stale one renders the
      PUBLISHED site while claiming to be a preview). An EMAIL previews as the
      email-safe markup the send produces, with its pre-send checks above it. A
      document with no address of its own — the chrome, a look, a piece — previews
      the home page and says so
- [x] 8.2 History pane — per document, two ladders, restore. **Derived, not stored:**
      the whole-site snapshots already carry a manifest of `{ownerKind, ownerId,
hash}`, so one document's history is the points where ITS hash changed. No
      table, no migration, and no second write path to disagree with the first.
      Four stores behind one shape — the site snapshots, the shared-piece library,
      an email's own versions, and a look, which has none yet and SAYS so rather than
      showing an empty list that would read as "you have never changed this"
- [x] 8.2b A restore RESETS the open document. It is the one write where the server
      is the authority, so the pane is handed the restored copy rather than left
      holding the tree the author just asked to be rid of — which the next Save would
      have put straight back
- [x] 8.2c Saving or deleting a saved piece now seals a version. It wrote the JSON
      column directly and skipped the snapshot, which made a piece the ONE document
      with no way back
- [x] 8.3 Publish pane — what is waiting, the pre-publish check (advisory, run on
      ask, grouped by severity rather than by page so one mistake does not look like
      four), every version that went live, and rollback. Rollback is WHOLE-SITE and
      confirmed: it is the only control in the console that changes what visitors see
      with no publish step after it
- [x] 8.4 One dirty indicator: every builder pane declares itself through
      `useDirtySource`, so the tab dot, the status bar and the close guard all agree.
      Plus the hole those cannot see — a document can be unsaved with NO PANE OPEN,
      because the session outlives its panes on purpose — closed with an unload guard
      on the session itself
- [~] 8.5 The session survives a pane closing and reopening by construction: it is
  mounted above the dock, `open` returns the store already holding a document, and
  a torn-off pane moves DOM rather than remounting the provider. **Unproven in a
  browser**, which is 9.4 — and a tear-off is exactly the case where "by
  construction" has been wrong before

## Phase 9 — cutover

**SPARX IS NOT TOUCHED BY ANY OF THIS.** `sparx/apps/workbench` keeps its editor
exactly as it is, forever as far as this plan is concerned. What Phase 9 retires is
**Piggles' own copy** of it: the fork on 2026-08-14 duplicated the whole tree, so
`piggles/apps/workbench/surfaces/builder/studio/` is thirteen files of Piggles' own
that reference nothing under `sparx/` and that nothing under `sparx/` references.
Deleting them is invisible to the other product — which is the entire point of the
fork, and the reason this is safe to do at all. Root RULE #0 is the check.

- [x] 9.1 The Piggles console no longer mounts `@wizeworks/silicaui-builder`'s
      EDITOR. What it still imports from that package is the document layer — the
      email schema, the palette types — which is what `@wizeworks/studio` is built
      on and is not chrome. sparx's console goes on mounting the editor; the package
      is not being retired.
- [x] 9.2 Piggles' copy of the old editor is gone — nine files, 4,810 lines, plus
      the `builder.studio` registry entry. **sparx's originals are untouched.** The
      four domain modules MOVED to `lib/studio/` rather than being deleted with it
      (`brand-theme`, `host-cores`, `preview-data`, `saved-pieces`), and the reads
      the studio needed out of the old 815-line `data.ts` were extracted into
      `lib/studio/site-data.ts` — the site facts every pane sits on, without the
      whole-site load/save/publish that went with the editor.
      `/builder` still addresses sparx's editor, so a link to it resolves there and
      simply resolves to nothing in Piggles, which is the honest answer for a screen
      that product no longer has
- [x] 9.3 RULE #0.5 across the studio: no file over 250 lines, no function over 50.
      Fourteen were over — the fix was mostly pulling a row, a toolbar or a write out
      of a component that had quietly become three things
- [~] 9.4a **First browser defect, and it was a whole class of one.** The Layers rail
  did not scroll — it ran off the bottom of the pane, clipped by the host's
  `overflow-hidden`, with no scrollbar. Cause: silica's `.tabs` root is
  `display: block` (deliberately — "just a flow container"), so a `<TabsPanel>`
  is not a flex item and `flex-1` on it is INERT. Nothing below it is ever
  height-constrained, so the `overflow-auto` further down has no bounded box to
  scroll inside. It looks correct until there is more content than fits.
  Three tab sets had it — the site rail, the email rail, and the Inspector's own
  Design/Settings — so the fix is one `FillTabs` composition in the studio package
  rather than four sprinklings of the same classes, with the gotcha written down
  where the next rail will read it. The two email rails also assumed they were
  already flex items; they are `h-full` now and scroll wherever they are mounted
- [ ] 9.4 Drive it as a business owner: build a site end to end — theme, layout,
      three pages, a component, an email — and publish it. Click it, do not
      `fetch` it.
- [x] 9.5 `piggles/apps/workbench` typechecks and lints clean (`--max-warnings=0`),
      prettier clean, `@wizeworks/studio` 94 tests green, and `check:routes` (336
      surfaces) / `check:events` / `check:boundaries` (0 `@sparx/*` under piggles) /
      `check:deletability` all pass. **`check:migration-order` cannot run yet** — it
      reads migrations at git HEAD and the tree move is still uncommitted, so it
      reports the path rather than passing silently. `20270328000000` sorts after
      `20270327000000` by hand.
- [x] 9.6 [STATUS.md](../../../STATUS.md) records the cutover — the eight panes, the
      deleted copy, the three defects no check could find, and what is still unproven.
      Nothing in [FOLLOW_UPS.md](../../FOLLOW_UPS.md) was about the builder, so
      nothing closes there
- [ ] 9.6b Update [STATUS.md](../../../STATUS.md) again after 9.4 — the drive-through
      is what turns "built" into "verified", and this file says so in its own header
      [FOLLOW_UPS.md](../../FOLLOW_UPS.md)

## Phase 10 — a builder you can use with a thumb

Plan and findings: [MOBILE.md](MOBILE.md). Ordered so that verbs land before
layout — after 10.1–10.3 a phone can already build a page inside today's
columns, which is not true today. All of it is `@wizeworks/studio`; sparx
inherits every fix when it cuts over.

- [ ] 10.1 A **node action bar** in the Inspector header — move up, move down,
      move in, move out, duplicate, delete — over the ops that already exist
      (`node.move`, `node.insert`, `node.remove`). Shown on every width, not
      only narrow: three of these six are reachable today only by mouse-drag or
      keystroke, which is a keyboard-access hole as much as a touch one.
- [ ] 10.2 **Tap to place** from the palette, with a stated rule — inside the
      selection when it can hold children, otherwise straight after it — and the
      new node selected and scrolled into view, so where it landed is visible
      rather than guessed.
- [ ] 10.3 **Move here** in Layers: a move control per row turns the tree's gaps
      into tappable targets, resolved through the same `resolveDropTarget` the
      drag path uses so the two can never disagree.
- [ ] 10.4 `lg:` out, `@container` in, across `tree-builder.tsx` and
      `email-builder.tsx` — the last two viewport queries in the package. Three
      tiers: three columns at 64rem, canvas + Inspector at 40rem, canvas alone
      below.
- [ ] 10.5 Rails become **edge drawers** below 40rem — silicaui `<Drawer>`,
      Layers/Insert from the left, the Inspector from the bottom at about half
      height so the selected block stays visible above it.
- [ ] 10.6 The narrow bottom bar is **deleted**, not restyled. The shell floats
      its nav bar on that edge and reserves 80px for it; two stacked bars is what
      the status strip was already dropped for. Triggers, devices, undo/redo and
      Save/Publish all move to the top bar; Preview, History and Save as piece
      fold into an overflow menu; the status line becomes a word beside Save.
- [ ] 10.7 The device switcher **scales** a real 390/834/1440 frame instead of
      clamping it with `max-w-full`, so Computer on a phone shows a desktop
      layout rather than a phone layout wearing the word Computer.
- [ ] 10.8 Theme builder: board as canvas, rail as a left drawer below 40rem,
      `max-h-96` gone.
- [ ] 10.9 Every control in the five builders clears the 44px tap floor the nav
      bar already sets.
- [ ] 10.10 Drive all five builders on a real phone and a real tablet — add a
      section, move it, restyle it, delete it, save, publish — and on a desktop
      pane dragged narrow, which is the same code path and the case no phone
      will ever exercise. No spec files; this is the 9.4 kind of verification and
      the only one that can find what a green check cannot.

---

## Two bugs Phase 6 found in Phase 4's work

Both were in `useSymbolLibrary`, and both would have rendered the same way: a saved
piece reported as **"This saved design is no longer available"** over one sitting
safely in the library.

1. **The wrong ids.** Library pieces were loaded under their bare `key`, but a page
   refers to one as `tenant:<key>`. Every instance of every shared piece, on every
   page, would have resolved to nothing.
2. **Half the pieces missing.** Only the tenant library was loaded. A site's own
   symbols — what silica's "Save as component" has always written — were not read at
   all, because no endpoint returned them without the whole site blob.

Neither is visible to a typecheck, a lint or a test. Both are the shape this builder
keeps producing: **absent behaves like a confident wrong answer.**

## Verified green (2026-08-16, through Phase 6)

| Check                                                           | Result                          |
| --------------------------------------------------------------- | ------------------------------- |
| `@wizeworks/studio` typecheck · lint · tests                    | clean · clean · **58 passing**  |
| `@wizeworks/builder` typecheck · lint · tests                   | clean · clean · **112 passing** |
| `wizeworks/services/api-rest` typecheck · lint                  | clean                           |
| `piggles/apps/workbench` typecheck · lint                       | clean                           |
| `check:routes` · `check:events` · `check:boundaries` · order    | all pass                        |
| prettier                                                        | clean                           |
| Every new Piggles file under 250 lines, every function under 50 | yes                             |

`check:boundaries` landed mid-slice — a ratchet on `@sparx/*` usage under
`piggles/`, which may only go down. The new studio code sits inside it (432,
baseline 432): the only platform packages it reaches for are `@wizeworks/query`,
`@wizeworks/builder-schemas` and `@wizeworks/silica-catalog`, all brand-blind and all in
the rename waves.

**Not clean, and not this slice.** The `@sparx/*` → `@wizeworks/*` migration is
in flight in the same tree, and it currently breaks three things this work has to
share a repo with: `wizeworks/packages/auth/src/server.ts` cannot resolve
`@wizeworks/links/server`, `wizeworks/packages/cms-editor/src/editor.tsx` cannot resolve
`@wizeworks/silica-corrections`, and `check:docker` wants 14 COPY lines for
`silica-corrections` / `ui` / `brand`. One knock-on lands in api-rest's own lint:
`routes/internal/operator-feedback.ts` reports six unsafe-type errors, all from an
import it can no longer resolve. `wizeworks/packages/studio` is copied correctly in the
Piggles console image, and every file in this slice is clean on its own.

Phase 6's full-`src` lint also caught eight `await`s on `toBuilderTenantContext`,
which is synchronous — mine, from Phase 3, and masked until now because the
package-wide lint never ran to completion while the tree was red. Fixed.

The layout palette's scoping was verified by running `mergeCatalog` over
`catalogFor('layout')` and `catalogFor('page')` and reading the result, not by
assuming the hide list matched: the first attempt hid nothing at all, because it
listed groups it was ALSO adding.

**Still not verified: how any of it looks or feels.** Nothing has been rendered in
a browser. That is task 9.4, and it is the only claim here a green check cannot
make.

**Not verified: how any of it looks or feels.** Nothing has been rendered in a
browser. That is task 9.4, and it is the only claim here that a green check cannot
make.

## Open questions

- [x] Q1 Package name — ANSWERED 2026-08-16. `@wizeworks/studio` in root
      `wizeworks/packages/studio`. Piggles takes no new `@sparx/*` dependency; the twenty it
      already has are unchanged, and the package itself may still import
      `@wizeworks/silica-catalog` + `@wizeworks/site-themes`.
- [ ] Q2 Does `frameId = 'none'` survive the one-layout-per-site decision?
      (Assumed yes — the column and its CHECK constraint already exist.)
      answer: yes
- [ ] Q3 When sparx adopts this, does `site-service`'s assemble/shred get deleted
      or kept for the MCP write tools that use it?
      answer: that will be addressed in the sparx cutover plan, not here. we do need to create a piggles mcp implementation now though.
