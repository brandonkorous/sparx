# Form & Modal Surface Inventory

Version: 1.16
Author: Brandon Korous
Last Updated: 2026-06-27

A complete census of every **form, create/edit flow, and modal/dialog** in the dashboard app
(`apps/dashboard/app`), with each one's current presentation and the work needed to bring it onto
the standard **form surface** — the drawer / modal / full-page detail-view system wearing the
**F layout** (form column + optional live "draft summary" column, one header, one bottom toolbar).

This is the burn-down list for applying the [`form-surface`](../.claude/skills/form-surface/SKILL.md)
skill consistently. The design spec is [docs/86](86-surface-frame-pattern.md); the three-registries
footgun and the procedure live in the skill.

> **Why this exists.** The line-item wizard family (product, quote, order, purchase-order, transfer,
> billing-document) is done and consistent. Everything else is a long tail of one-off presentations —
> full-page-only forms, self-owned `Modal`s, inline page-body forms, `window.prompt` calls. "Consistent
> look and feel" means working that tail down, not stopping at the wizards. This doc is the map.

---

## Legend

**Status**

- ✅ **done** — already on the F-layout / standard overlay, or a settings/detail surface that is correct as-is.
- ⚙️ **partial** — on the right primitive but missing a piece (no live summary; a non-standard confirm).
- 🔲 **needs migration** — full-page-only, self-owned `Modal`, or inline page-body form that should move onto the overlay system.
- ➖ **N/A** — a standardized `useConfirm` dialog, a shared `ImportDialog`, a picker, or a read-only panel. No redesign needed.

**Kind** — `Create wizard` · `Single-step create form` · `Edit/record form` · `Settings form` ·
`Substantive dialog/modal` · `Confirm dialog (useConfirm)` · `Inline page-body form` · `Bulk/action modal` · `Picker dialog`.

**Current presentation** — `overlay (detail system)` · `full-page route only` · `self-owned modal` ·
`raw Radix Dialog` · `inline in page body` · `slide-over/sheet`.

---

## Scoreboard (approximate)

| Status             | Count | Meaning                                                                                   |
| ------------------ | ----- | ----------------------------------------------------------------------------------------- |
| ✅ done            | ~63   | wizards already on F-layout, surface-aware create forms, settings pages, standard pickers |
| ⚙️ partial         | ~3    | a few non-standard confirms riding on bigger (still-pending) migration rows               |
| 🔲 needs migration | ~70   | the real backlog — full-page forms, self-owned modals, inline detail-page forms           |
| ➖ N/A             | ~40   | `useConfirm` dialogs, `ImportDialog` users, read-only panels                              |

The backlog is large but **highly repetitive** — most of it is the same three or four shapes repeated
across modules, which is exactly what the `form-surface` skill is for. The waves below order it by shape,
so each wave is "the same move, N times."

---

## Commerce — page-by-page walk-through (current focus, 2026-06-21)

**Working mode (changed):** one commerce page at a time **in Playwright** — open it, assess against the
`SurfaceFrame` standard, apply a focused fix, verify on screen, then move on. NO bulk agent fan-out:
forcing the whole tail through at once is what produced the `WizardFrame` misnomer and the edit-panel
confusion. Slow and verified beats fast and misaligned.

**Each page is also scored** via the `surface-review` skill (`/surface-review <route>`): a read-only audit
agent maps the page and grades it **UI 1–10 · UX 1–10** with a mandatory "gap to 10" list; we verify on
screen, fix, and re-score. UI = on-system & well-composed; UX = serves the user's job (related data
loaded, one home per concern, cross-module color wayfinding, no dead ends). Scores land in the
`Score (UI/UX)` column below and the per-page detail in the **Surface review log**.

**Create surfaces: DONE.** Every commerce create surface is on `SurfaceFrame` and wired (products,
categories, collections, pricing, discounts, bundles, configurator, gift-cards, account-credit, shipping
zone/profile, tax zone → overlay; provider install → full-page). So the remaining commerce work is the
**edit + inline + tool** surfaces. Treatment per the skill §0 edit rule (single-form detail →
`SurfaceFrame`; tab/panel editor → module-card cleanup inside the detail, NOT a nested frame).

Walk these in order — each is `[ ] open → assess → focused fix → verify`:

| #   | Page (route)                                                | Surface(s)                                                                                                                                                       | Treatment                                                                                                                                                                                                                      | Score (UI/UX)          |
| --- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| 1   | Categories `/commerce/categories/[id]`                      | `category-edit-form` (the whole detail body)                                                                                                                     | single-form detail → **`SurfaceFrame`** (symmetric with create)                                                                                                                                                                | UI **9** / UX **9** ✅ |
| 2   | Collections `/commerce/collections/[id]`                    | `collection-meta-form` (Metadata tab)                                                                                                                            | tab panel → `<Card variant="module">` + consistent Save, no `CardFooter` toolbar                                                                                                                                               | UI **9** / UX **9** ✅ |
| 3   | Products `/commerce/products/[id]`                          | `product-edit-form` (Edit tab) + variants/media/fitment/inventory panels; inline `new-variant-form` + `options-editor` (`-dialog` stubs were dead code, removed) | reviewed — strong as-is; cross-module accent finding overruled; 2 dead stubs cut                                                                                                                                               | UI **8** / UX **8** ✅ |
| 4   | Pricing `/commerce/pricing/[id]`                            | `price-list-entries-editor` + `price-list-status-bar`                                                                                                            | reviewed — entries editor clean; status badge → `statusTone` (was `color="outline"` no-op)                                                                                                                                     | UI **8** / UX **7** ✅ |
| 5   | Bundles `/commerce/bundles/[id]`                            | `bundle-editor` (already guarded + themed) + `bundles-list`                                                                                                      | list badge `text-xs`→size; detail sound in code, on-screen review pending a seed bundle                                                                                                                                        | UI **7** / UX **7** 🔶 |
| 6   | Configurator `/commerce/configurator/[id]`                  | `template-json-editor` + `template-status-bar`                                                                                                                   | reviewed — status badge → `statusTone`; danger-text/error-span → `<Text variant="danger">`; **raw-JSON editor = wrong for non-tech audience → structured editor DEFERRED**                                                     | UI **7** / UX **5** 🔶 |
| 7   | Returns `/commerce/returns/[id]`                            | `return-refund-form`, `return-approval-form`, `return-inspection-form`, `return-status-bar`                                                                      | reviewed — status badge → `returnTone`; 4× danger-text → `variant`; raw `select`→`NativeSelect`; 2 raw checkboxes → themed; action cards → `variant="module"`                                                                  | UI **8** / UX **8** ✅ |
| 8   | Reviews `/commerce/reviews` + `/[id]`                       | list + detail + `respond-form` + `moderate-actions`                                                                                                              | **FULL REMEDIATION** — queue showed product GUIDs + empty titles, no search, no bulk. BE: product-title joins on queue/detail, `q` search, bulk-moderate endpoints. FE: empty-title fallback, product links, search, bulk bar. | UI **8** / UX **8** ✅ |
| 9   | Q&A `/commerce/qa` + `/[id]`                                | list + detail + `answer-form` + `question-moderate-actions`                                                                                                      | **FULL REMEDIATION** — same gaps as Reviews (shared service/shape): product-title joins, `q` search, bulk-moderate. FE: product links, search, bulk bar.                                                                       | UI **8** / UX **8** ✅ |
| 10  | Shipping `/commerce/shipping/zones/[id]` + `/profiles/[id]` | `new-rate-form` (add rate) + profile detail                                                                                                                      | reviewed — 2 raw `select`→`NativeSelect`; danger-text→`variant`; "Manual rates" action card→`variant="module"`                                                                                                                 | UI **8** / UX **8** ✅ |
| 11  | Tax `/commerce/tax/zones/[id]`                              | `new-tax-rate-form` (add rate)                                                                                                                                   | reviewed — danger-text→`variant`; action card→`variant="module"`; surfaced unused `isActive` as `statusTone` badge                                                                                                             | UI **8** / UX **8** ✅ |
| 12  | Markup rules `/commerce/markup-rules`                       | `RuleForm` (expand-in-place)                                                                                                                                     | reviewed — already excellent (NativeSelect, live preview, `useConfirm`); status badge→`statusTone` soft; themed checkbox                                                                                                       | UI **9** / UX **9** ✅ |
| 13  | Surcharges `/commerce/surcharges`                           | `RuleForm`                                                                                                                                                       | reviewed — same polish as markup; status badge→`statusTone` soft; themed checkbox                                                                                                                                              | UI **9** / UX **9** ✅ |
| 14  | Fitment `/commerce/fitment`                                 | `fitment-reference-editor` add-rows                                                                                                                              | reviewed — clean lazy tree; fixed 4× `color="outline"` no-op global/tenant badges + `text-xs`→`size` sweep                                                                                                                     | UI **8** / UX **8** ✅ |
| 15  | Providers `/commerce/providers/[id]`                        | `provider-actions-bar`                                                                                                                                           | reviewed — `useConfirm` already in place (note was stale); hand-rolled muted `<span>`→`<Text>`                                                                                                                                 | UI **8** / UX **8** ✅ |
| 16  | Bulk pricing `/commerce/products/pricing`                   | `bulk-pricing-tool`                                                                                                                                              | reviewed — excellent tool; **page is the right shell** (preview table + scope pickers); themed picker checkbox                                                                                                                 | UI **9** / UX **9** ✅ |

Skip (read-only or correct as-is): carts, checkout-sessions, wishlists, reports, subscriptions detail,
settings, import/export dialogs, delete confirms, bulk-price-adjust modal.

> The per-module tables further down are the platform-wide census and lag this section — for commerce,
> THIS table is the source of truth (the tables still show the now-done create rows as 🔲).

---

## Surface review log

Per-page UI + UX scores from the `surface-review` skill (rubric + heuristics live in the skill). Each
entry is a punch-list, not an essay; re-scored after a fix lands. **10 is rare** — it means nothing left
to improve. A gap that recurs across pages is a **platform fix on the primitive**, logged once below.

