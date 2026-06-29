# Form & Modal Surface Inventory

Version: 1.22
Author: Brandon Korous
Last Updated: 2026-06-28

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

| Status             | Count | Meaning                                                                                                                              |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------ |
| ✅ done            | ~74   | wizards already on F-layout, surface-aware create forms, settings pages, standard pickers; **Wave 3 self-owned modals (2026-06-28)** |
| ⚙️ partial         | ~3    | a few non-standard confirms riding on bigger (still-pending) migration rows                                                          |
| 🔲 needs migration | ~59   | the real backlog — full-page create forms (Wave 2), inline detail-page forms (Wave 4), substantive dialogs (Wave 5)                  |
| ➖ N/A             | ~40   | `useConfirm` dialogs, `ImportDialog` users, read-only panels                                                                         |

The backlog is large but **highly repetitive** — most of it is the same three or four shapes repeated
across modules, which is exactly what the `form-surface` skill is for. The waves below order it by shape,
so each wave is "the same move, N times."

---

## Strategy & workstreams (WS1–WS5) — locked 2026-06-28

The form strategy is settled (spec: [docs/86](86-surface-frame-pattern.md) §1A). Three decisions, then the
remaining backlog organized as five workstreams — **this is the standing goal: complete WS1–WS5.**

**The strategy in one line:** _one form primitive · three surfaces the **user** picks · single-page by
default · editors are not forms._

1. **The user picks the surface — keep it, it's the differentiator.** Every create/edit honors the
   operator's `defaultDetailView` (drawer / modal / full-page / new tab) via `EntityCreateButton`. Other
   systems force the container by field-count; we let the operator choose and apply it everywhere. Safe
   across all three because the `modal` variant is a **large ~920×680 canvas**, not a cramped dialog.
2. **Single-page by default; a wizard must be earned.** A form is one well-structured scroll (grouped
   `<Card variant="module">` sections + its live summary), not a stepper. Multi-step is reserved for
   genuinely sequential/branching **and** infrequent flows — **onboarding + blueprint/new-site only.**
3. **Editors are not forms.** Visual canvases (builder, automation, broadcast composer, configurator
   template editor, CMS schema/menu editors, scheduling availability) keep their own chrome and are
   excluded from this backlog — never wizard-ify them.

| WS      | What                                                                 | Maps to              | Status                                |
| ------- | -------------------------------------------------------------------- | -------------------- | ------------------------------------- |
| **WS1** | Collapse the multi-step create wizards to single-page                | _new_ (was Wave 1+)  | ✅ done (7 collapsed + product kept)  |
| **WS2** | Full-page-only create forms → overlay (single-page, honor pref)      | old Wave 2           | ✅ done (CRM/inv/invoicing/cms)       |
| **WS3** | Editor exclusion — formally drop editor-class surfaces from this doc | "Design calls" below | ✅ done (exclusion list recorded)     |
| **WS4** | Inline detail-page edit/record forms → standardize                   | old Wave 4           | ✅ done (already remediated; audited) |
| **WS5** | Substantive dialogs → standard overlay/dialog                        | old Wave 5           | ✅ done (most already on `Modal`)     |

### WS1 — collapse the multi-step create wizards to single-page (the new headline work)

These eight already ride `SurfaceFrame` with a live summary column (Wave 1). WS1 collapses their `steps`
array into **one step** — the grouped `<Card variant="module">` sections stack in one internal scroll, the
summary column stays, the toolbar becomes **Cancel + Create** (no Back/Continue). A single-page form is what
lets these render well in a drawer or modal (a stepper only really works full-page), so this is what makes
decision (1) pay off. Keep field grouping, validation, and the summary; only the step boundaries go.

- `crm/quotes/new/_components/quote-wizard.tsx` · `crm/orders/new/_components/order-wizard.tsx`
- `inventory/purchase-orders/new/_components/purchase-order-wizard.tsx` · `inventory/transfers/new/_components/transfer-wizard.tsx`
- `invoicing/documents/new/_components/invoice-wizard.tsx`
- `crm/customers/new/customer-full-profile-wizard.tsx` · `b2b/accounts/new/b2b-account-wizard.tsx`

✅ **All 7 collapsed (2026-06-28), gate-clean.**

