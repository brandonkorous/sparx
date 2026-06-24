# Form & Modal Surface Inventory

Version: 1.3
Author: Brandon Korous
Last Updated: 2026-06-23

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

| #   | Page (route)                                                | Surface(s)                                                                                                                               | Treatment                                                                        | Score (UI/UX)          |
| --- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------- |
| 1   | Categories `/commerce/categories/[id]`                      | `category-edit-form` (the whole detail body)                                                                                             | single-form detail → **`SurfaceFrame`** (symmetric with create)                  | UI **9** / UX **9** ✅ |
| 2   | Collections `/commerce/collections/[id]`                    | `collection-meta-form` (Metadata tab)                                                                                                    | tab panel → `<Card variant="module">` + consistent Save, no `CardFooter` toolbar | —                      |
| 3   | Products `/commerce/products/[id]`                          | `product-edit-form` (Edit tab) + variants/media/fitment/inventory panels; `new-variant-dialog`/`-form` + `options-editor-dialog` (stubs) | tab panels → module-card cleanup; build the two stub dialogs                     | —                      |
| 4   | Pricing `/commerce/pricing/[id]`                            | `price-list-entries-editor`                                                                                                              | assess — likely correct inline; confirm only                                     | —                      |
| 5   | Bundles `/commerce/bundles/[id]`                            | `bundle-editor` EDIT path (renders inline today)                                                                                         | module-card cleanup; decide vs full `SurfaceFrame`                               | —                      |
| 6   | Configurator `/commerce/configurator/[id]`                  | `template-json-editor`                                                                                                                   | assess — bespoke JSON editor, likely fine                                        | —                      |
| 7   | Returns `/commerce/returns/[id]`                            | `return-refund-form`, `return-approval-form`, `return-inspection-form`                                                                   | inline detail forms → module-card cleanup                                        | —                      |
| 8   | Reviews `/commerce/reviews/[id]`                            | `respond-form`                                                                                                                           | module-card cleanup                                                              | —                      |
| 9   | Q&A `/commerce/qa/[id]`                                     | `answer-form`                                                                                                                            | module-card cleanup                                                              | —                      |
| 10  | Shipping `/commerce/shipping/zones/[id]` + `/profiles/[id]` | `new-rate-form` (add rate) + profile detail                                                                                              | inline add-row → standardize (collapsible / module-card)                         | —                      |
| 11  | Tax `/commerce/tax/zones/[id]`                              | `new-tax-rate-form` (add rate)                                                                                                           | inline add-row → standardize                                                     | —                      |
| 12  | Markup rules `/commerce/markup-rules`                       | `RuleForm` (expand-in-place)                                                                                                             | inline → overlay or module-card                                                  | —                      |
| 13  | Surcharges `/commerce/surcharges`                           | `RuleForm`                                                                                                                               | same move as markup rules                                                        | —                      |
| 14  | Fitment `/commerce/fitment`                                 | `fitment-reference-editor` add-rows                                                                                                      | standardize the add-forms                                                        | —                      |
| 15  | Providers `/commerce/providers/[id]`                        | `provider-actions-bar`                                                                                                                   | minor — confirm → `useConfirm`                                                   | —                      |
| 16  | Bulk pricing `/commerce/products/pricing`                   | `bulk-pricing-tool`                                                                                                                      | design call — page vs overlay                                                    | —                      |

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

### Platform gaps surfaced (fix once, on the primitive)

- ✅ **BUILT — Dirty-state guard for form surfaces.** `apps/dashboard/app/(dashboard)/_components/`
  `unsaved-guard.tsx` — `UnsavedGuardProvider` + `useRegisterLeaveGuard(guard)` (form side) +
  `useLeaveGuard()` (host side). The active form registers ONE guard (its dirty check + `useConfirm`
  discard dialog); every leave path routes through it: the frame-owned **Cancel** (the form's own
  `onCancel`), and the detail-panel host's **Close / Switch / backdrop-Esc** (`InlineDetailContent` +
  `ModalDetailContent` wrap their body in the provider; `DetailHeader` close/switch + the modal's
  `onOpenChange` await `runGuard()`). Embedded full-page has no host → the form's Cancel still self-guards.
  **Every subsequent edit surface adopts it by computing `dirty` + `useRegisterLeaveGuard`.** First
  adopter: Categories (2026-06-23). _Not covered: hard browser nav (`beforeunload`); switch-mode preserves
  edits — both deferred._
- **`SurfaceSummary` has no async/loading slot.** If summaries start loading related-record counts they
  need a skeleton/`loading` affordance. Not needed for Categories (derived client-side). _Surfaced: Categories (2026-06-23)._

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