### Categories `/commerce/categories/[id]` — UI 8→**9**/10 · UX 7→**9**/10 (2026-06-23)

- ✅ Strong: textbook F-layout in all 3 presentations; create/edit symmetric; toolbar order (Cancel
  leftmost → Delete → Save) correct; single-home (summary read-only facts, form editable) — no
  duplication; commerce accent consistent everywhere; system fidelity clean.
- ✅ FIXED (UI): Featured now a themed `@sparx/ui` `Checkbox` (`color="module"`); per-field help added
  (Parent trail + sibling sort note, Featured purpose).
- ✅ FIXED (UX): summary enriched — **breadcrumb ancestry** ("Nested under") + **subcategory count**,
  derived from the already-loaded tree (no extra fetch); fills the column. (No "View N products" link —
  there's no category-filtered products route yet; kept as a stat rather than ship a broken link.)
- ✅ FIXED (UX, platform): **dirty-state guard** — see platform section; Categories is the first adopter.
  Verified on screen: Cancel, host Close (X), and Discard-then-leave / dismiss-then-stay all behave.
- Decision (not a defect): edit stays open after Save (iterative verify) while create closes — kept on
  purpose; revisit if a consistent close-on-save is preferred.
- Remaining (keeps it 9, not 10): no category-filtered products view to link to; Switch-mode discards
  rather than preserves edits (it remounts the form — guarded, but ideal would preserve); a hard browser
  nav/refresh isn't guarded (OS-level `beforeunload`, intentionally out of scope).
- **Post-fix: UI 9 · UX 9** — all triaged gaps closed; the two "remaining" items are minor/deferred.

### Categories — create form + list (revisit) — UI 9/10 · UX 8→**9**/10 (2026-06-25)

Re-ran `/surface-review /commerce/categories` against the **create** form (`category-create-form`) and
the **list** (`categories-table`) — the 2026-06-23 pass scored the edit detail and assumed the rest rode
along. Two gaps the first pass missed:

- ✅ FIXED (UX, real): the **create form was never actually guarded.** The 2026-06-23 entry claimed
  "create/edit symmetric" + "dirty-state guard — first adopter," but only `category-edit-form` registered
  `useRegisterLeaveGuard`; `category-create-form` had none, so typing a name/description then
  Cancel / host-Close / backdrop **silently dropped it** (verified on screen — Cancel went straight to the
  list, no confirm). Now it computes `dirty` (any field entered) + registers a "Discard new category?"
  confirm; the success path routes through an **unguarded `close()`** (split out of the old `cancel`) so a
  completed create never self-prompts. Verified on screen: discard dialog fires on Cancel with entered
  work; **Create category** navigates clean and the new node appears (no false prompt).
- ✅ FIXED (UI): the list **Featured badge** was `variant="outline" className="text-xs"` — a bland neutral
  pill + the `text-xs`-instead-of-`size` anti-pattern. Now `color="accent" variant="soft" size="sm"`,
  matching the **collections** list's featured badge (one convention across the two commerce lists that
  carry a `featured` flag).
- **Post-fix: UI 9 · UX 9** — create + edit are now genuinely symmetric on the guard; the list badge is
  on-system.

### Collections `/commerce/collections/[id]` — Metadata tab — UI 7→**9**/10 · UX 7→**9**/10 (2026-06-24)

- ✅ Strong: correct tab-panel treatment (NOT a nested frame); SEO already loads a live health chip;
  type-not-editable guard rail explained in microcopy.
- ✅ FIXED (UI): Metadata panel now a **`<Card variant="module">`** (commerce stripe; Products + Rules
  tabs too, so the whole detail reads commerce); Featured is a themed **`@sparx/ui` `Checkbox`** (was a
  raw `<input type="checkbox">`); Save moved out of the bespoke `CardFooter` into the card body and is
  **dirty-aware** (disabled until something changes; clears the saved badge on edit).
- ✅ FIXED (UI, platform): **status pills carry a tone** — membership product pills (active→success,
  draft→warning, archived→neutral) and the list's type/featured/count badges were bland `neutral`/
  `outline` (one even passed `color="outline"`, a no-op → grey). Now `<Badge color={statusTone(s)} …>`.
  See platform section.
- ✅ FIXED (UX, platform): **SEO transparency** — blank SEO title/desc scored green ("present") because
  the live site + audit fall back to name/description; the editor never showed that. New `<SeoMetaFields>`
  makes the inherited value the placeholder + adds per-field "Use name/description". See platform section.
- Remaining (keeps it 9): the tab panel doesn't register the dirty-guard (full-page tabbed detail isn't
  wrapped in `UnsavedGuardProvider`; switching tabs/navigating away loses unsaved edits) — deferred until
  the guard extends to tabbed details; `collection-membership-editor` is 276 lines (warn-only).
- **Post-fix: UI 9 · UX 9.**

### Products `/commerce/products/[id]` — UI **8**/10 · UX **8**/10 (2026-06-26)

Tabbed record (Overview / Variants / Media / Pricing / Inventory / Fitment / Configurator / SEO / Market) +
full-height context rail. The read-only audit drafted 7/7; verifying against the screen RAISED it — the
audit's headline gap was wrong.

- ✅ Strong: textbook F-layout + a context rail that fills its column with a real rollup (handle, type,
  vendor, price, variant/media counts, inventory on-hand/available/below-reorder, category/collection/site
  counts, rating). Identity once (title/handle editable on Overview; visually-hidden `h1` for SR only). SEO
  consolidated to its own tab (single home). Lifecycle (Unpublish/Archive/Preview) in the frame header.
  Leave-guard wired on the editable forms (`product-edit-form`, `product-seo-form`).