**Stays multi-step (do NOT collapse):** `(onboarding)/_components/onboarding-wizard.tsx` (first-run, no app
chrome); `settings/sites/new-site-wizard.tsx` + blueprint install (branching, infrequent); and
`commerce/products/_components/product-wizard/` — the **earned in-app wizard** (decided 2026-06-28): a
progressive-draft flow (Basics creates a real draft → Variants/Media/Fitment/Organization attach to the real
product via the detail-tab endpoints → Review publishes), branching by fulfillment type. It is
sequential-dependent, not a flat form, so it keeps its stepper (docs/86 §1A #2).

> WS2 = the "Wave 2" section, WS3 = the "Design calls" section (made a formal exclusion), WS4 = the "Wave 4"
> section, WS5 = the "Wave 5" section — all below, unchanged in content, now numbered as workstreams.

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

### Fitment rebuild — global removed, then a dimension-driven model (2026-06-28)

Two structural changes landed back-to-back, both eyes-on verified across the whole stack.

**1. The platform-global Vehicle domain is gone.** Nothing fitment-shaped shows by default (a bakery/publisher never sees "Vehicle"). The four reference tables went `tenant_id NOT NULL` + strict FORCE RLS (migration `20260923000000`); the platform now ships a **library of 14 installable dictionaries** (`packages/commerce-schemas/src/fitment-dictionaries.ts`, industry-varied) a tenant stamps as its own tenant-scoped copy. New dashboard surfaces: a **dictionary picker** (3-col `ModalContent size="2xl"`, soft module badges, correct pluralization) + the install/“+ New domain” shell (`fitment-manager.tsx`). _(The bespoke `dictionary-picker.tsx` was later generalized into the shared cross-module `PresetPicker` — see the Wave 1 module-preset entry below.)_

**2. The rigid 3-level + 1-range model became fully dimension-driven (the real fix).** A merchant flagged that the old `labels.l1/l2/l3 + rangeUnit` baked a 3-tier cap and shoved year into one product-side range — "2026 Ford F-250 6.7L" or "2026 MacBook Pro M2" couldn't be expressed, and the tree was **add-only** (no rename/delete/uninstall — a typo was unfixable). Reworked to:

- **Schema** (`33-commerce-fitment.prisma`, migration `20260924000000`, **data-preserving**, tenant-looped for FORCE-RLS): `fitment_domains.dimensions` JSON (`{key,label,kind:'level'|'range',unit?}[]`, unlimited depth); a single self-referential **`fitment_nodes`** table (replaces categories/items/variants) carrying materialized `path`/`pathNames`/`depth` for ancestor (storefront "fits my 2015 F-250") + descendant (collection "all Ford parts") filtering; `product_fitments.nodeId` (null = whole-domain) + a **`product_fitment_ranges`** child (unlimited numeric axes). Every existing row migrated (category/item/variant → node keeping its id; labels → dimensions; range_min/max → a range row).
- **Service / API** (`fitment-service.ts`, `commerce/fitment.ts`): generic node CRUD (create/update/**delete**/reorder, with rename cascading `pathNames`), domain update + **uninstall** (returns products-affected), dimension-aware `lookup`.
- **Dashboard** (all standardized: `useConfirm`, soft module badges, `Button shape="square"` icon buttons): **dimension-builder** dialog (`new-domain-dialog.tsx` — add arbitrary level/range dimensions, **no Vehicle default**), a generic **N-level tree editor** (`fitment-reference-editor.tsx` — lazy drill of ANY depth with inline **rename + delete + add-per-level + drag-reorder (whole-row, dnd-kit) + uninstall**), a shared **node drill** (`products/_components/fitment-node-drill.tsx`) reused by the product **Fitment panel** (node path + per-range-dimension from/to inputs) and the product **wizard** step.
- **Consumers migrated** to nodes/ranges: storefront read-path + generic `FacetPanel` (`apps/site`), B2B **fleet** (vehicle = node + range values, ancestor-matched compatible-products), `collection-rules` (descendant-by-name via `node.pathNames`), `search-projection` (depth-bucketed denorm).

Verified: all 7 affected workspaces `tsc` clean; migration applied + re-seed (`4 makes / 8 models / 11 engines`, `nodes=23`, `ranges=8`) data-correct on docker; on screen — Vehicle tree drills 3 deep with rename/delete on every node + uninstall on the domain, the dimension builder opens with neutral placeholders, and a product rule shows `Ford / F-250 / 6.7L Power Stroke` + a `Year 2011–2022` narrowing badge with Year from/to inputs.

### Module-preset registry + install seam — Wave 1 (2026-06-28)

The fitment dictionary install was the first instance of a general pattern: **a per-module, data-as-code config pack a tenant installs into an enabled module.** Wave 1 generalized it into a reusable seam so later waves (tax zones, CRM pipelines, taxonomies, …) and industry starters all plug in the same way.

- **Contract + registry** (`@sparx/modules/src/presets.ts`, re-exported via `@sparx/auth`): `ModulePreset` (`module, slug, kind, name, description, iconKey, tags, summary, isInstalled(ctx), install(ctx)`) + a pure `ModulePresetRegistry` (dedup, `forModules`, `get`) + `toModulePresetView`. `install`/`isInstalled` take a `TenantContext` that MAY carry an open `tx`, so an industry starter can stamp several presets atomically. Unit-tested (`presets.test.ts`).
- **Commerce entry #1** (`@sparx/commerce/src/presets.ts`): the 14 fitment dictionaries register as `commerce` presets (`kind: 'fitment'`, slug `fitment-<dict>`), each delegating to the verified `installFitmentDictionary` / new `isFitmentDictionaryInstalled` — so picker-installed, starter-installed, and seeded trees are byte-identical.
- **Seam at the composition root** (`services/api-rest/src/lib/preset-registry.ts`, sibling of `module-provisioning.ts` for the same acyclic-deps reason): `listInstallablePresets` self-filters to the tenant's **enabled modules** (one tx for all `isInstalled` checks); `installPreset` **gates on the owning module being enabled** (a disabled module stores no rows) and 404s unknown presets. Neither path ever writes `settings.modules`.
- **Generic API** (`routes/v1/presets.ts`): `GET /v1/presets?module=&kind=` + `POST /v1/presets/:module/:slug/install`. The bespoke `/v1/commerce/fitment/dictionaries[/:slug/install]` endpoints were **retired** — one install path.
- **Shared picker** (`(dashboard)/_components/preset-picker.tsx` + `preset-actions.ts`): the cross-module `PresetPicker` (per-card `<ModuleProvider>` so each pack wears its module hue; `summary` chips; server-resolved `installed` → "Installed" badge). The fitment page is its first consumer (`?module=commerce&kind=fitment`); the bespoke `DictionaryPicker` was deleted.

Verified: typecheck (5 workspaces) + lint (0 errors) + prettier clean; registry unit tests green. Runtime/eyes-on (browse → install → tree appears) pending an api-rest dev reload.

### Two-defect-class sweep — IDs→names + conforming badges (2026-06-28)

A proactive sweep across **all of commerce + the CRM overlap**, after the user kept catching the same two fingerprints one page at a time on the Returns surface ("the customer id should be the customer name", "shouldn't this be the item name?", "those badges aren't conforming"). Grep-driven (`<Badge variant="outline">{rawEnum}</Badge>` ≈ 30 hits; `.slice(0, 8)` identity ≈ 22 files), then fixed at the source rather than waiting to be found.

- **Class B — badges.** Every raw snake_case enum / bland uncolored outline badge → humanized + `variant="soft"` + `size="sm"` + an explicit color, per the `statusLabel`/`statusTone` convention (status → `statusTone`; primary classifier → `info`; secondary/metadata/code chip → `neutral`; quality/quantity → semantic). Surfaces: carts, checkout-sessions, bundles, discounts, tax, pricing (lists + details), configurator, providers, shipping (zones/profiles/list), products (variants-panel, wizard, tab counts, pricing panels, bulk-pricing), price-reviews, surcharges, markup-rules, qa; CRM duplicates, activity-timeline, customers header. Also caught **two `color="outline"` bugs** (outline passed where a tone belongs — a no-op that rendered greyscale) in checkout-sessions + providers + subscriptions detail. **Zero `<Badge variant="outline">` remain in commerce.**
- **Class A — IDs resolve to names.** Where a table/detail showed a partial GUID for an entity that has a human label, the label is now resolved (id kept only as the fallback). Needed service joins: **carts** (`customerName` on `CartSnapshot`), **subscriptions** (`customerName` on summary + line `variantSku`/`productTitle` + `addonOfName`), **configurator** add-ons (batched variant→sku/title — the `ConfigurationAddOn` row has no relation), **wishlists** (variant column → `variantTitle`), **CRM reports** win/loss (`repId` → name via `/v1/users` map), **reviews** (media-asset ids → actual **thumbnails** through the public media redirect, mirroring product-media). Extracted the duplicated customer-label logic into a shared `packages/commerce/src/services/customer-name.ts` (`CUSTOMER_NAME_SELECT` + `customerDisplayName`); `return-service` now imports it instead of its local copy.

Verified: `@sparx/commerce` + `@sparx/dashboard` `tsc` clean; ESLint clean on all touched files (only pre-existing `max-lines` warnings); prettier clean. Left genuine count/label chips (`{items.length}`, "Default", "NOT") and own-id diagnostics (a cart/session/subscription's own handle, which have no friendlier number) as-is — not the defect class.

### Same sweep, extended platform-wide (2026-06-28)

Took the two-defect-class sweep through **the rest of the dashboard** — Inventory, Invoicing, CMS, B2B, the CRM detail pages (orders/quotes/deals/pipelines/segments/tasks), Email, Settings (excl. channels), Builder, Marketplace browse, Automations, Welcome, and the dashboard home. ~90 dashboard files touched. Findings:

- **Class A was largely already clean outside commerce** — Inventory/Invoicing/CRM-wizard list rows already use the right `productTitle ?? variantSku ?? id.slice` fallback chain. The genuine id→name gaps fixed: CMS **taxonomy parent term** (client-side name map), CMS **revision author** (`/v1/users` map, like the win/loss report). The CMS **relation-field** chip (a generic `<code>{id.slice}</code>` across arbitrary content types) is left as a real gap — it needs a relation-title-resolution feature, not a token swap.
- **Class B was the bulk** — every remaining `<Badge variant="outline">` across the dashboard → soft + sized + colored. **Zero `<Badge variant="outline">` remain** anywhere under `apps/dashboard` except 3 files owned by other in-flight agents (`marketplace/installs/*`, `settings/channels/*`).
- **A third sub-pattern surfaced and got swept too: `color={MAP[x] ?? 'outline'}` / `color={cond ? tone : 'outline'}`.** `'outline'` is a _variant_, not a color — passed as `color` it renders greyscale, silently dropping the intended tone (and the `MAP[x] ?? 'outline'` fallback never colored unknown statuses). Found ~14 (b2b accounts/quotes/invoices/appointments status badges, CRM task priority, CMS media/revision status, email event type) — all corrected to `?? 'neutral'` + `statusTone`/`statusLabel` where the label was raw. The `variant="outline"`-grep missed these; a follow-up grep for `color={…'outline'}` is the way to catch the class.

Coordination: stayed off the parallel agents' files (fitment/preset seam, finance/payments + finance/subscription, settings/channels) — formatted/linted only my own. `@sparx/dashboard` `tsc` + ESLint + prettier clean.

### Wave 3 complete — self-owned modals → overlay system (2026-06-28)

Migrated all eight Wave 3 list-surface forms off their bespoke `Modal` onto the
surface-aware `*Form(presentation)` pattern, wired into the `@detail` overlay system:
**scheduling** services / resources / policies / bookings, **b2b** service-types /
pricing-tiers, **inventory** sources, **dropship** suppliers. ~40 files.

The shared shape every form now follows (one component, three presentations):

- **`presentation: 'page' | 'overlay' | 'modal'`** — a single component drives the
  full-page `/new` route (`embedded`), the `@detail` drawer/modal create overlay
  (`inline`, opened by `EntityCreateButton` honoring `defaultDetailView`), AND — for the
  list-managed entities with no detail view — **edit via a self-owned `SurfaceFrame`
  `modal` variant** (the blessed new-site-wizard pattern). Create rides the overlay;
  edit rides a modal. Both wear the F-layout, the `<Card variant="module">` field card,
  the Cancel-anchored toolbar, and the leave-guard.
- **Leave-guard unified across all three** via `useUnsavedGuard(dirty, copy)` — a JSON
  snapshot-vs-initial `dirty` (StrictMode-safe lazy initializer, no skip-first-render
  ref). The F variants use the frame-owned Cancel; the modal variant uses
  `onRequestClose` + a footer Cancel (async-confirm-then-close), exactly like new-site.
- **Three-registry wiring** per entity (the footgun): `createComponents` + `detailModules`
  in `detail-slot.tsx`, `CREATE_VIEW_TYPES` + `FULL_BLEED_CREATE_TYPES` in
  `detail-registry.ts`, and a create-only `entityTypes` entry (NO `hasDetailView`) in the
  owning module's `manifest.ts`. Launchers swapped to `EntityCreateButton`; `/new` routes
  added. Forms needing server data register a thin async server wrapper (booking → active
  services; dropship supplier → vendor catalog + sites).
- **Two genuinely multi-shape cases:** **bookings** is create-only (status changes go
  through `booking-actions`, not a form) and its create is a single step with the slot
  picker inside; **dropship suppliers** create is a real **two-step** SurfaceFrame
  (`VendorPicker` step → configure step, with Back), while edit is the single configure
  step — one component handles both via a computed `steps`/`current`.
- **Delete confirms normalized** while in these files: the source + supplier `AlertDialog`
  removes became `useConfirm` + toast (service-types already was). The catalog-color
  `<input type="color">` (no `@sparx/ui` equivalent) and the `requiresVehicle` checkbox →
  themed `Checkbox color="module"` were tidied in passing.

**Decision (create=overlay / edit=modal):** these entities have no `@detail` detail view,
so create honors the user's drawer/modal/page preference (consistent with every other
create surface) while edit opens a centered modal from the list row — the same split the
new-site wizard already uses, not a full detail-view build (which Wave 3 doesn't ask for).

Verified: `@sparx/dashboard` `tsc` clean; ESLint **0 errors** (only pre-existing
`max-lines` warnings); prettier clean on all touched files. On-screen pass (each form in
drawer / modal / full-page, plus edit-from-list) pending a dev reload — the user owns the
dev lifecycle.

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

- **2026-06-29 — Cross-module coverage sweep (beyond the WS census) ✅ gate-clean.** Repo-wide fingerprint scan
  across ALL dashboard modules for form/dialog anti-patterns (raw `<input>/<select>/<textarea>`,
  `text-[var(--color-danger)]` spans, `AlertDialog`-for-data-entry). Enumerated every `/new` create route (10
  modules) — all map to entities already standardized in WS1/WS2/Wave-3. **Two genuine gaps found + fixed in
  modules the WS census didn't enumerate:** (1) builder governance `_governance/components/archetype-catalog`
  rendered its new/edit "brand section" form (Name + Category) inside an `AlertDialog` — converted to `Modal`
  (the new-component-button anti-pattern); (2) CRM `deals/[id]/stage-picker` used a raw re-skinned `<select>`
  (hand-built `SELECT_CLASS` fill+border) — swapped to `NativeSelect`. **Verified clean / correctly excluded:**
  `automations/new` = the `AutomationEditor` canvas (WS3 editor exclusion); settings general/chat/ai/domains
  forms all design-system-clean (purchase-dialog's only raw input is a `type="hidden"`); `terms-manager` +
  `redirects-list` `AlertDialog`s are legit DELETE confirmations (not data entry). **Lower-priority, left
  as-is (editor/grid contexts):** `commerce/bundles/bundle-editor` (WS3 editor-class, raw `<select>`s by
  design) and `invoicing/documents/_lib/markup` (a dense grid-cell native-select skin). With this,
  data-entry-in-`AlertDialog` is fully eliminated dashboard-wide. `@sparx/dashboard` tsc clean · ESLint 0
  errors · prettier clean.

- **2026-06-29 — WS4 audited COMPLETE: inline detail-page edit/record forms already standardized.** Audited the
  full WS4 list on a clean tree (after the card-tint sweep + prior "surface polish" commits landed). **Finding:
  WS4's "raw forms clobbering the chrome" was already remediated incrementally** — every form now uses the
  `@sparx/ui` design system (no raw `<input>/<select>/<textarea>`, no `text-[var(--color-danger)]` spans, no
  `AlertDialog`-for-data-entry, proper `<Card variant="default">` + `<Label>` + `color="module"` + error/saved
  states + `useUnsavedGuard`/`useConfirm` where relevant). **Verified compliant (read in full):** commerce
  returns approval/inspection/refund, reviews `respond-form`, qa `answer-form`, shipping `new-rate-form`, CMS
  `consent-settings-form`, `authors/[id]/author-edit-form`. **Verified clean (fingerprint scan):**
  `markup-rules-manager`, `surcharges-manager`, b2b `quote-respond-editor`, `cms/[id]/edit-form`,
  `types/[typeKey]/[id]/edit-entry-form`, `taxonomy/[key]/terms-manager`, `media/[id]/edit-form`. **Excluded:**
  `fitment-reference-editor` (fitment seam — a parallel agent's, off-limits) and `schema-editor` (WS3 editor
  exclusion). **Residual is NOT a compliance fix but a design-pattern call** (left as-is, flagged for an
  eyes-on/user decision): the markup/surcharge managers use _heavy expand-in-place_ and the b2b
  `quote-respond-editor` is a _wide pricing workspace_ — the docs only ever "likely"-flagged these as
  candidates to lift into an overlay/own-route; they're already design-system-clean, so lifting them is a UX
  preference, not a defect. No code change made (the surfaces were already correct; manufacturing edits on
  clean files would be churn). **WS4 done.**

- **2026-06-29 — WS5 COMPLETE: substantive dialogs → standard `Modal` ✅ gate-clean.** Key finding: **most WS5
  "substantive dialogs" were already on the standard `@sparx/ui` `Modal`/`useConfirm`** — the census's
  "self-owned modal" just means each component owns its own `Modal` instance (there's no central dialog
  registry; that IS the target). Verified already-compliant: `b2b/invoices/[id]/invoice-actions` (mark-paid /
  write-off), `b2b/appointments/appointment-actions`, `b2b/approval-queue/approve-reject-actions`,
  `settings/domains/purchase-dialog` (two modes — also onboarding `step-domain`), `scheduling/resources/
calendar-feed-dialog`. **Genuinely converted (3):** `builder/components/new-component-button`
  (`AlertDialog` — the wrong primitive for data entry → `Modal`); `settings/ai-integrations/issue-key-form`
  (inline settings form → a `Modal` launched from the page-header "Issue key" action, success-reveal panel
  kept inside the modal); `email/broadcasts/[id]/broadcast-actions` (inline datetime scheduler → a "Schedule…"
  button opening a small `Modal`; "Send now" stays inline). **Boy-scout while in-file:** danger spans →
  `<Text variant="danger">` (appointment / approve-reject / calendar-feed); reset shared `notes` between the
  mark-paid & write-off modals in invoice-actions. **Judged compliant, left as-is:** `seo/search-console-control`
  is a connection state-machine widget (already uses `useConfirm` for the destructive disconnect; its inline
  site-picker — 1–3 verified sites as buttons — is appropriate, not a bespoke dialog to "lift"). `marketplace/
installs/.../update` is a parallel agent's diff-review surface (excluded, untouched). `@sparx/dashboard` tsc
  clean · ESLint 0 errors · prettier clean. **WS5 done.** With WS1–WS3 + WS5 complete, only **WS4** remains —
  blocked by the parallel card-tint sweep on its exact edit/detail files (sequence after it lands).

- **2026-06-29 — WS2 COMPLETE: invoicing workflow + CMS type-scoped new-entry ✅ gate-clean.** Final two WS2
  forms: **invoicing workflow** (`/invoicing/workflows/new`) converted exactly like the CRM pipeline (name +
  slug auto-derive + default `Checkbox` → single-step `SurfaceFrame`; create-only, no `@detail` drawer; on
  success continues to the workflow's stage editor) — wired into `createComponents`/`detailModules`/registry
  sets + a create-only `workflow` `entityType` in the invoicing manifest + `EntityCreateButton` launcher.
  **CMS type-scoped new-entry** (`/cms/types/[typeKey]/new`) converted by rewriting `NewEntryForm` to OWN the
  `SurfaceFrame` chrome + floor toolbar + required-field guard + submit + `useUnsavedGuard`, rendering the
  SHARED `ContentEntryForm` in CONTROLLED (fields-only) mode so the schema editor stays untouched. It stays a
  **page surface** (no new overlay): the generic `content-entry` overlay (ContentEntryWizard) already covers
  the drawer/modal create-with-type-picker case. **Design-direction change applied (landed mid-session in
  packages/ui/CLAUDE.md #26):** single-module working surfaces — create/edit forms, wizard steps — now use
  NEUTRAL `<Card>` (`variant="default"`), NOT the module tint (tint reserved for cross-module overview
  surfaces; form identity comes from the frame chrome + `color="module"` primary + the module-tinted summary
  rail). All six WS2 forms aligned (dropped `variant="module"` on field cards). **A parallel agent is running
  this card-tint sweep globally** (it converted the pipeline card + edited the UI CLAUDE.md) — the WS1 forms +
  other existing create/edit forms still on `variant="module"` are THEIRS to sweep, not touched here.
  `@sparx/dashboard` tsc clean · ESLint 0 errors · prettier clean. **WS2 done** — next is WS3 (editor
  exclusion, doc-only) then WS4/WS5.

- **2026-06-29 — WS2 inventory complete: supplier + lot + count → overlay ✅ gate-clean.** Converted the
  three inventory full-page-only create forms onto single-step `SurfaceFrame` overlays (all create-only — no
  `@detail` drawer; their detail screens are wide full-page workflows — so each navigates to its full-page
  detail on success): **supplier** (`/inventory/suppliers/new`; Basics/Contact/Address/Terms sections, no
  server data), **lot** (`/inventory/lots/new`; SKU resolver + warehouse list via a server wrapper), **count**
  (`/inventory/counts/new`; cycle/full branching + by-SKU CyclePicker, warehouse list via a server wrapper).
  All three previously had no `useUnsavedGuard` — added it; converted danger spans → `<Text variant="danger">`
  and section cards → `<Card variant="module">`. **Pattern note:** these keep their existing UNCONTROLLED
  native form (FormData on submit) — the frame's toolbar primary lives outside the `<form>`, so it bridges via
  `onNext: () => formRef.current?.requestSubmit()` (the form keeps a normal `onSubmit`). The no-warehouse guard
  moved INTO the lot/count forms (a centered `EmptyState` early-return) so both surfaces share it and the
  `/new` pages render bare. Wired per form: `createComponents` (+ async server wrappers `LotCreateOverlay` /
  `CountCreateOverlay` loading `/v1/inventory/locations`) + `detailModules['…']='inventory'`;
  `CREATE_VIEW_TYPES` + `FULL_BLEED_CREATE_TYPES`; new create-only `entityTypes` (supplier/lot/count) in the
  inventory manifest; list launchers swapped to `EntityCreateButton`. **`receive` is deliberately OUT of WS2:**
  it has no standalone "New" — receiving is a PO-scoped goods-receipt transaction reached from
  `/inventory/purchase-orders/{id}/receive`, not an entity create (belongs with the transaction/editor
  surfaces, not the create-overlay system). `@sparx/dashboard` tsc clean · ESLint 0 errors · prettier clean.
  Remaining WS2: invoicing workflows/new, cms type-scoped new-entry.

- **2026-06-29 — WS2 CRM complete: pipeline + B2B-create consolidation ✅ gate-clean.** Converted the
  CRM **pipeline** create form (`crm/pipelines/new`) off the old `<Card>`+`<CardFooter>` shell onto a
  single-step `SurfaceFrame` (`new-pipeline-form.tsx`: controlled state, live name→slug auto-derive,
  `Checkbox` for default, `useUnsavedGuard`, frame-owned Cancel). Pipeline has no `@detail` drawer (its detail
  is a full-width Kanban) and a fresh pipeline has no stages, so on success it **continues to the edit screen**
  (to add/order stages) rather than returning to the list. Wired: `createComponents['pipeline']` (no server
  data — direct `() => <NewPipelineForm surface="overlay" />`) + `detailModules['pipeline']='crm'`;
  `CREATE_VIEW_TYPES` + `FULL_BLEED_CREATE_TYPES`. Manifest entry + `EntityCreateButton` launcher already
  existed. **B2B create consolidation:** `b2b-account` had TWO create forms — the canonical collapsed
  `B2bAccountWizard` (used by the overlay + `/b2b/accounts/new`) and a legacy card+footer `B2bAccountCreateForm`
  rendered only at `/crm/b2b/new`. Deleted the dead legacy form; turned `/crm/b2b/new` into a `redirect()` to
  the canonical `/b2b/accounts/new`; pointed the `/crm/b2b` list launcher (`newHref`) there too. **Flagged
  (needs a user IA decision, NOT done):** `b2b-account` is registered in BOTH the CRM manifest (`routePrefix:
/crm/b2b`, `hasDetailView`) AND the B2B manifest (`/b2b/accounts`) — two parallel B2B sub-apps (each with its
  own list + `[id]` detail) and a latent `findEntityType` first-match conflict. Consolidating those two
  homes is out of WS2's form scope. `@sparx/dashboard` tsc clean · ESLint 0 errors · prettier clean. Remaining
  WS2: inventory counts/lots/suppliers/receive, invoicing workflows/new, cms type-scoped new-entry.

- **2026-06-29 — WS2 started: full-page create forms → overlay (2 done) ✅ gate-clean.** Converted the
  CRM **deal** + **task** create forms off the old `<Card>`+`<CardFooter>` shell onto single-step
  `SurfaceFrame` overlays (controlled state, `NativeSelect`, `useUnsavedGuard`, frame-owned Cancel) and wired
  them into the overlay system: `createComponents` (+ async server wrappers for the pipeline/customer/user
  pickers) and `detailModules` (task is create-only, so it needed an explicit `task: 'crm'` accent) in
  `detail-slot.tsx`; `CREATE_VIEW_TYPES` + `FULL_BLEED_CREATE_TYPES` in `detail-registry.ts`; `/new` routes
  stripped of `Container`/`PageHeader`. The deal/task launchers already used `EntityCreateButton` and the crm
  manifest already had the `entityTypes`, so once registered they open in the user's `defaultDetailView`. A
  created **deal** transitions into its detail view; a created **task** (no detail view) returns to the list.
  `@sparx/dashboard` tsc clean · ESLint 0 errors · prettier clean. Remaining WS2: CRM pipelines (+ consolidate
  `crm/b2b/new`), inventory counts/lots/suppliers/receive, invoicing workflows/new, cms type-scoped new-entry.

- **2026-06-28 — WS1: wizard → single-page collapse (7 of 8) ✅ gate-clean.** Collapsed the seven
  compose-locally-then-submit wizards onto one `SurfaceStep` (former steps stack as grouped
  `<Card variant="module">` sections; `steps` is a single entry so MiniProgress auto-hides; the toolbar is
  Cancel + Create; the live summary column is unchanged and now reads as the running "review", so the old
  "Review" step is dropped):
  - **Record-builders:** `b2b/accounts/new/b2b-account-wizard.tsx` (Company / Pricing / Fleet — pilot;
    extracted a `FleetProfilesCard`); `crm/customers/new/customer-full-profile-wizard.tsx` (Contact /
    Classify / Address + an optional "Get a head start" zone). Per-step gating → one submit backstop.
  - **Line-item docs:** `crm/quotes/new/.../quote-wizard.tsx`, `crm/orders/new/.../order-wizard.tsx`,
    `inventory/purchase-orders/new/.../purchase-order-wizard.tsx`, `inventory/transfers/new/.../transfer-wizard.tsx`,
    `invoicing/documents/new/.../invoice-wizard.tsx` — stack [party/header] + [line-items] + [terms]
    (+ deposit / start-stage for billing-document; the created-doc partial-success panel kept). Validation
    failures became inline errors (no step-jump). PO/transfer keep their no-supplier/no-warehouse guard panels.
  - Gate: `@sparx/dashboard` tsc clean · ESLint 0 errors (warn-only `max-lines` only) · prettier clean.
    **On-screen pass in all 3 surfaces pending** (user owns dev; Playwright profile was locked by a live session).
  - **8th = `commerce/products/.../product-wizard` — KEPT MULTI-STEP (user decision 2026-06-28).** It is NOT a
    compose-locally form: it creates a real DRAFT on Basics, then Variants/Media/Fitment/Organization steps
    attach relations to the real product via the same endpoints as the detail tabs, and Review publishes — a
    genuinely sequential, branching progressive-draft = the strategy's "earned wizard" (docs/86 §1A #2). No
    code change. **WS1 COMPLETE: 7 collapsed + product kept as the earned exception.**

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

### WS2 (Wave 2) — single-step create forms: add `surface` + wire the overlay

Mechanical, one per form via the skill (build `*CreateForm` with a `surface` prop → register in the three
places → swap the launcher to `EntityCreateButton`) — the exact move Wave 3 repeated, so each now honors the
user's `defaultDetailView`. The full-page-only create forms:

- Commerce: `bundles`, `configurator`, `discounts`, `shipping/profiles`, `shipping/zones`, `tax/zones`,
  `providers/install`
- CRM: `crm/deals`, `crm/tasks`, `crm/pipelines`; **consolidate** the duplicate `crm/b2b/new` into the
  `b2b/accounts` wizard
- Inventory: `counts`, `lots`, `suppliers`, `purchase-orders/[id]/receive`
- Invoicing: `workflows/new` (name-only step before the full-page editor)

### Wave 3 — self-owned `Modal` forms → overlay system ✅ DONE (2026-06-28)

Same `Modal` + `AlertDialog` pattern repeated; swept with a shared surface-aware
`*Form(presentation)` each. All eight done — see the "Wave 3 complete" log entry below:

- Scheduling: `services`, `resources`, `bookings`, `policies` (each = `new-*-button` + `*-form`)
- B2B: `service-types`, `pricing-tiers`
- Inventory: `sources` (`source-form` + `new-source-button` + `source-actions` + `[id]/source-detail-actions`)
- Dropship: `suppliers` (`supplier-form` + `new-supplier-button` + `supplier-actions` + `vendor-picker`)

### WS4 (Wave 4) — inline record/edit forms on detail pages → standardize

Forms that live raw in a detail-page body and clobber the chrome; wrap in the standard card/overlay:

- Commerce returns: `return-approval-form`, `return-inspection-form`, `return-refund-form`
- Commerce: `reviews/[id]/respond-form`, `qa/[id]/answer-form`, `markup-rules`/`surcharges` RuleForm (heavy
  expand-in-place), `fitment-reference-editor`, shipping/tax `new-rate-form` add-rows
- B2B: `quotes/[id]/quote-respond-editor` (heavy pricing workspace — likely a wide overlay or its own route)
- CMS edit surfaces: `cms/[id]/edit-form`, `author-edit-form`, `media/[id]/edit-form`,
  `types/[typeKey]/[id]/edit-entry-form`, `schema-editor`, `terms-manager`, `legal/consent-settings-form`

### WS5 (Wave 5) — substantive dialogs → standard overlay/dialog

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

### WS3 — Editor exclusion (formal: these are NOT forms, never wizard-ify them)

**Decision (2026-06-28): the following are visual editors / canvases, not CRUD forms — permanently OUT of
the form-surface system.** They keep their own purpose-built chrome; do not wrap them in a `SurfaceFrame`,
do not add a `presentation` prop, do not give them a `/new` overlay. WS3 is the act of recording this so no
later pass tries to "migrate" them.

- `builder/**` bespoke editor surfaces (inspector, panels, palettes, brand/theme controls, framing/preview
  modals) — the page builder is a visual canvas.
- `automations/_components/automation-editor.tsx` — full-page flow canvas.
- `email/broadcasts/_components/broadcast-composer.tsx` — message-composition canvas (its **schedule/send**
  dialog is the only form-shaped part → that's WS5, not the composer itself).
- `commerce/configurator/[id]/_components/template-json-editor.tsx` — the raw-JSON editor is being replaced by
  a **structured/visual editor** (see [[project_configurator_json_audience_gap]]); the structured editor is an
  editor, not a form — excluded here, tracked separately.
- `cms/types/[typeKey]/schema/schema-editor.tsx` + `cms/navigation/menu-editor.tsx` — schema/tree editors.
- `scheduling/availability/page.tsx` + `weekly-editor.tsx` + `exceptions-panel.tsx` — weekly grid editor.
- `marketplace/installs/[id]/update/page.tsx` — blueprint update review (a diff/review surface, not a form);
  **owned by a parallel agent — do not touch, just note the exclusion.**

The narrow form-shaped pieces some of these launch (e.g. the broadcast **scheduler** dialog, the new-component
name prompt) are migrated under WS4/WS5; the editor body itself is excluded.

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

| Path                                                                                                    | Name                              | Kind                         | Current                   | Status | Action                                                          |
| ------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------- | ------------------------- | ------ | --------------------------------------------------------------- |
| `crm/quotes/new/_components/quote-wizard.tsx`                                                           | New quote                         | Create wizard                | overlay                   | ✅     | done (F-layout + summary)                                       |
| `crm/orders/new/_components/order-wizard.tsx`                                                           | New order                         | Create wizard                | overlay                   | ✅     | done (F-layout + summary)                                       |
| `crm/customers/new/customer-full-profile-wizard.tsx`                                                    | New customer                      | Create wizard                | overlay                   | ✅     | done (live summary + fill-to-create tally)                      |
| `crm/customers/_components/record-activity-form.tsx`                                                    | Record activity                   | Inline page-body form        | inline (right rail)       | ➖     | belongs inline                                                  |
| `crm/customers/_components/customers-import-export.tsx`                                                 | Customer import                   | Bulk/action modal            | ImportDialog              | ➖     | fine                                                            |
| `crm/segments/_components/segment-create-form.tsx`                                                      | New segment                       | Single-step create form      | overlay                   | ✅     | surface-aware                                                   |
| `crm/deals/new/_components/new-deal-form.tsx`                                                           | New deal                          | Single-step create form      | full-page only            | 🔲     | surface + overlay                                               |
| `crm/tasks/new/_components/new-task-form.tsx`                                                           | New task                          | Single-step create form      | full-page only            | 🔲     | surface + overlay                                               |
| `crm/pipelines/new/page.tsx`                                                                            | New pipeline                      | Single-step create form      | full-page only            | 🔲     | extract form + surface                                          |
| `crm/pipelines/[id]/edit/_components/*`                                                                 | Pipeline editor (header / stages) | Edit/record form             | inline (edit route)       | ➖     | full-page editor is correct                                     |
| `crm/deals/[id]/_components/attach-order-popover.tsx` / `attach-quote-popover.tsx` / `stage-picker.tsx` | Deal attach/stage                 | Picker                       | inline popover            | ➖     | fine                                                            |
| `crm/b2b/_components/b2b-account-create-form.tsx` + `crm/b2b/new/page.tsx`                              | New B2B account (CRM route)       | Single-step create form      | full-page only            | 🔲     | **consolidate** into `b2b/accounts` wizard                      |
| `crm/b2b/[id]/_components/credit-hold-toggle.tsx`                                                       | Credit hold                       | Confirm                      | inline                    | ➖     | `useConfirm`                                                    |
| `crm/quotes/[id]/_components/quote-lifecycle-actions.tsx`                                               | Quote lifecycle                   | Action bar                   | inline                    | ➖     | fine                                                            |
| `b2b/accounts/new/b2b-account-wizard.tsx`                                                               | New B2B account                   | Create wizard                | overlay                   | ✅     | done (live summary)                                             |
| `b2b/accounts/[id]/_components/fleet-profile-editor.tsx`                                                | Edit fleet profiles               | Edit/record form             | self-owned modal (nested) | 🔲     | overlay / sheet                                                 |
| `b2b/accounts/[id]/_components/approval-rules-editor.tsx` / `b2b-tier-assigner.tsx`                     | Approval rules / tier assign      | Inline page-body form        | inline                    | ➖     | fine                                                            |
| `b2b/accounts/[id]/_components/b2b-account-overrides-table.tsx`                                         | Price overrides                   | Edit/record form             | inline (stub)             | 🔲     | build add form                                                  |
| `b2b/accounts/_components/b2b-accounts-import-export.tsx`                                               | B2B import                        | Bulk/action modal            | ImportDialog              | ➖     | fine                                                            |
| `b2b/service-types/_components/new-service-type-button.tsx` + `service-type-actions.tsx`                | New / edit / delete service type  | Single-step + edit + confirm | overlay (detail system)   | ✅     | done (Wave 3 — create overlay; edit modal; delete `useConfirm`) |
| `b2b/pricing-tiers/_components/tier-create-button.tsx`                                                  | Create pricing tier               | Single-step create form      | overlay (detail system)   | ✅     | done (Wave 3 — RHF create overlay; list read-only)              |
| `b2b/appointments/_components/appointment-actions.tsx`                                                  | Confirm/complete/cancel           | Substantive dialog/modal     | self-owned modal          | 🔲     | overlay or `useConfirm`+notes                                   |
| `b2b/approval-queue/_components/approve-reject-actions.tsx`                                             | Approve/reject order              | Substantive dialog/modal     | self-owned modal          | 🔲     | overlay or `useConfirm`+notes                                   |
| `b2b/invoices/[id]/_components/invoice-actions.tsx`                                                     | Mark paid / write off             | Substantive dialog/modal     | self-owned modal          | 🔲     | overlay                                                         |
| `b2b/quotes/[id]/_components/quote-respond-editor.tsx`                                                  | Respond to B2B quote              | Edit/record form             | inline (detail)           | 🔲     | wide overlay or own route                                       |
| `b2b/quotes/[id]/_components/quote-lifecycle-buttons.tsx`                                               | Accept/decline                    | Action bar                   | inline                    | ➖     | fine                                                            |

### Inventory, Invoicing & Dropship

| Path                                                                                                                                | Name                            | Kind                     | Current                 | Status | Action                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------ | ----------------------- | ------ | -------------------------------------------------------------------------- |
| `inventory/purchase-orders/new/_components/purchase-order-wizard.tsx`                                                               | New purchase order              | Create wizard            | overlay                 | ✅     | done (F-layout + summary)                                                  |
| `inventory/transfers/new/_components/transfer-wizard.tsx`                                                                           | New transfer                    | Create wizard            | overlay                 | ✅     | done (F-layout + summary)                                                  |
| `invoicing/documents/new/_components/invoice-wizard.tsx`                                                                            | New billing document            | Create wizard            | overlay                 | ✅     | done (F-layout + summary)                                                  |
| `inventory/warehouses/_components/warehouse-create-form.tsx`                                                                        | New warehouse                   | Single-step create form  | overlay                 | ✅     | wired in `CREATE_VIEW_TYPES`                                               |
| `inventory/warehouses/[id]/_components/warehouse-edit-form.tsx`                                                                     | Warehouse edit                  | Edit/record form         | inline                  | ➖     | fine                                                                       |
| `inventory/counts/new/_components/count-create-form.tsx`                                                                            | New inventory count             | Single-step create form  | full-page only          | 🔲     | surface + overlay                                                          |
| `inventory/counts/[id]/_components/count-lines-panel.tsx`                                                                           | Count lines                     | Inline page-body form    | inline                  | ➖     | fine                                                                       |
| `inventory/lots/new/_components/lot-create-form.tsx`                                                                                | New lot                         | Single-step create form  | full-page only          | 🔲     | surface + overlay                                                          |
| `inventory/suppliers/_components/supplier-create-form.tsx`                                                                          | New supplier                    | Single-step create form  | full-page only          | 🔲     | surface + overlay                                                          |
| `inventory/suppliers/[id]/_components/supplier-edit-form.tsx`                                                                       | Supplier edit                   | Edit/record form         | inline                  | ➖     | fine                                                                       |
| `inventory/purchase-orders/[id]/receive/_components/receive-form.tsx`                                                               | Receive stock                   | Single-step create form  | full-page only          | 🔲     | surface + overlay (or sheet)                                               |
| `inventory/purchase-orders/[id]/_components/purchase-order-edit-form.tsx`                                                           | PO edit                         | Edit/record form         | inline                  | ➖     | fine                                                                       |
| `inventory/sources/_components/source-form.tsx` + `new-source-button.tsx` + `source-actions.tsx` + `[id]/source-detail-actions.tsx` | Connect/edit inventory source   | Single-step + edit       | overlay (detail system) | ✅     | done (Wave 3 — create overlay; edit modal; delete `useConfirm`)            |
| `inventory/sources/[id]/_components/agent-panel.tsx`                                                                                | Bridge agent pair/rotate/unpair | Substantive dialog/modal | self-owned modal        | ✅     | done (unpair → useConfirm; key-reveal modal kept)                          |
| `inventory/sources/[id]/_components/mappings-panel.tsx` / `unmapped-queue.tsx` / `variant-picker.tsx`                               | SKU mappings                    | Inline page-body form    | inline                  | ➖     | fine                                                                       |
| `inventory/stock/_components/inventory-row-editor.tsx`                                                                              | Adjust / reorder policy         | Inline page-body form    | inline                  | ➖     | fine                                                                       |
| `inventory/reorder/_components/reorder-board.tsx`                                                                                   | Reorder board                   | Inline page-body form    | inline                  | ➖     | fine                                                                       |
| `invoicing/documents/[id]/_components/line-grid.tsx` / `payments-panel.tsx`                                                         | Line composer / payments        | Inline page-body form    | inline (detail)         | ➖     | fine                                                                       |
| `invoicing/documents/[id]/_components/stage-bar.tsx`                                                                                | Stage bar                       | Confirm                  | inline                  | ➖     | `useConfirm`                                                               |
| `invoicing/workflows/new/page.tsx`                                                                                                  | New workflow                    | Single-step create form  | full-page only          | 🔲     | surface + overlay                                                          |
| `invoicing/workflows/[id]/edit/_components/*`                                                                                       | Workflow editor / stage rows    | Settings / edit          | full-page               | ➖     | full-page editor is correct                                                |
| `invoicing/templates/_components/template-row-actions.tsx`                                                                          | Template actions                | Confirm                  | inline                  | ➖     | `useConfirm`                                                               |
| `dropship/suppliers/_components/supplier-form.tsx` + `new-supplier-button.tsx` + `supplier-actions.tsx`                             | Connect/edit dropship supplier  | Single-step + edit       | overlay (detail system) | ✅     | done (Wave 3 — 2-step create overlay; edit modal; disconnect `useConfirm`) |
| `dropship/suppliers/_components/vendor-picker.tsx`                                                                                  | Vendor picker                   | Picker dialog            | overlay (detail system) | ✅     | done (Wave 3 — first step of the create overlay)                           |
| `dropship/suppliers/[id]/catalog/_components/import-button.tsx` / `sync-button.tsx`                                                 | Import / sync                   | Bulk/action modal        | inline                  | ➖     | fine                                                                       |

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

| Path                                                                                                                                         | Name                        | Kind                     | Current                  | Status | Action                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------ | ------------------------ | ------ | ------------------------------------------------ |
| `scheduling/services/_components/new-service-button.tsx` + `service-form.tsx`                                                                | New / edit service          | Single-step create form  | overlay (detail system)  | ✅     | done (Wave 3 — create overlay; edit modal)       |
| `scheduling/resources/_components/new-resource-button.tsx` + `resource-form.tsx`                                                             | New / edit resource         | Single-step create form  | overlay (detail system)  | ✅     | done (Wave 3 — create overlay; edit modal)       |
| `scheduling/bookings/_components/new-booking-button.tsx` + `booking-form.tsx`                                                                | New booking (slot picker)   | Single-step create form  | overlay (detail system)  | ✅     | done (Wave 3 — create-only, slot picker in step) |
| `scheduling/bookings/_components/booking-actions.tsx`                                                                                        | Booking status actions      | Confirm                  | self-owned modal         | ➖     | `useConfirm`                                     |
| `scheduling/policies/_components/new-policy-button.tsx` + `policy-form.tsx`                                                                  | New / edit policy           | Single-step create form  | overlay (detail system)  | ✅     | done (Wave 3 — create overlay; edit modal)       |
| `scheduling/availability/page.tsx` + `weekly-editor.tsx` + `exceptions-panel.tsx`                                                            | Availability editor         | Edit/record form         | full-page / inline       | 🔲     | design call (inline vs sheet)                    |
| `scheduling/resources/_components/calendar-feed-dialog.tsx` (+ `calendar-connections-section`, `caldav-connect-form`)                        | Calendar sync               | Substantive dialog/modal | self-owned modal         | 🔲     | overlay / standard Dialog                        |
| `scheduling/_components/requirement-editor.tsx`                                                                                              | Resource requirements       | Edit/record form         | inline (in service-form) | 🔲     | migrates with service-form                       |
| `email/settings/settings-form.tsx`                                                                                                           | Email settings              | Settings form            | inline                   | ✅     | settings page                                    |
| `email/suppressions/_components/add-suppression-form.tsx`                                                                                    | Add suppression             | Single-step create form  | overlay                  | ✅     | surface-aware                                    |
| `email/domains/_components/add-domain-form.tsx`                                                                                              | Add sending domain          | Single-step create form  | overlay                  | ✅     | surface-aware                                    |
| `email/domains/_components/domain-actions.tsx`                                                                                               | Remove domain               | Confirm                  | useConfirm               | ✅     | done (useConfirm)                                |
| `email/broadcasts/_components/broadcast-composer.tsx`                                                                                        | Create broadcast            | Create wizard            | full-page only           | 🔲     | design call (SurfaceFrame page?)                 |
| `email/broadcasts/[id]/broadcast-actions.tsx`                                                                                                | Schedule / send now         | Bulk/action modal        | inline                   | 🔲     | lift scheduler into dialog                       |
| `email/test-send-form.tsx`                                                                                                                   | Test send (dev)             | Inline page-body form    | inline                   | ➖     | dev tool                                         |
| `marketplace/_components/blueprint-card-actions.tsx` / `installs/[id]/_components/review-actions.tsx`                                        | Blueprint install/go-live   | Confirm                  | `useConfirm`             | ➖     | fine                                             |
| `marketplace/installs/[id]/update/page.tsx`                                                                                                  | Blueprint update review     | Edit/record form         | full-page only           | 🔲     | design call (SurfaceFrame page?)                 |
| `seo/_components/search-console-control.tsx`                                                                                                 | Search Console connect/pick | Picker dialog            | inline                   | 🔲     | lift site-picker into overlay                    |
| `seo/_components/seo-report-panel.tsx`                                                                                                       | SEO audit report            | (read-only)              | full-page                | ➖     | read-only                                        |
| `automations/_components/automation-editor.tsx`                                                                                              | Automation create/edit      | Create wizard            | full-page canvas         | ✅     | full-page canvas correct                         |
| `automations/_components/automation-actions.tsx`                                                                                             | Delete automation           | Confirm                  | `useConfirm`             | ➖     | fine                                             |
| `settings/general/general-form.tsx`, `settings/chat/...`, `settings/payments/...`, `settings/modules/...`, `settings/notifications/page.tsx` | Settings forms              | Settings form            | inline                   | ✅     | settings pages                                   |
| `settings/sites/new-site-wizard.tsx`                                                                                                         | New site wizard             | Create wizard            | self-owned modal         | ✅     | SurfaceFrame modal variant                       |
| `settings/sites/sites-manager.tsx`                                                                                                           | Sites manager               | Edit/record form         | inline                   | ✅     | inline cards correct                             |
| `settings/domains/purchase-dialog.tsx`                                                                                                       | Domain purchase / register  | Substantive dialog/modal | self-owned modal         | 🔲     | overlay (two modes)                              |
| `settings/domains/domains-manager.tsx`                                                                                                       | Domains manager             | Edit/record form         | inline                   | ✅     | inline cards correct                             |
| `settings/ai-integrations/_components/issue-key-form.tsx`                                                                                    | Issue API key               | Single-step create form  | inline (settings)        | 🔲     | lift into overlay                                |
| `(onboarding)/_components/onboarding-wizard.tsx` (+ step-\*)                                                                                 | Onboarding wizard           | Create wizard            | full-page                | ✅     | SurfaceFrame page variant                        |
| `(onboarding)/_components/step-domain.tsx`                                                                                                   | Onboarding domain step      | Create wizard step       | inline                   | ⚙️     | shares `purchase-dialog` migration               |

---

## How to work an item

1. Pick a row (or a whole wave). Read [`form-surface`](../.claude/skills/form-surface/SKILL.md) §0 to confirm wizard vs single-step and whether it gets a summary.
2. Build/convert the component (skill §1–§2), wire the **three registries** (skill §3 — the footgun), wire launcher + `/new` route (skill §4).
3. Apply the design rules (skill §5 — no eyebrows, tokens, `@sparx/ui` components).
4. Verify in **all three presentations** (skill §6 — modal / full page / drawer).
5. Update this doc: flip the row's Status and bump the version + date.

When a wave is done, re-run a quick sweep (grep for `full-page only` create forms and self-owned `Modal`s) to catch anything new that landed in the meantime.