- `commerce/products/[id]/new-variant-dialog.tsx` + `new-variant-form.tsx` (placeholder)
- `commerce/products/[id]/options-editor-dialog.tsx` (placeholder)
- `b2b/accounts/[id]/b2b-account-overrides-table.tsx` ("Add override" is disabled)

### Design calls (likely keep as-is — confirm intent before touching)

- `builder/**` bespoke editor surfaces (inspector, panels, palettes, brand/theme controls, framing/preview modals) — these are a visual editor, not CRUD.
- `automations/automation-editor.tsx` (full-page flow canvas), `email/broadcasts/broadcast-composer.tsx`,
  `marketplace/installs/[id]/update`, `scheduling/availability` editors — full-page may be the right surface; decide before migrating.

---

## Full inventory by module

> Rows marked ✅/➖ need no work and are included for completeness. The actionable rows are ⚙️ and 🔲.

### Commerce

| Path                                                                                                | Name                       | Kind                     | Current                | Status | Action                         |
| --------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------ | ---------------------- | ------ | ------------------------------ |
| `commerce/products/_components/product-wizard/index.tsx`                                            | Create product             | Create wizard            | overlay                | ✅     | done (F-layout + summary)      |
| `commerce/products/[id]/_components/product-edit-form.tsx`                                          | Edit product overview      | Edit/record form         | inline (detail tab)    | ✅     | standard detail tab            |
| `commerce/products/[id]/_components/product-media-panel.tsx`                                        | Product media              | Edit/record form         | inline (detail tab)    | ✅     | fine                           |
| `commerce/products/[id]/_components/fitment-panel.tsx`                                              | Product fitment            | Edit/record form         | inline (detail tab)    | ✅     | fine                           |
| `commerce/products/[id]/_components/inventory-panel.tsx`                                            | Inventory adjust / reorder | Inline page-body form    | inline (expand-in-row) | ⚙️     | consider drawer for adjust     |
| `commerce/products/[id]/_components/new-variant-dialog.tsx`                                         | Add variant (stub)         | Substantive dialog/modal | raw Modal              | 🔲     | build real form in modal       |
| `commerce/products/[id]/_components/new-variant-form.tsx`                                           | Add variant body           | Single-step create form  | inline                 | 🔲     | wire into the dialog           |
| `commerce/products/[id]/_components/options-editor-dialog.tsx`                                      | Options editor (stub)      | Substantive dialog/modal | raw Modal              | 🔲     | build real editor in modal     |
| `commerce/products/[id]/_components/product-status-bar.tsx`                                         | Publish / archive          | Action bar               | inline                 | ➖     | low-risk direct transitions    |
| `commerce/products/_components/bulk-price-adjust-modal.tsx`                                         | Bulk price adjust          | Bulk/action modal        | Modal                  | ✅     | fine                           |
| `commerce/products/_components/products-import-export.tsx`                                          | Products import            | Bulk/action modal        | ImportDialog           | ✅     | fine                           |
| `commerce/products/pricing/_components/bulk-pricing-tool.tsx`                                       | Bulk pricing tool          | Bulk/action modal        | full-page tool         | 🔲     | decide page vs overlay         |
| `commerce/categories/_components/category-create-form.tsx`                                          | New category               | Single-step create form  | overlay                | ✅     | surface-aware                  |
| `commerce/categories/_components/category-edit-form.tsx`                                            | Edit category              | Edit/record form         | overlay                | ✅     | fine                           |
| `commerce/categories/_components/categories-editor.tsx`                                             | Category tree              | (nav)                    | inline                 | ➖     | read-only tree                 |
| `commerce/collections/_components/collection-create-form.tsx`                                       | New collection             | Single-step create form  | overlay                | ✅     | surface-aware                  |
| `commerce/collections/[id]/_components/collection-meta-form.tsx`                                    | Edit collection meta       | Edit/record form         | inline (detail tab)    | ✅     | fine                           |
| `commerce/collections/[id]/_components/collection-membership-editor.tsx`                            | Collection membership      | Edit/record form         | inline (detail tab)    | ✅     | fine                           |
| `commerce/pricing/_components/price-list-create-form.tsx`                                           | New price list             | Single-step create form  | overlay                | ✅     | surface-aware                  |
| `commerce/pricing/[id]/_components/price-list-entries-editor.tsx`                                   | Price-list entries         | Edit/record form         | inline (detail tab)    | ✅     | appropriate                    |
| `commerce/pricing/[id]/_components/price-list-status-bar.tsx`                                       | Price-list archive         | Confirm                  | inline arm/confirm     | ✅     | done (useConfirm)              |
| `commerce/gift-cards/_components/issue-gift-card-form.tsx`                                          | Issue gift card            | Single-step create form  | overlay                | ✅     | surface-aware                  |
| `commerce/account-credit/_components/grant-account-credit-form.tsx`                                 | Grant account credit       | Single-step create form  | overlay                | ✅     | surface-aware                  |
| `commerce/markup-rules/_components/markup-rules-manager.tsx` (RuleForm)                             | Create/edit markup rule    | Edit/record form         | inline expand-in-place | 🔲     | move into overlay              |
| `commerce/surcharges/_components/surcharges-manager.tsx` (RuleForm)                                 | Create/edit surcharge rule | Edit/record form         | inline expand-in-place | 🔲     | move into overlay              |
| `commerce/bundles/_components/bundle-editor.tsx` + `bundles/new`                                    | Create/edit bundle         | Create/edit form         | full-page only         | 🔲     | surface + overlay              |
| `commerce/configurator/new/_components/new-template-form.tsx`                                       | New configurator template  | Single-step create form  | full-page only         | 🔲     | surface + overlay              |
| `commerce/configurator/[id]/_components/template-json-editor.tsx`                                   | Template JSON editor       | Edit/record form         | inline (detail tab)    | ✅     | fine                           |
| `commerce/discounts/new/page.tsx`                                                                   | New discount               | Single-step create form  | full-page only         | 🔲     | surface + overlay              |
| `commerce/discounts/_components/discounts-import-export.tsx`                                        | Discounts import           | Bulk/action modal        | ImportDialog           | ✅     | fine                           |
| `commerce/fitment/_components/fitment-reference-editor.tsx`                                         | Fitment reference add-rows | Inline page-body form    | inline (tree)          | 🔲     | standardize add-forms          |
| `commerce/providers/install/_components/install-provider-form.tsx`                                  | Install provider           | Single-step create form  | full-page only         | 🔲     | surface + overlay              |
| `commerce/providers/[id]/_components/provider-actions-bar.tsx`                                      | Provider enable/uninstall  | Confirm                  | inline                 | ➖     | `useConfirm`                   |
| `commerce/qa/[id]/_components/answer-form.tsx`                                                      | Post staff answer          | Edit/record form         | inline (detail)        | 🔲     | wrap in card/overlay           |
| `commerce/qa/[id]/_components/question-moderate-actions.tsx`                                        | Moderate question          | Confirm                  | inline                 | ➖     | `useConfirm`                   |
| `commerce/returns/[id]/_components/return-approval-form.tsx`                                        | Approve return             | Edit/record form         | inline (detail)        | 🔲     | standard card layout           |
| `commerce/returns/[id]/_components/return-inspection-form.tsx`                                      | Record inspection          | Edit/record form         | inline (detail)        | 🔲     | standard card layout           |
| `commerce/returns/[id]/_components/return-refund-form.tsx`                                          | Issue refund               | Edit/record form         | inline (detail)        | 🔲     | standard card layout           |
| `commerce/returns/[id]/_components/return-status-bar.tsx`                                           | Deny / mark received       | Confirm                  | Modal + reason field   | ✅     | done (Modal + required reason) |
| `commerce/reviews/[id]/_components/respond-form.tsx`                                                | Respond to review          | Edit/record form         | inline (detail)        | 🔲     | standard card layout           |
| `commerce/reviews/[id]/_components/moderate-actions.tsx`                                            | Moderate review            | Confirm                  | Modal + note field     | ✅     | done (Modal note + useConfirm) |
| `commerce/shipping/profiles/new/_components/new-profile-form.tsx`                                   | New shipping profile       | Single-step create form  | full-page only         | 🔲     | surface + overlay              |
| `commerce/shipping/zones/new/_components/new-zone-form.tsx`                                         | New shipping zone          | Single-step create form  | full-page only         | 🔲     | surface + overlay              |
| `commerce/shipping/zones/[id]/_components/new-rate-form.tsx`                                        | Add shipping rate          | Single-step create form  | inline (detail)        | 🔲     | overlay or collapsible         |
| `commerce/tax/zones/new/_components/new-tax-zone-form.tsx`                                          | New tax zone               | Single-step create form  | full-page only         | 🔲     | surface + overlay              |
| `commerce/tax/zones/[id]/_components/new-tax-rate-form.tsx`                                         | Add tax rate               | Single-step create form  | inline (detail)        | 🔲     | overlay or collapsible         |
| `commerce/subscriptions/[id]/_components/subscription-actions-bar.tsx`                              | Pause/skip/cancel          | Confirm                  | inline                 | ➖     | `useConfirm`                   |
| `commerce/settings/_components/site-settings-form.tsx`                                              | Commerce settings          | Settings form            | inline                 | ✅     | settings page                  |
| _delete buttons_ (`bundle`, `category`, `shipping profile/zone/rate`, `tax zone/rate`, `surcharge`) | Delete X                   | Confirm                  | inline                 | ➖     | `useConfirm`                   |

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