- ❌ OVERRULED (audit's #1 UI gap): _"Fitment / Configurator / Market panels lack their own `<ModuleProvider>`
  wrap → wrong accent."_ There is **no `fitment` / `configurator` / `market` module** in `SparxModule`
  (`module-provider.tsx`) — those are commerce FEATURES, so commerce orange is correct, and `module="fitment"`
  wouldn't even typecheck. Verified on screen that the panels mapping to REAL modules wear the right hue
  (Inventory = amber, SEO = yellow). Cross-module wayfinding works as designed. _(Why we verify: the agent
  maps code, the screen + the type system are the truth.)_
- ✅ FIXED (cleanup): removed two **dead stub dialogs** (`new-variant-dialog`, `options-editor-dialog`) — zero
  imports app-wide; variant creation + the option-lattice editor already work as inline forms
  (`new-variant-form`, `options-editor`, rendered by `variants-panel`). The "Stubs to build" list is corrected.
- Considered, left as-is: no footer **Cancel** on the Edit/SEO tab panels — for a tabbed detail the drawer
  Close (X) + leave-guard cover "leave without saving"; the §5 single-form anchor rule doesn't transfer to a
  §5.2 tabbed panel. Inventory/Media/Fitment panels persist edits immediately (audit-logged movements) —
  operational lists where immediate persistence is correct, not the explicit-save form pattern.
- **UI 8 · UX 8** — strong, on-system, task-complete; the gap to 9–10 is only the minor inline-vs-footer
  options-editor pattern, nothing structural.

### Pricing `/commerce/pricing/[id]` — UI **8**/10 · UX **7**/10 (2026-06-26)

Small, focused price-list detail (identity heading + lifecycle bar, then the per-variant entries editor). docs
flagged it "confirm only"; found one real System-fidelity miss + minors.

- ✅ Strong: the entries editor is clean (variant picker + Fixed/Percent-off mode + min/max qty ladder), good
  empty state, helptext explains the resolution order; Archive is `useConfirm` (warning tone), Activate is
  `color="module"`. Identity heading is fine here — there's no editable name field on this detail, so it's a
  read-only-style identity (the transaction-detail exception), not an identity-twice violation.
- ✅ FIXED (System fidelity): the status badge used a local `STATUS_VARIANT` map that passed
  **`color="outline"` — a no-op → bland grey** for `draft`, with a raw lowercase label. Now
  `<Badge color={statusTone(status)} variant="soft" size="sm">{statusLabel(status)}</Badge>` (Draft → warning
  amber, verified on screen). Currency pill `text-xs` → `size="sm"`. Pricing had been missed by the 2026-06-25
  statusTone sweep; now consistent.
- Gap to 10 (UX): the price list's **name / priority / channel / validity aren't editable** after creation —
  the detail only edits entries + status, so renaming means delete+recreate. A small meta-edit form (or an
  editable heading name) would close it.
- Gap to 10 (UI): status + lifecycle render inline in the body heading, not teleported to the drawer chrome
  header via `DetailHeaderSlot` (docs/86 §5.1) — the older pattern; reads fine but isn't the house teleport.
  Deferred (larger refactor, out of scope for a confirm pass).
- **UI 8 · UX 7.**

### Bundles `/commerce/bundles/[id]` — UI **7**/10 · UX **7**/10 · 🔶 partial (2026-06-26)

⚠️ **On-screen review blocked: zero seed bundles** (the list is empty — "No bundles yet"). This pass is
code-level + the list; the detail wants a seeded bundle for a real eyes-on pass.

- ✅ Strong (code): read-only identity heading (bundle wraps a product whose title isn't editable here — the
  transaction-detail exception); `BundleDeleteButton` uses `useConfirm` (danger tone); the `BundleEditor` was
  already guarded (`useUnsavedGuard`) + checkbox-themed + same-product badge fixed in the 2026-06-25 sweep.
- ✅ FIXED: `bundles-list` inventory badge used `className="text-xs"` (the size-via-className anti-pattern) →
  now plain `<Badge variant="outline">`, matching the pricing-mode badge in the same table.
- Gap to 10 (UI/microcopy): the detail + list mode badges render **raw snake_case enums**
  (`sum_of_components`, `decrement_components`) — dev-speak; should humanize via the editor's own option
  labels. NOT fixed blind — wants screen verification + the canonical label vocabulary (deferred to a seeded
  pass).
- Gap to 10 (UI): the Configuration card is a plain `<Card>`, not `<Card variant="module">` — misses the
  commerce stripe (same as Pricing's cards). A cross-detail consistency opportunity, deferred.
- **UI 7 · UX 7 (provisional, code-level).** Re-verify on screen once a bundle is seeded.

### Configurator `/commerce/configurator/[id]` — UI **7**/10 · UX **5**/10 · 🔶 partial (2026-06-26)

The read-only summary (Options / Rules / Add-ons tables + lifecycle status-bar) is sound; the **edit
path is a raw-JSON textarea**, which is the dominant gap.

- ✅ FIXED (system fidelity): `_content.tsx` had a local `STATUS_VARIANT` map passing `color="outline"`
  (a no-op → grey) with `archived: 'warning'` (wrong tone) + a raw lowercase status string → now
  `<Badge color={statusTone(s)} variant="soft" size="sm">{statusLabel(s)}</Badge>` (same fix as Pricing).
- ✅ FIXED (danger affordances): the JSON editor's error used `className="text-[var(--color-danger)]"`
  and the status-bar error was a hand-rolled `<span className="text-xs text-[...danger]">` → both now
  `<Text variant="danger" role="alert" aria-live="polite">`. Icon-only Delete got `aria-label`/`title`.
- 🔴 **Gap to 10 (UX, the big one — DEFERRED):** the template is authored as **raw JSON**
  (`template-json-editor`). sparx's audience is non-technical business owners who don't know what JSON is —
  this is a target-audience mismatch, not a styling nit. Needs a **structured/visual editor** over the
  template schema (options → choices → rules → add-ons), with raw-JSON demoted to an advanced escape view.
  The in-product CardDescription already concedes "the visual rule editor is on the roadmap." Tracked in
  memory + the active-work index; **flagged by the user 2026-06-26, fix scheduled later.**
- Gap to 10 (UX): the Add-ons table shows a **truncated raw `variantId`** (`a1b2c3d4…`) — needs the API to
  resolve variant/product titles; a business user can't read a UUID. Backend-dependent, deferred.
- Gap to 10 (UI/structure): the page is a **bespoke full-page layout**, not on `DetailPageShell` /
  `DetailHeaderSlot` — lifecycle lives in an in-body status-bar and the JSON editor has no leave-guard host.
  Both fold naturally into the deferred structured-editor rebuild rather than a patch now.
- **UI 7 · UX 5.** The JSON-as-primary-authoring surface caps UX until the structured editor lands; the
  chrome itself is now system-clean.

### Returns `/commerce/returns/[id]` — UI **8**/10 · UX **8**/10 (2026-06-26)

A read-only **transaction detail** (identity heading is correct — no editable name) with three
status-gated inline action forms (Approve / Record inspection / Issue refund) + a status-bar. The flow
itself is well-modelled (forms appear only in the valid lifecycle state); the gaps were all
system-fidelity, now fixed.

- ✅ FIXED (status): header badge was `<Badge variant="outline">{status}</Badge>` (raw, untoned) →
  `<Badge color={returnTone(s)} variant="soft" size="sm">{statusLabel(s)}</Badge>`. The returns lifecycle
  is fully covered by `statusTone`, with one **justified domain override** (`returnTone`): a _refunded_
  return is the happy terminal state, so it reads green — the shared dictionary reads bare `refunded` as
  danger (order money-out), which the dictionary's own comment sanctions overriding per-domain.
- ✅ FIXED (danger affordances): **four** error renders used `className="text-[var(--color-danger)]"` (one
  even a hand-rolled `<span>`) → all now `<Text variant="danger" role="alert" aria-live="polite">`.
- ✅ FIXED (re-skinned controls): the inspection form hand-built a **raw `<select>`** (border/bg
  utilities) and a **raw `<input type="checkbox">`**; the refund form had another raw checkbox →
  `NativeSelect` + themed `<Checkbox color="module">` (the same control-fidelity fix flagged for the site
  scope checkboxes). Condition `<option>`s now humanize (`used_good` → `used good`).
- ✅ FIXED (module-card cleanup, the row's named intent): the three **action** cards now wear
  `<Card variant="module">` (commerce stripe) while the read-only tables (Requested items / Inspection
  history / Settlement) stay plain — a deliberate signal that striped = an editable commerce action.
- Gap to 10 (UX): line-item rows show **truncated raw UUIDs** (`orderItemId`/`returnLineItemId`
  `.slice(0,8)`) — a merchant can't read those; wants the API to resolve order-item/product labels.
  Backend-dependent, deferred (same shape as the configurator Add-ons gap).
- Gap to 10 (UI): the "Deny return" reason capture is a **self-owned `Modal`** (correct primitive, Cancel
  - danger primary) rather than the standard overlay — acceptable as a small reason-capture; noted not
    migrated.
- **UI 8 · UX 8.** Verified via typecheck/lint (every fix is a proven platform pattern); on-screen pass
  pending a seeded return in each gated status.

### Reviews + Q&A — verified on screen (2026-06-27)

After the full remediation + the commerce-ops seed, the Reviews queue was confirmed live: **product
names resolve** (no GUIDs), the **empty-title fallback** renders body snippets, **search** + **bulk
selection** are present, and the **bulk bar** (Approve/Flag/Reject/Delete) slides up on selection. Q&A
shares the identical components. Closes the on-screen gap that empty seed data had blocked.

### Rows 10–16 — Shipping · Tax · Markup · Surcharges · Fitment · Providers · Bulk pricing (2026-06-27)

Consolidated pass (we're in the fix stage, not the documentation stage). The back half of the commerce
walk-through was **higher quality than the front half** — the rule managers + bulk-pricing tool are
already exemplary (NativeSelect, `useConfirm`, live previews, `variant`-typed errors). Fixes were
mostly the recurring platform nits:

- **Re-skinned `<select>`** → `NativeSelect` (shipping add-rate, 2×).
- **`className="text-[var(--color-danger)]"` errors** → `<Text variant="danger" role="alert">` (shipping + tax add-rate forms).
- **Status badges** → `statusTone`/semantic-soft (markup + surcharge Active/Paused/Off; new tax-zone `isActive` badge).
- **`color="outline"` no-op** (a variant passed as a color → silent grey) fixed on fitment's 4 global/tenant badges; `text-xs`→`size` sweep there.
- **Module-card cleanup** — shipping + tax "Manual rates" action cards wear `variant="module"`.
- **Themed checkboxes** (`color="module"`) on the markup/surcharge/bulk-pricing pickers.
- **Hand-rolled muted `<span>`** → `<Text>` (provider test-result readout). Providers' `useConfirm` was already in place (the walk-through note was stale).
- **Design calls settled:** bulk-pricing **stays a full page** (preview table + scope pickers earn it); the inline add-rate rows **stay inline** (lightweight, consistent with returns).
- **typecheck 0 · lint 0 errors · prettier clean.** Scores: Shipping/Tax/Fitment/Providers UI 8·UX 8; Markup/Surcharges/Bulk-pricing UI 9·UX 9. **Commerce walk-through (rows 1–16) COMPLETE.**

### Seed wave 2 — fitment + orders/returns, and two bugs it exposed (2026-06-27)

Seeded the surfaces that wave 1 left empty so they could be eyes-on verified (`packages/db/prisma/seed.ts`):

- **`seedDemoFitment`** — populates the platform-**global Vehicle** domain (Ford/RAM/Chevrolet → models → engines + Year) so it stops showing an empty tree, adds tenant **Device/Pet/Apparel** domains (exercises the 1/2/3-level generalized model), and links the diesel catalog via `ProductFitment`.
- **`seedDemoOrders`** — retail customers + addresses → orders (full lifecycle: placed/fulfilled/delivered/cancelled/refunded) → line items → **returns** (requested→approved→received→inspecting→refunded, with inspections + shipping labels). Computes denormalized customer stats (no order-event consumer runs against a seed DB). Scoped to the coherent diesel inventory catalog so totals read like a real parts shop.
- **Verified-purchase reviews** — customer-authored reviews now pin to a settled order → "Verified purchase" badge.

Two real bugs surfaced **because** the data finally existed (exactly the point of seeding) — both fixed:

- 🐞 **Fitment was missing from the commerce sidebar.** `/commerce/fitment` is a full first-class surface but had no nav entry — reachable only by typing the URL. Added `{ id: 'fitment', label: 'Fitment', icon: Boxes }` to `packages/commerce/src/manifest.ts` (between Collections and Pricing).
- 🐞 **Global Vehicle domain's categories 400'd — the tree was never browsable.** The seeded global domain uses a sentinel id `00000000-0000-0000-0000-000000000001` (set by the fitment migration) whose version/variant bits are zero: a valid Postgres `uuid` that **Zod 4's strict `.uuid()` (RFC-9562) rejects**. So `GET /v1/commerce/fitment/domains/:domainId/categories` failed request validation and the editor silently rendered an empty domain under a "3 makes" badge. Pre-existing latent bug — invisible only because the domain had no categories before. Fixed by accepting the UUID **shape** (`z.guid()`) for fitment reference ids in `services/api-rest/.../commerce/fitment.ts` (path params) + `packages/commerce-schemas/src/fitment.ts` (input ids); product / product-fitment ids stay strict `.uuid()`. Verified on screen: Vehicle → Ford → F-250 → 6.7L/6.0L Power Stroke now renders end to end.

### Platform gaps surfaced (fix once, on the primitive)

- ✅ **BUILT — Status pills carry semantic color (`statusTone`).** A status pill is just a `<Badge>` with
  a tone — no `StatusBadge` component. `statusTone(status)` + `statusLabel(status)` ship from `@sparx/ui`
  (in `primitives/badge.tsx`): a universal status→tone dictionary (success/warning/info/danger/neutral)
  so every list/detail/picker renders `<Badge color={statusTone(s)} variant="soft" size="sm">` instead of
  bland neutral/outline pills or hand-rolled `<span>`s. Domain code that reads a word differently passes
  `color` explicitly (scheduling/automations keep their curated maps). Rule in docs/35 §9; it's a
  `surface-review` System-fidelity check. First adopter: Collections (2026-06-24).
  - **✅ SWEEP DONE (2026-06-25).** Replaced the bland/`outline`/local-`STATUS_VARIANT` status pills
    across the dashboard with `statusTone`/`statusLabel` (or fixed the local map to be semantic where the
    vocab is domain-specific). Files: commerce products / discounts / configurator / gift-cards /
    subscriptions / reviews / qa selection lists; CRM orders (list + detail, incl. payment + fulfillment
    pills) / quotes (list + detail) / b2b accounts (list + detail) / customers' B2B card; CMS
    entry-status-bar + content selection table; inventory lots serial-count badge. Dictionary extended
    with the consolidation vocab (placed/submitted/accepted/converted/captured/denied/credit_hold/spent/
    flagged/received/awaiting_shipment/inspecting/inspected/recovered/abandoned/resolved/posted/reserved/
    released/consumed/spam/bounced). **Left intentionally** (already-semantic curated maps or non-universal
    vocab): scheduling, automations, chat, email, fleet-holds, inventory `types.ts` (PO/transfer/count/
    serial/recall/movement/source/run), invoicing AR, dropship, provider-install (icons), deal pipeline
    stages, task priority, and boolean active/inactive ternaries. **Returns keeps a curated map** — there
    `refunded` is the happy END state (success), the opposite of the order/payment reading
    (`statusTone('refunded')=danger`). 0 type errors, 0 lint errors (only pre-existing `max-lines` warns).
- ✅ **BUILT — `<SeoMetaFields>` (the standard SEO block).** `apps/dashboard/components/seo/seo-meta-fields.tsx`
  — title + meta-description pair where the **inherited** value (name / trimmed description) is the
  field's placeholder and a per-field **"Use name"/"Use description"** button materializes it (fill-empty,
  never clobber; description trimmed to the ~160-char meta budget). Resolves the "blank field but green
  score" confusion: the live site + audit already fall back `seoTitle ?? name`, so blank = inherits, and
  the placeholder now says so. Rule in docs/50 §6. Adopt on every editable surface with SEO fields. First
  adopter: Collections (2026-06-24).
- ✅ **BUILT — Dirty-state guard for form surfaces.** `apps/dashboard/app/(dashboard)/_components/`
  `unsaved-guard.tsx` — `UnsavedGuardProvider` + `useRegisterLeaveGuard(guard)` (form side) +
  `useLeaveGuard()` (host side). The active form registers ONE guard (its dirty check + `useConfirm`
  discard dialog); every leave path routes through it: the frame-owned **Cancel** (the form's own
  `onCancel`), and the detail-panel host's **Close / Switch / backdrop-Esc** (`InlineDetailContent` +
  `ModalDetailContent` wrap their body in the provider; `DetailHeader` close/switch + the modal's
  `onOpenChange` await `runGuard()`). Embedded full-page has no host → the form's Cancel still self-guards.
  First adopter: Categories (2026-06-23). _Not covered: hard browser nav (`beforeunload`); switch-mode
  preserves edits — both deferred._
  - **✅ `useUnsavedGuard(dirty, copy)` — the one-call adopter (2026-06-25).** The hand-rolled block
    (`useConfirm` + a `guardLeave` callback + `useRegisterLeaveGuard`) is now ONE hook in `unsaved-guard.tsx`:
    pass `dirty` + a copy spec (`{ kind: 'create', noun }` / `{ kind: 'edit', noun? }` for house wording, or
    a full `{ title, description, confirmLabel }`); it registers the guard AND returns `guardLeave` for the
    form's own Cancel (`const cancel = async () => { if (await guardLeave()) close() }`). **The create-form
    rule that rides with it:** split `close` (unguarded nav) from the guarded `cancel`, and route the SUCCESS
    path through `close` — a completed create/save is not a discard, so guarding it false-prompts.
  - **✅ ROLLOUT DONE — all create forms + create wizards (2026-06-25).** Wired `useUnsavedGuard` across
    every standard create surface + multi-step create wizard (each a detail-system form: `surface`/
    `presentation` prop + `onCancel`). **Create forms:** commerce (collection, discount, price-list,
    gift-card, account-credit, configurator-template, tax-zone, shipping zone/profile) · cms (page,
    content-type, taxonomy, redirect, author) · crm (segment, b2b-account) · email (suppression, domain) ·
    inventory (warehouse). **Wizards:** product, quote, order, customer, cms-entry, b2b-account, transfer,
    purchase-order, invoice. Plus the existing edit adopters refactored onto the hook (category create/edit,
    product edit/seo). 0 type errors, 0 lint errors (pre-existing `max-lines` warns only); create-form +
    wizard shapes spot-verified on screen (pristine Cancel = no prompt; dirty Cancel = discard dialog;
    success = no false prompt).
  - **✅ `GuardedTabs` — the guard extends to TABBED details (2026-06-25).** `_components/guarded-tabs.tsx`
    wraps the `@sparx/ui` `<Tabs>` and consults `useLeaveGuard()` before switching tab — a clean switch is
    instant, a dirty one prompts the discard confirm and only switches on accept. The editable tab panel
    registers via `useUnsavedGuard`; the detail route's `UnsavedGuardProvider` (already on `DetailPageShell`)
    is the shared channel. Adopted on the **collection** detail (Metadata tab) and the **product** detail
    (Edit/SEO tabs already register). **Verified on screen**: editing the collection Metadata Name then
    clicking the Products tab prompts "Discard unsaved changes?" and only switches on Discard. _(Closes the
    docs/86 §5.2 / earlier "tabbed-detail guard deferred" gap for these two.)_
  - **✅ `DetailPageShell` back-link is now guarded (platform, 2026-06-25).** The full-page detail's
    back-to-list link was a plain `<Link>`; it's now a `DetailBackLink` button that routes through
    `useLeaveGuard()` before navigating — so leaving a dirty full-page detail for its list confirms, exactly
    like the presentation switch beside it. Benefits every `DetailPageShell` detail.
  - **✅ Edit detail bodies wired (2026-06-25):** `bundle-editor` (create + edit paths), inventory
    `supplier-create` / `supplier-edit` / `warehouse-edit`, `cms/media` edit, `cms/authors` edit — each
    computes `dirty` (controlled state, or a `formRef` + `onInput` recompute for uncontrolled FormData forms)
    and calls `useUnsavedGuard`. Inline edit bodies with no Cancel rely on the now-guarded back-link / switch.
  - **✅ CMS editors wired — autosave REMOVED (2026-06-26).** Autosave was never consistent with the rest
    of the platform, so it was deleted end-to-end rather than guarded around: the two editors
    (`cms/[id]/edit-form`, `cms/types/[typeKey]/[id]/edit-entry-form`) are now plain explicit-save
    (last-write-wins) and each wires `useUnsavedGuard`. Removed with it: the `autosavePage` / `autosaveEntry`
    server actions, the `entry-status-bar` `SaveState` + conflict CTA, the `initialEtag` loaders, the
    `NEXT_PUBLIC_CMS_AUTOSAVE` flag, and `cms-autosave.spec.ts`. The entry editor's explicit save also drops
    its ETag conflict detection (no other editor had it — last-write-wins is the norm; the generic
    `patchWithEtag`/`getWithEtag` client methods stay, just unused by CMS). **Dirty is RENDER-COMPUTED**
    (compare current fields vs a saved-snapshot ref advanced on each Save) — NOT an effect: a "skip first
    render" ref flips dirty spuriously under StrictMode's dev double-invoke (caught on screen — a clean open
    falsely prompted), and a value-compare also ignores the block editor's on-mount normalization. Verified
    on screen (both editors): clean close = no prompt, dirty close = discard dialog, hard Save persists + the
    list updates. Read-only tabbed details (customer activity/orders, etc.) need no guard.
- ✅ **BUILT — Full-page presentation switch (drawer/modal parity).** The overlay host (`DetailHeader`)
  offers Close/Switch/Maximize; the `embedded` full page had none. Added a generic **`headerActions`** slot
  to `SurfaceFrame`'s embedded title strip + a shared `DetailPresentationSwitch` (in `detail-panel.tsx`)
  that opens the record as a drawer/modal over its list (route from manifest `routePrefix`), dirty-guarded
  via `useLeaveGuard`. Close/Maximize stay OFF the full page (breadcrumb + back close it; can't maximize
  what's maximized). Adopt per page: pass `headerActions` when `surface==='page'` + wrap the page route in
  `UnsavedGuardProvider`. First adopter: Categories (2026-06-23).
- **`SurfaceSummary` has no async/loading slot.** If summaries start loading related-record counts they
  need a skeleton/`loading` affordance. Not needed for Categories (derived client-side). _Surfaced: Categories (2026-06-23)._
- ✅ **DONE — raw `<input type="checkbox"/"radio">` → themed `@sparx/ui` `Checkbox` /
  `RadioGroup`+`RadioGroupItem` (`color="module"`).** A system-fidelity gap (un-themed, no module accent)
  that recurred across ~26 dashboard forms. **Swept** (2026-06-25): commerce (collection create, discount,
  new-profile, new-variant, return-approval, new-tax-rate, price-list-entries, install-provider, bundle-editor),
  inventory (warehouse create/edit, suppliers create/edit/variants, lots filter + actions), invoicing
  (invoice-wizard, line-grid, workflows new/editor/stage-row/add-stage, pipelines), dropship, crm/pipelines,
  settings/ai-integrations. **FormData-native checkboxes stay submission-safe** — Radix `Checkbox` renders a
  hidden form input when given `name`, so `form.get(name) === 'on'` is unchanged. **Platform fix that rode
  with it:** `eslint.config.js` now maps the `@sparx/ui` field components (`Checkbox`/`RadioGroupItem`/
  `Input`/`NativeSelect`/`Textarea` → their DOM elements) under `settings['jsx-a11y'].components`, so
  `jsx-a11y/label-has-associated-control` resolves a `<Label>` wrapping a themed control (the native control
  is nested at runtime) — same approach `apps/site` already uses for its `Sparx*` components. 0 lint errors
  across dashboard/site/web after the sweep. **Follow-up (2026-06-26):** `_components/site-scope-field` (the
  multi-site "Visible on sites" control on the page + entry editors) already used the themed `Checkbox` but
  without the module accent — now `color="module"`, so it reads in the active module hue like every other
  checkbox. _Reference: `collection-create-form`._
- ✅ **BUILT — Detail header-slot teleport + `DetailPageShell` + identity-once.** A detail body declares its
  header content (status + lifecycle actions) ONCE via `<DetailHeaderSlot>` (children-based portal,
  `_components/detail-header-slot.tsx`) and it renders in whichever frame is active — the drawer/modal
  chrome (`detail-panel.tsx`, now carries a slot target) or the new full-page `DetailPageShell`
  (`_components/detail-page-shell.tsx`: back-link + slot + presentation switch, generalizing the
  `headerActions` switch above). Two rules ride with it: **identity-once** — an entity's name/slug is its
  editable field, never ALSO a read-only heading (removed from product / collection / cms page / cms entry;
  read-only/transaction details keep their heading since they have no name field); and **lifecycle in the
  header, not an in-body "Status" card** — status badge + primary action keep text, secondary actions go
  icon-only with tooltips (docs/86 §5.1, docs/34 §4). _Built 2026-06-25 (product, collection, cms page, cms entry)._
- **DONE — CMS editors are explicit-save only; autosave REMOVED.** `cms/[id]/edit-form.tsx` +
  `cms/types/[typeKey]/[id]/edit-entry-form.tsx` had per-keystroke autosave behind `NEXT_PUBLIC_CMS_AUTOSAVE`;
  the flag + all the autosave/ETag/conflict machinery are now deleted (it was never consistent with the rest
  of the platform). One Save button, last-write-wins, like every other editor. See the leave-guard platform
  entry above for the full removal list + the StrictMode dirty-tracking footgun. _Decided 2026-06-25; removed
  2026-06-26._
- **✅ DONE — leave-guard rollout COMPLETE.** Create forms + wizards, the edit detail bodies (`bundle-editor`,
  inventory supplier/warehouse, `cms/media`, `cms/authors`), the tabbed-detail panels (collection + product,
  via `GuardedTabs`), the CMS page/entry editors, and `commerce/providers/install/.../install-provider-form`
  (the last full-page FormData **create** surface) all register `useUnsavedGuard`. The install form's dirty is
  a compare against the **initial serialized form** captured on mount — it ships pre-filled with provider
  defaults, so "any field non-empty" would false-prompt; only a change from those defaults counts. Every
  create/edit form surface that can silently drop typed work is now guarded. _Completed 2026-06-26._

---

## Progress log

- **2026-06-21 — `WizardFrame` → `SurfaceFrame` rename + commerce create sweep ✅.**
  - Renamed the primitive end-to-end: file `surface-frame.tsx`, exports `Surface*` (`SurfaceFrame` /
    `SurfaceStep` / `SurfaceStepDef` / `SurfaceSummary*`), barrel, 67 consumers, docs/86 →
    `86-surface-frame-pattern.md`, this doc + the `form-surface` skill. It is the ONE form-surface frame
    — create AND edit, single-step by default, steps are an opt-in (wizard) feature. `@sparx/ui` +
    `@sparx/dashboard` typecheck + lint clean. (`ProductWizard`/`QuoteWizard`/etc. keep their names —
    they're genuinely multi-step wizards built on the frame.)
  - All commerce CREATE surfaces migrated + wired: discount, bundle, shipping zone/profile, tax zone,
    configurator-template (overlay), provider-install (full-page). Next focus = commerce edit/inline
    surfaces, worked **page-by-page in Playwright** (see the walk-through above).

- **2026-06-21 — Wave 0 ✅ and Wave 1 ✅ complete.**
  - Wave 0 (cross-cutting cleanups): the two `window.prompt` reason-captures (`return-status-bar`, `moderate-actions`) became proper `@sparx/ui` `Modal` + required `Textarea` dialogs; the raw `AlertDialog`/arm-confirm patterns in `email/domains/domain-actions`, `commerce/pricing/[id]/price-list-status-bar`, `inventory/sources/[id]/agent-panel` (unpair), `b2b/service-types/service-type-actions` (delete), and the CMS confirms (`cms/[id]/edit-form`, `author-edit-form`, `schema-editor`, `types/[typeKey]/[id]/edit-entry-form`, `navigation/menu-editor`, `revisions/restore-button`) now go through `useConfirm`. _Note:_ the CMS edit-form rows stay 🔲 because the **form→overlay** migration (Wave 4) is the real remaining work there — only their confirm sub-fix is done.
  - Wave 1 (wizard summaries): `customer-full-profile-wizard` and `b2b-account-wizard` gained live F-layout summary columns and joined `SUMMARY_CREATE_TYPES`. The whole record-builder + line-item wizard family now carries a summary.
  - Verified: `@sparx/dashboard` typecheck clean, lint 0 errors.

## Recommended waves

Work top-to-bottom. Each wave is one repeatable move; do a whole wave with the skill before moving on.

### Wave 0 — cross-cutting cleanups ✅ DONE (2026-06-21)

Quick correctness wins that don't touch layout:

- **`window.prompt` → a real modal field.** `commerce/returns/[id]/return-status-bar.tsx` (deny reason) and
  `commerce/reviews/[id]/moderate-actions.tsx` (moderation note) collect required text via `window.prompt`.
  Replace with a small modal/`useConfirm`-with-input.
- **Raw `AlertDialog` / arm-confirm → `useConfirm`.** `email/domains/domain-actions.tsx`,
  `commerce/pricing/[id]/price-list-status-bar.tsx` (manual `armed` two-step),
  `b2b/service-types/service-type-actions.tsx` (delete), `inventory/sources/[id]/agent-panel.tsx` (unpair),
  and the CMS edit-form delete confirms (`cms/[id]/edit-form.tsx`, `author-edit-form.tsx`,
  `schema-editor.tsx`, `menu-editor.tsx`, `cms/[id]/revisions/restore-button.tsx`) all confirm correctly
  but bypass the shared hook. Normalize.

### Wave 1 — wizards that only need a live summary ✅ DONE (2026-06-21)

Already on `SurfaceFrame`; just add the F-layout summary column (and join `SUMMARY_CREATE_TYPES`):

- `crm/customers/new/customer-full-profile-wizard.tsx`
- `b2b/accounts/new/b2b-account-wizard.tsx`

### Wave 2 — single-step create forms: add `surface` + wire the overlay

Mechanical, one per form via the skill (build `*CreateForm` with a `surface` prop → register in the three
places → swap the launcher to `EntityCreateButton`). The full-page-only create forms:

- Commerce: `bundles`, `configurator`, `discounts`, `shipping/profiles`, `shipping/zones`, `tax/zones`,
  `providers/install`
- CRM: `crm/deals`, `crm/tasks`, `crm/pipelines`; **consolidate** the duplicate `crm/b2b/new` into the
  `b2b/accounts` wizard
- Inventory: `counts`, `lots`, `suppliers`, `purchase-orders/[id]/receive`
- Invoicing: `workflows/new` (name-only step before the full-page editor)

### Wave 3 — self-owned `Modal` forms → overlay system

Same `Modal` + `AlertDialog` pattern repeated; can be swept with a shared `*CreateForm(surface)` each:

- Scheduling: `services`, `resources`, `bookings`, `policies` (each = `new-*-button` + `*-form`)
- B2B: `service-types`, `pricing-tiers`
- Inventory: `sources` (`source-form` + `new-source-button` + `source-actions` + `[id]/source-detail-actions`)
- Dropship: `suppliers` (`supplier-form` + `new-supplier-button` + `supplier-actions` + `vendor-picker`)

### Wave 4 — inline record/edit forms on detail pages → standardize

Forms that live raw in a detail-page body and clobber the chrome; wrap in the standard card/overlay:

- Commerce returns: `return-approval-form`, `return-inspection-form`, `return-refund-form`
- Commerce: `reviews/[id]/respond-form`, `qa/[id]/answer-form`, `markup-rules`/`surcharges` RuleForm (heavy
  expand-in-place), `fitment-reference-editor`, shipping/tax `new-rate-form` add-rows
- B2B: `quotes/[id]/quote-respond-editor` (heavy pricing workspace — likely a wide overlay or its own route)
- CMS edit surfaces: `cms/[id]/edit-form`, `author-edit-form`, `media/[id]/edit-form`,
  `types/[typeKey]/[id]/edit-entry-form`, `schema-editor`, `terms-manager`, `legal/consent-settings-form`

### Wave 5 — substantive dialogs → standard overlay/dialog

Dialogs that carry real input (not just confirms):

- `settings/domains/purchase-dialog.tsx` (two modes: purchase vs. select — also launched from onboarding `step-domain`)
- `scheduling/resources/calendar-feed-dialog.tsx` (+ `calendar-connections-section`, `caldav-connect-form`)
- `b2b/invoices/[id]/invoice-actions.tsx` (mark-paid / write-off), `b2b/appointments`, `b2b/approval-queue`
- `seo/search-console-control.tsx` (site picker), `email/broadcasts/[id]/broadcast-actions.tsx` (schedule)
- `settings/ai-integrations/issue-key-form.tsx` (create-flow rendered inline on a settings page)

### Stubs to build (form doesn't exist yet)

- ~~`commerce/products/[id]/new-variant-dialog.tsx` + `options-editor-dialog.tsx`~~ — **NOT stubs**: variant
  creation + the option-lattice editor already work as INLINE forms (`new-variant-form.tsx`,
  `options-editor.tsx`, rendered by `variants-panel.tsx`). The `-dialog.tsx` wrappers were vestigial
  placeholders with zero imports app-wide — **deleted 2026-06-26** (Products surface review).
- `b2b/accounts/[id]/b2b-account-overrides-table.tsx` ("Add override" is disabled)

### Design calls (likely keep as-is — confirm intent before touching)

- `builder/**` bespoke editor surfaces (inspector, panels, palettes, brand/theme controls, framing/preview modals) — these are a visual editor, not CRUD.
- `automations/automation-editor.tsx` (full-page flow canvas), `email/broadcasts/broadcast-composer.tsx`,
  `marketplace/installs/[id]/update`, `scheduling/availability` editors — full-page may be the right surface; decide before migrating.

---

## Full inventory by module

> Rows marked ✅/➖ need no work and are included for completeness. The actionable rows are ⚙️ and 🔲.

### Commerce

| Path                                                                                                | Name                       | Kind                       | Current                | Status | Action                                             |
| --------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------- | ---------------------- | ------ | -------------------------------------------------- |
| `commerce/products/_components/product-wizard/index.tsx`                                            | Create product             | Create wizard              | overlay                | ✅     | done (F-layout + summary)                          |
| `commerce/products/[id]/_components/product-edit-form.tsx`                                          | Edit product overview      | Edit/record form           | inline (detail tab)    | ✅     | standard detail tab                                |
| `commerce/products/[id]/_components/product-media-panel.tsx`                                        | Product media              | Edit/record form           | inline (detail tab)    | ✅     | fine                                               |
| `commerce/products/[id]/_components/fitment-panel.tsx`                                              | Product fitment            | Edit/record form           | inline (detail tab)    | ✅     | fine                                               |
| `commerce/products/[id]/_components/inventory-panel.tsx`                                            | Inventory adjust / reorder | Inline page-body form      | inline (expand-in-row) | ⚙️     | consider drawer for adjust                         |
| `commerce/products/[id]/_components/new-variant-dialog.tsx`                                         | Add variant (stub)         | Substantive dialog/modal   | raw Modal              | 🔲     | build real form in modal                           |
| `commerce/products/[id]/_components/new-variant-form.tsx`                                           | Add variant body           | Single-step create form    | inline                 | 🔲     | wire into the dialog                               |
| `commerce/products/[id]/_components/options-editor-dialog.tsx`                                      | Options editor (stub)      | Substantive dialog/modal   | raw Modal              | 🔲     | build real editor in modal                         |
| `commerce/products/[id]/_components/product-status-bar.tsx`                                         | Publish / archive          | Action bar                 | inline                 | ➖     | low-risk direct transitions                        |
| `commerce/products/_components/bulk-price-adjust-modal.tsx`                                         | Bulk price adjust          | Bulk/action modal          | Modal                  | ✅     | fine                                               |
| `commerce/products/_components/products-import-export.tsx`                                          | Products import            | Bulk/action modal          | ImportDialog           | ✅     | fine                                               |
| `commerce/products/pricing/_components/bulk-pricing-tool.tsx`                                       | Bulk pricing tool          | Bulk/action modal          | full-page tool         | 🔲     | decide page vs overlay                             |
| `commerce/categories/_components/category-create-form.tsx`                                          | New category               | Single-step create form    | overlay                | ✅     | surface-aware                                      |
| `commerce/categories/_components/category-edit-form.tsx`                                            | Edit category              | Edit/record form           | overlay                | ✅     | fine                                               |
| `commerce/categories/_components/categories-table.tsx`                                              | Category tree-table        | List substrate (read-only) | inline                 | ➖     | not a form surface — edits live in the detail view |
| `commerce/collections/_components/collection-create-form.tsx`                                       | New collection             | Single-step create form    | overlay                | ✅     | surface-aware                                      |
| `commerce/collections/[id]/_components/collection-meta-form.tsx`                                    | Edit collection meta       | Edit/record form           | inline (detail tab)    | ✅     | fine                                               |
| `commerce/collections/[id]/_components/collection-membership-editor.tsx`                            | Collection membership      | Edit/record form           | inline (detail tab)    | ✅     | fine                                               |
| `commerce/pricing/_components/price-list-create-form.tsx`                                           | New price list             | Single-step create form    | overlay                | ✅     | surface-aware                                      |
| `commerce/pricing/[id]/_components/price-list-entries-editor.tsx`                                   | Price-list entries         | Edit/record form           | inline (detail tab)    | ✅     | appropriate                                        |
| `commerce/pricing/[id]/_components/price-list-status-bar.tsx`                                       | Price-list archive         | Confirm                    | inline arm/confirm     | ✅     | done (useConfirm)                                  |
| `commerce/gift-cards/_components/issue-gift-card-form.tsx`                                          | Issue gift card            | Single-step create form    | overlay                | ✅     | surface-aware                                      |
| `commerce/account-credit/_components/grant-account-credit-form.tsx`                                 | Grant account credit       | Single-step create form    | overlay                | ✅     | surface-aware                                      |
| `commerce/markup-rules/_components/markup-rules-manager.tsx` (RuleForm)                             | Create/edit markup rule    | Edit/record form           | inline expand-in-place | 🔲     | move into overlay                                  |
| `commerce/surcharges/_components/surcharges-manager.tsx` (RuleForm)                                 | Create/edit surcharge rule | Edit/record form           | inline expand-in-place | 🔲     | move into overlay                                  |
| `commerce/bundles/_components/bundle-editor.tsx` + `bundles/new`                                    | Create/edit bundle         | Create/edit form           | full-page only         | 🔲     | surface + overlay                                  |
| `commerce/configurator/new/_components/new-template-form.tsx`                                       | New configurator template  | Single-step create form    | full-page only         | 🔲     | surface + overlay                                  |
| `commerce/configurator/[id]/_components/template-json-editor.tsx`                                   | Template JSON editor       | Edit/record form           | inline (detail tab)    | ✅     | fine                                               |
| `commerce/discounts/new/page.tsx`                                                                   | New discount               | Single-step create form    | full-page only         | 🔲     | surface + overlay                                  |
| `commerce/discounts/_components/discounts-import-export.tsx`                                        | Discounts import           | Bulk/action modal          | ImportDialog           | ✅     | fine                                               |
| `commerce/fitment/_components/fitment-reference-editor.tsx`                                         | Fitment reference add-rows | Inline page-body form      | inline (tree)          | 🔲     | standardize add-forms                              |
| `commerce/providers/install/_components/install-provider-form.tsx`                                  | Install provider           | Single-step create form    | full-page only         | 🔲     | surface + overlay                                  |
| `commerce/providers/[id]/_components/provider-actions-bar.tsx`                                      | Provider enable/uninstall  | Confirm                    | inline                 | ➖     | `useConfirm`                                       |
| `commerce/qa/[id]/_components/answer-form.tsx`                                                      | Post staff answer          | Edit/record form           | inline (detail)        | 🔲     | wrap in card/overlay                               |
| `commerce/qa/[id]/_components/question-moderate-actions.tsx`                                        | Moderate question          | Confirm                    | inline                 | ➖     | `useConfirm`                                       |
| `commerce/returns/[id]/_components/return-approval-form.tsx`                                        | Approve return             | Edit/record form           | inline (detail)        | 🔲     | standard card layout                               |
| `commerce/returns/[id]/_components/return-inspection-form.tsx`                                      | Record inspection          | Edit/record form           | inline (detail)        | 🔲     | standard card layout                               |
| `commerce/returns/[id]/_components/return-refund-form.tsx`                                          | Issue refund               | Edit/record form           | inline (detail)        | 🔲     | standard card layout                               |
| `commerce/returns/[id]/_components/return-status-bar.tsx`                                           | Deny / mark received       | Confirm                    | Modal + reason field   | ✅     | done (Modal + required reason)                     |
| `commerce/reviews/[id]/_components/respond-form.tsx`                                                | Respond to review          | Edit/record form           | inline (detail)        | 🔲     | standard card layout                               |
| `commerce/reviews/[id]/_components/moderate-actions.tsx`                                            | Moderate review            | Confirm                    | Modal + note field     | ✅     | done (Modal note + useConfirm)                     |
| `commerce/shipping/profiles/new/_components/new-profile-form.tsx`                                   | New shipping profile       | Single-step create form    | full-page only         | 🔲     | surface + overlay                                  |
| `commerce/shipping/zones/new/_components/new-zone-form.tsx`                                         | New shipping zone          | Single-step create form    | full-page only         | 🔲     | surface + overlay                                  |
| `commerce/shipping/zones/[id]/_components/new-rate-form.tsx`                                        | Add shipping rate          | Single-step create form    | inline (detail)        | 🔲     | overlay or collapsible                             |
| `commerce/tax/zones/new/_components/new-tax-zone-form.tsx`                                          | New tax zone               | Single-step create form    | full-page only         | 🔲     | surface + overlay                                  |
| `commerce/tax/zones/[id]/_components/new-tax-rate-form.tsx`                                         | Add tax rate               | Single-step create form    | inline (detail)        | 🔲     | overlay or collapsible                             |
| `commerce/subscriptions/[id]/_components/subscription-actions-bar.tsx`                              | Pause/skip/cancel          | Confirm                    | inline                 | ➖     | `useConfirm`                                       |
| `commerce/settings/_components/site-settings-form.tsx`                                              | Commerce settings          | Settings form              | inline                 | ✅     | settings page                                      |
| _delete buttons_ (`bundle`, `category`, `shipping profile/zone/rate`, `tax zone/rate`, `surcharge`) | Delete X                   | Confirm                    | inline                 | ➖     | `useConfirm`                                       |

### CRM & B2B

| Path                                                                                                    | Name                              | Kind                         | Current                   | Status | Action                                     |
| ------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------- | ------------------------- | ------ | ------------------------------------------ |
| `crm/quotes/new/_components/quote-wizard.tsx`                                                           | New quote                         | Create wizard                | overlay                   | ✅     | done (F-layout + summary)                  |
| `crm/orders/new/_components/order-wizard.tsx`                                                           | New order                         | Create wizard                | overlay                   | ✅     | done (F-layout + summary)                  |
| `crm/customers/new/customer-full-profile-wizard.tsx`                                                    | New customer                      | Create wizard                | overlay                   | ✅     | done (live summary + fill-to-create tally) |
| `crm/customers/_components/record-activity-form.tsx`                                                    | Record activity                   | Inline page-body form        | inline (right rail)       | ➖     | belongs inline                             |
| `crm/customers/_components/customers-import-export.tsx`                                                 | Customer import                   | Bulk/action modal            | ImportDialog              | ➖     | fine                                       |
| `crm/segments/_components/segment-create-form.tsx`                                                      | New segment                       | Single-step create form      | overlay                   | ✅     | surface-aware                              |
| `crm/deals/new/_components/new-deal-form.tsx`                                                           | New deal                          | Single-step create form      | full-page only            | 🔲     | surface + overlay                          |
| `crm/tasks/new/_components/new-task-form.tsx`                                                           | New task                          | Single-step create form      | full-page only            | 🔲     | surface + overlay                          |
| `crm/pipelines/new/page.tsx`                                                                            | New pipeline                      | Single-step create form      | full-page only            | 🔲     | extract form + surface                     |
| `crm/pipelines/[id]/edit/_components/*`                                                                 | Pipeline editor (header / stages) | Edit/record form             | inline (edit route)       | ➖     | full-page editor is correct                |
| `crm/deals/[id]/_components/attach-order-popover.tsx` / `attach-quote-popover.tsx` / `stage-picker.tsx` | Deal attach/stage                 | Picker                       | inline popover            | ➖     | fine                                       |
| `crm/b2b/_components/b2b-account-create-form.tsx` + `crm/b2b/new/page.tsx`                              | New B2B account (CRM route)       | Single-step create form      | full-page only            | 🔲     | **consolidate** into `b2b/accounts` wizard |
| `crm/b2b/[id]/_components/credit-hold-toggle.tsx`                                                       | Credit hold                       | Confirm                      | inline                    | ➖     | `useConfirm`                               |
| `crm/quotes/[id]/_components/quote-lifecycle-actions.tsx`                                               | Quote lifecycle                   | Action bar                   | inline                    | ➖     | fine                                       |
| `b2b/accounts/new/b2b-account-wizard.tsx`                                                               | New B2B account                   | Create wizard                | overlay                   | ✅     | done (live summary)                        |
| `b2b/accounts/[id]/_components/fleet-profile-editor.tsx`                                                | Edit fleet profiles               | Edit/record form             | self-owned modal (nested) | 🔲     | overlay / sheet                            |
| `b2b/accounts/[id]/_components/approval-rules-editor.tsx` / `b2b-tier-assigner.tsx`                     | Approval rules / tier assign      | Inline page-body form        | inline                    | ➖     | fine                                       |
| `b2b/accounts/[id]/_components/b2b-account-overrides-table.tsx`                                         | Price overrides                   | Edit/record form             | inline (stub)             | 🔲     | build add form                             |
| `b2b/accounts/_components/b2b-accounts-import-export.tsx`                                               | B2B import                        | Bulk/action modal            | ImportDialog              | ➖     | fine                                       |
| `b2b/service-types/_components/new-service-type-button.tsx` + `service-type-actions.tsx`                | New / edit / delete service type  | Single-step + edit + confirm | self-owned modal          | 🔲     | overlay (delete → `useConfirm`)            |
| `b2b/pricing-tiers/_components/tier-create-button.tsx`                                                  | Create pricing tier               | Single-step create form      | self-owned modal          | 🔲     | overlay                                    |
| `b2b/appointments/_components/appointment-actions.tsx`                                                  | Confirm/complete/cancel           | Substantive dialog/modal     | self-owned modal          | 🔲     | overlay or `useConfirm`+notes              |
| `b2b/approval-queue/_components/approve-reject-actions.tsx`                                             | Approve/reject order              | Substantive dialog/modal     | self-owned modal          | 🔲     | overlay or `useConfirm`+notes              |
| `b2b/invoices/[id]/_components/invoice-actions.tsx`                                                     | Mark paid / write off             | Substantive dialog/modal     | self-owned modal          | 🔲     | overlay                                    |
| `b2b/quotes/[id]/_components/quote-respond-editor.tsx`                                                  | Respond to B2B quote              | Edit/record form             | inline (detail)           | 🔲     | wide overlay or own route                  |
| `b2b/quotes/[id]/_components/quote-lifecycle-buttons.tsx`                                               | Accept/decline                    | Action bar                   | inline                    | ➖     | fine                                       |

### Inventory, Invoicing & Dropship

| Path                                                                                                                                | Name                            | Kind                     | Current          | Status | Action                                            |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------ | ---------------- | ------ | ------------------------------------------------- |
| `inventory/purchase-orders/new/_components/purchase-order-wizard.tsx`                                                               | New purchase order              | Create wizard            | overlay          | ✅     | done (F-layout + summary)                         |
| `inventory/transfers/new/_components/transfer-wizard.tsx`                                                                           | New transfer                    | Create wizard            | overlay          | ✅     | done (F-layout + summary)                         |
| `invoicing/documents/new/_components/invoice-wizard.tsx`                                                                            | New billing document            | Create wizard            | overlay          | ✅     | done (F-layout + summary)                         |
| `inventory/warehouses/_components/warehouse-create-form.tsx`                                                                        | New warehouse                   | Single-step create form  | overlay          | ✅     | wired in `CREATE_VIEW_TYPES`                      |
| `inventory/warehouses/[id]/_components/warehouse-edit-form.tsx`                                                                     | Warehouse edit                  | Edit/record form         | inline           | ➖     | fine                                              |
| `inventory/counts/new/_components/count-create-form.tsx`                                                                            | New inventory count             | Single-step create form  | full-page only   | 🔲     | surface + overlay                                 |
| `inventory/counts/[id]/_components/count-lines-panel.tsx`                                                                           | Count lines                     | Inline page-body form    | inline           | ➖     | fine                                              |
| `inventory/lots/new/_components/lot-create-form.tsx`                                                                                | New lot                         | Single-step create form  | full-page only   | 🔲     | surface + overlay                                 |
| `inventory/suppliers/_components/supplier-create-form.tsx`                                                                          | New supplier                    | Single-step create form  | full-page only   | 🔲     | surface + overlay                                 |
| `inventory/suppliers/[id]/_components/supplier-edit-form.tsx`                                                                       | Supplier edit                   | Edit/record form         | inline           | ➖     | fine                                              |
| `inventory/purchase-orders/[id]/receive/_components/receive-form.tsx`                                                               | Receive stock                   | Single-step create form  | full-page only   | 🔲     | surface + overlay (or sheet)                      |
| `inventory/purchase-orders/[id]/_components/purchase-order-edit-form.tsx`                                                           | PO edit                         | Edit/record form         | inline           | ➖     | fine                                              |
| `inventory/sources/_components/source-form.tsx` + `new-source-button.tsx` + `source-actions.tsx` + `[id]/source-detail-actions.tsx` | Connect/edit inventory source   | Single-step + edit       | self-owned modal | 🔲     | shared `SourceCreateForm(surface)` → overlay      |
| `inventory/sources/[id]/_components/agent-panel.tsx`                                                                                | Bridge agent pair/rotate/unpair | Substantive dialog/modal | self-owned modal | ✅     | done (unpair → useConfirm; key-reveal modal kept) |
| `inventory/sources/[id]/_components/mappings-panel.tsx` / `unmapped-queue.tsx` / `variant-picker.tsx`                               | SKU mappings                    | Inline page-body form    | inline           | ➖     | fine                                              |
| `inventory/stock/_components/inventory-row-editor.tsx`                                                                              | Adjust / reorder policy         | Inline page-body form    | inline           | ➖     | fine                                              |
| `inventory/reorder/_components/reorder-board.tsx`                                                                                   | Reorder board                   | Inline page-body form    | inline           | ➖     | fine                                              |
| `invoicing/documents/[id]/_components/line-grid.tsx` / `payments-panel.tsx`                                                         | Line composer / payments        | Inline page-body form    | inline (detail)  | ➖     | fine                                              |
| `invoicing/documents/[id]/_components/stage-bar.tsx`                                                                                | Stage bar                       | Confirm                  | inline           | ➖     | `useConfirm`                                      |
| `invoicing/workflows/new/page.tsx`                                                                                                  | New workflow                    | Single-step create form  | full-page only   | 🔲     | surface + overlay                                 |
| `invoicing/workflows/[id]/edit/_components/*`                                                                                       | Workflow editor / stage rows    | Settings / edit          | full-page        | ➖     | full-page editor is correct                       |
| `invoicing/templates/_components/template-row-actions.tsx`                                                                          | Template actions                | Confirm                  | inline           | ➖     | `useConfirm`                                      |
| `dropship/suppliers/_components/supplier-form.tsx` + `new-supplier-button.tsx` + `supplier-actions.tsx`                             | Connect/edit dropship supplier  | Single-step + edit       | self-owned modal | 🔲     | shared `SupplierCreateForm(surface)` → overlay    |
| `dropship/suppliers/_components/vendor-picker.tsx`                                                                                  | Vendor picker                   | Picker dialog            | self-owned modal | 🔲     | picker step within overlay                        |
| `dropship/suppliers/[id]/catalog/_components/import-button.tsx` / `sync-button.tsx`                                                 | Import / sync                   | Bulk/action modal        | inline           | ➖     | fine                                              |

### CMS & Builder

| Path                                                                                                | Name                        | Kind                    | Current            | Status | Action                                                                                       |
| --------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------- | ------------------ | ------ | -------------------------------------------------------------------------------------------- |
| `cms/content/new/content-entry-wizard.tsx`                                                          | New content entry           | Create wizard           | overlay            | ✅     | F-layout (no summary needed)                                                                 |
| `cms/_components/page-create-form.tsx`                                                              | New page                    | Single-step create form | overlay            | ✅     | surface-aware                                                                                |
| `cms/types/_components/content-type-create-form.tsx`                                                | New content type            | Single-step create form | overlay            | ✅     | surface-aware                                                                                |
| `cms/authors/author-create-form.tsx`                                                                | New author                  | Single-step create form | overlay            | ✅     | surface-aware                                                                                |
| `cms/taxonomy/taxonomy-create-form.tsx`                                                             | New taxonomy                | Single-step create form | overlay            | ✅     | surface-aware                                                                                |
| `cms/redirects/_components/redirect-create-form.tsx`                                                | Add redirect                | Single-step create form | overlay            | ✅     | surface-aware                                                                                |
| `cms/types/[typeKey]/new/new-entry-form.tsx`                                                        | New entry (type-scoped)     | Single-step create form | full-page only     | 🔲     | migrate or redirect to wizard                                                                |
| `cms/[id]/edit-form.tsx`                                                                            | Edit page (explicit save)   | Edit/record form        | full-page only     | 🔲     | status+lifecycle in header (`DetailHeaderSlot`); autosave off via `NEXT_PUBLIC_CMS_AUTOSAVE` |
| `cms/authors/[id]/author-edit-form.tsx`                                                             | Edit author                 | Edit/record form        | full-page only     | 🔲     | overlay; delete → `useConfirm`                                                               |
| `cms/media/[id]/edit-form.tsx`                                                                      | Edit asset                  | Edit/record form        | full-page only     | 🔲     | overlay                                                                                      |
| `cms/types/[typeKey]/[id]/edit-entry-form.tsx`                                                      | Edit content entry          | Edit/record form        | full-page only     | 🔲     | overlay; delete → `useConfirm`                                                               |
| `cms/types/[typeKey]/schema/schema-editor.tsx`                                                      | Edit type schema            | Edit/record form        | full-page only     | 🔲     | deliberate (bespoke)                                                                         |
| `cms/navigation/menu-editor.tsx`                                                                    | Menu editor                 | Edit/record form        | full-page only     | 🔲     | deliberate (tree)                                                                            |
| `cms/taxonomy/[key]/terms-manager.tsx`                                                              | Terms manager               | Edit/record form        | full-page only     | 🔲     | extract `TermCreateForm`                                                                     |
| `cms/legal/consent-settings-form.tsx`                                                               | Cookie consent              | Settings form           | inline             | 🔲     | wrap in F-layout                                                                             |
| `cms/_components/media-picker.tsx` / `reference-picker.tsx`                                         | Media / reference picker    | Picker dialog           | Modal              | ✅     | fine                                                                                         |
| `cms/redirects/_components/import-redirects-button.tsx` / `cms/media/upload-button.tsx`             | Import / upload             | Bulk/action             | inline             | ✅     | fine                                                                                         |
| `cms/[id]/revisions/restore-button.tsx`                                                             | Restore revision            | Confirm                 | useConfirm         | ✅     | done (useConfirm, warning tone)                                                              |
| `cms/[id]/seo-panel.tsx` / `entry-template-picker.tsx`                                              | SEO panel / template picker | Edit/record form        | inline             | ✅     | fine                                                                                         |
| `builder/**` (inspector, panels, palettes, brand/theme controls, framing/preview/merge-tags modals) | Builder editor surfaces     | Edit / dialog           | inline / Modal     | ✅     | bespoke editor — likely out of scope                                                         |
| `builder/_governance/components/allowlist-center.tsx`                                               | CSS allowlist editor        | Settings form           | inline             | 🔲     | wrap in F-layout                                                                             |
| `builder/components/_components/new-component-button.tsx`                                           | New component               | Single-step create form | AlertDialog prompt | 🔲     | overlay single-step                                                                          |
| `builder/components/_components/delete-component-button.tsx`                                        | Delete component            | Confirm                 | `useConfirm`       | ✅     | fine                                                                                         |

### Platform (scheduling, email, marketplace, seo, automations, settings, onboarding)

| Path                                                                                                                                         | Name                        | Kind                     | Current                  | Status | Action                             |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------ | ------------------------ | ------ | ---------------------------------- |
| `scheduling/services/_components/new-service-button.tsx` + `service-form.tsx`                                                                | New / edit service          | Single-step create form  | self-owned modal         | 🔲     | surface + overlay                  |
| `scheduling/resources/_components/new-resource-button.tsx` + `resource-form.tsx`                                                             | New / edit resource         | Single-step create form  | self-owned modal         | 🔲     | surface + overlay                  |
| `scheduling/bookings/_components/new-booking-button.tsx` + `booking-form.tsx`                                                                | New booking (slot picker)   | Single-step create form  | self-owned modal         | 🔲     | surface + overlay                  |
| `scheduling/bookings/_components/booking-actions.tsx`                                                                                        | Booking status actions      | Confirm                  | self-owned modal         | ➖     | `useConfirm`                       |
| `scheduling/policies/_components/new-policy-button.tsx` + `policy-form.tsx`                                                                  | New / edit policy           | Single-step create form  | self-owned modal         | 🔲     | surface + overlay                  |
| `scheduling/availability/page.tsx` + `weekly-editor.tsx` + `exceptions-panel.tsx`                                                            | Availability editor         | Edit/record form         | full-page / inline       | 🔲     | design call (inline vs sheet)      |
| `scheduling/resources/_components/calendar-feed-dialog.tsx` (+ `calendar-connections-section`, `caldav-connect-form`)                        | Calendar sync               | Substantive dialog/modal | self-owned modal         | 🔲     | overlay / standard Dialog          |
| `scheduling/_components/requirement-editor.tsx`                                                                                              | Resource requirements       | Edit/record form         | inline (in service-form) | 🔲     | migrates with service-form         |
| `email/settings/settings-form.tsx`                                                                                                           | Email settings              | Settings form            | inline                   | ✅     | settings page                      |
| `email/suppressions/_components/add-suppression-form.tsx`                                                                                    | Add suppression             | Single-step create form  | overlay                  | ✅     | surface-aware                      |
| `email/domains/_components/add-domain-form.tsx`                                                                                              | Add sending domain          | Single-step create form  | overlay                  | ✅     | surface-aware                      |
| `email/domains/_components/domain-actions.tsx`                                                                                               | Remove domain               | Confirm                  | useConfirm               | ✅     | done (useConfirm)                  |
| `email/broadcasts/_components/broadcast-composer.tsx`                                                                                        | Create broadcast            | Create wizard            | full-page only           | 🔲     | design call (SurfaceFrame page?)   |
| `email/broadcasts/[id]/broadcast-actions.tsx`                                                                                                | Schedule / send now         | Bulk/action modal        | inline                   | 🔲     | lift scheduler into dialog         |
| `email/test-send-form.tsx`                                                                                                                   | Test send (dev)             | Inline page-body form    | inline                   | ➖     | dev tool                           |
| `marketplace/_components/blueprint-card-actions.tsx` / `installs/[id]/_components/review-actions.tsx`                                        | Blueprint install/go-live   | Confirm                  | `useConfirm`             | ➖     | fine                               |
| `marketplace/installs/[id]/update/page.tsx`                                                                                                  | Blueprint update review     | Edit/record form         | full-page only           | 🔲     | design call (SurfaceFrame page?)   |
| `seo/_components/search-console-control.tsx`                                                                                                 | Search Console connect/pick | Picker dialog            | inline                   | 🔲     | lift site-picker into overlay      |
| `seo/_components/seo-report-panel.tsx`                                                                                                       | SEO audit report            | (read-only)              | full-page                | ➖     | read-only                          |
| `automations/_components/automation-editor.tsx`                                                                                              | Automation create/edit      | Create wizard            | full-page canvas         | ✅     | full-page canvas correct           |
| `automations/_components/automation-actions.tsx`                                                                                             | Delete automation           | Confirm                  | `useConfirm`             | ➖     | fine                               |
| `settings/general/general-form.tsx`, `settings/chat/...`, `settings/payments/...`, `settings/modules/...`, `settings/notifications/page.tsx` | Settings forms              | Settings form            | inline                   | ✅     | settings pages                     |
| `settings/sites/new-site-wizard.tsx`                                                                                                         | New site wizard             | Create wizard            | self-owned modal         | ✅     | SurfaceFrame modal variant         |
| `settings/sites/sites-manager.tsx`                                                                                                           | Sites manager               | Edit/record form         | inline                   | ✅     | inline cards correct               |
| `settings/domains/purchase-dialog.tsx`                                                                                                       | Domain purchase / register  | Substantive dialog/modal | self-owned modal         | 🔲     | overlay (two modes)                |
| `settings/domains/domains-manager.tsx`                                                                                                       | Domains manager             | Edit/record form         | inline                   | ✅     | inline cards correct               |
| `settings/ai-integrations/_components/issue-key-form.tsx`                                                                                    | Issue API key               | Single-step create form  | inline (settings)        | 🔲     | lift into overlay                  |
| `(onboarding)/_components/onboarding-wizard.tsx` (+ step-\*)                                                                                 | Onboarding wizard           | Create wizard            | full-page                | ✅     | SurfaceFrame page variant          |
| `(onboarding)/_components/step-domain.tsx`                                                                                                   | Onboarding domain step      | Create wizard step       | inline                   | ⚙️     | shares `purchase-dialog` migration |

---

## How to work an item

1. Pick a row (or a whole wave). Read [`form-surface`](../.claude/skills/form-surface/SKILL.md) §0 to confirm wizard vs single-step and whether it gets a summary.
2. Build/convert the component (skill §1–§2), wire the **three registries** (skill §3 — the footgun), wire launcher + `/new` route (skill §4).
3. Apply the design rules (skill §5 — no eyebrows, tokens, `@sparx/ui` components).
4. Verify in **all three presentations** (skill §6 — modal / full page / drawer).
5. Update this doc: flip the row's Status and bump the version + date.

When a wave is done, re-run a quick sweep (grep for `full-page only` create forms and self-owned `Modal`s) to catch anything new that landed in the meantime.