| Path                                                                                                | Name                        | Kind                    | Current            | Status | Action                               |
| --------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------- | ------------------ | ------ | ------------------------------------ |
| `cms/content/new/content-entry-wizard.tsx`                                                          | New content entry           | Create wizard           | overlay            | ✅     | F-layout (no summary needed)         |
| `cms/_components/page-create-form.tsx`                                                              | New page                    | Single-step create form | overlay            | ✅     | surface-aware                        |
| `cms/types/_components/content-type-create-form.tsx`                                                | New content type            | Single-step create form | overlay            | ✅     | surface-aware                        |
| `cms/authors/author-create-form.tsx`                                                                | New author                  | Single-step create form | overlay            | ✅     | surface-aware                        |
| `cms/taxonomy/taxonomy-create-form.tsx`                                                             | New taxonomy                | Single-step create form | overlay            | ✅     | surface-aware                        |
| `cms/redirects/_components/redirect-create-form.tsx`                                                | Add redirect                | Single-step create form | overlay            | ✅     | surface-aware                        |
| `cms/types/[typeKey]/new/new-entry-form.tsx`                                                        | New entry (type-scoped)     | Single-step create form | full-page only     | 🔲     | migrate or redirect to wizard        |
| `cms/[id]/edit-form.tsx`                                                                            | Edit page (autosave)        | Edit/record form        | full-page only     | 🔲     | overlay; delete → `useConfirm`       |
| `cms/authors/[id]/author-edit-form.tsx`                                                             | Edit author                 | Edit/record form        | full-page only     | 🔲     | overlay; delete → `useConfirm`       |
| `cms/media/[id]/edit-form.tsx`                                                                      | Edit asset                  | Edit/record form        | full-page only     | 🔲     | overlay                              |
| `cms/types/[typeKey]/[id]/edit-entry-form.tsx`                                                      | Edit content entry          | Edit/record form        | full-page only     | 🔲     | overlay; delete → `useConfirm`       |
| `cms/types/[typeKey]/schema/schema-editor.tsx`                                                      | Edit type schema            | Edit/record form        | full-page only     | 🔲     | deliberate (bespoke)                 |
| `cms/navigation/menu-editor.tsx`                                                                    | Menu editor                 | Edit/record form        | full-page only     | 🔲     | deliberate (tree)                    |
| `cms/taxonomy/[key]/terms-manager.tsx`                                                              | Terms manager               | Edit/record form        | full-page only     | 🔲     | extract `TermCreateForm`             |
| `cms/legal/consent-settings-form.tsx`                                                               | Cookie consent              | Settings form           | inline             | 🔲     | wrap in F-layout                     |
| `cms/_components/media-picker.tsx` / `reference-picker.tsx`                                         | Media / reference picker    | Picker dialog           | Modal              | ✅     | fine                                 |
| `cms/redirects/_components/import-redirects-button.tsx` / `cms/media/upload-button.tsx`             | Import / upload             | Bulk/action             | inline             | ✅     | fine                                 |
| `cms/[id]/revisions/restore-button.tsx`                                                             | Restore revision            | Confirm                 | useConfirm         | ✅     | done (useConfirm, warning tone)      |
| `cms/[id]/seo-panel.tsx` / `entry-template-picker.tsx`                                              | SEO panel / template picker | Edit/record form        | inline             | ✅     | fine                                 |
| `builder/**` (inspector, panels, palettes, brand/theme controls, framing/preview/merge-tags modals) | Builder editor surfaces     | Edit / dialog           | inline / Modal     | ✅     | bespoke editor — likely out of scope |
| `builder/_governance/components/allowlist-center.tsx`                                               | CSS allowlist editor        | Settings form           | inline             | 🔲     | wrap in F-layout                     |
| `builder/components/_components/new-component-button.tsx`                                           | New component               | Single-step create form | AlertDialog prompt | 🔲     | overlay single-step                  |
| `builder/components/_components/delete-component-button.tsx`                                        | Delete component            | Confirm                 | `useConfirm`       | ✅     | fine                                 |

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
