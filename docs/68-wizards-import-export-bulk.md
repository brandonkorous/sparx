# Sparx Platform — Wizards, Import/Export & Bulk Operations

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-09

---

## 1. Overview

Three related problems with a single throughline: the platform must handle complex data entry with minimum friction at every scale — one record at a time, hundreds at a time, or thousands.

**Wizards** address complexity: some objects have enough conditional structure (product options → variant matrix, B2B account → contacts + pricing tier + terms) that a flat form is the wrong shape. A wizard surfaces the right fields at the right moment, with enough context to make good decisions.

**Import/Export** addresses volume: a merchant migrating from another platform brings their catalog, customers, and inventory in a file. They should not hand-enter 400 SKUs.

**Bulk operations** address fleet management: once records exist, a merchant needs to change status, reprice, tag, or delete dozens at once without opening each one individually.

These three features complement the existing creation surface (drawer/overlay single-form) — they don't replace it. The decision tree for which path to use:

| Path                          | When to use                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------- |
| Single-form create (existing) | Simple objects: collection, segment, page, content entry                        |
| Wizard create (this doc)      | Complex objects: product with variants, B2B account, customer with full profile |
| CSV/file import               | Bulk initial load or migration from another platform                            |
| Bulk operations               | Mass updates across existing records (status, price, tags, delete)              |

---

## 2. When to use a wizard vs. a form

A wizard is justified when **two or more** of these conditions are true:

1. The object has a branching structure — the path through creation depends on an early choice (physical vs. digital product; prospect vs. B2B customer)
2. The object requires sub-entities created inline (product options define the variant matrix; a B2B account needs at least one contact)
3. There are 6+ fields and meaningful grouping improves comprehension
4. A user making a mistake early (wrong type, wrong option structure) would require them to rework many subsequent fields

Objects that meet the bar: **Product**, **B2B Account**, **Email campaign**.

Objects that don't (use a flat overlay form): Collection, Page, Content entry, Segment, Customer (basic), Warehouse, Price list.

---

## 3. Wizard UX principles

### Step structure

- Each step fits on one screen without scrolling (maximum ~4 fields + explanation copy)
- Step count displayed as a progress indicator: "Step 2 of 4" + named labels
- Every step validates before advancing — inline errors, no toast
- "Back" is always available; going back preserves entered data
- "Skip" is available only on genuinely optional steps — label it "Skip for now" not "Skip"
- No step is allowed to be a dead-end (no step ends without a Next/Finish/Skip affordance)

### Step header anatomy

```
[Stepper: ● ──── ○ ──── ○ ──── ○]  Step 2 of 4

H2: Step name                           [Cancel]
Muted subtext: one sentence explaining what this step does
and why it matters.
```

Cancel always exits and discards. No confirmation unless data was entered (use `useConfirm` with "Discard unsaved product?" if any field is non-empty).

### After completion

The wizard completes by creating the record in a single server action. On success:

- The wizard closes (or navigates away)
- The new record's detail view opens immediately (same surface — drawer/modal swaps token; page pushes route)
- A success toast fires: "Product created — configure media and SEO when ready."

The success toast message is contextual: it names the most commonly deferred task for that object type (media for products, payment terms for B2B accounts).

### Wizard surface

Wizards render in the same surface as the single-form create (drawer, modal, or full page), driven by `defaultDetailView`. On mobile, wizards always go full-screen.

---

## 4. Product wizard

**Trigger:** "New product" button on `/commerce/products` list or in the Products empty state.

**Steps: 4**

### Step 1 — Product basics

| Field        | Type      | Required | Notes                                          |
| ------------ | --------- | -------- | ---------------------------------------------- |
| Title        | text      | yes      | Auto-generates handle slug                     |
| Product type | select    | yes      | Physical / Digital / Service / Bundle          |
| Vendor       | text      | no       | Free text, auto-completes from existing values |
| Description  | rich text | no       | Can be added later                             |

The `Product type` choice gates subsequent steps. **Physical** shows the inventory + shipping steps. **Digital** skips shipping. **Service** skips both inventory and shipping. **Bundle** is not in wizard scope (bundle products are always created from the product detail view — they depend on other products existing first).

### Step 2 — Pricing & SKU

One default variant is always created. If the merchant wants to add options (color, size, etc.) they do that in the product detail view after creation — the wizard doesn't attempt to build a variant matrix. This is intentional: the variant matrix builder requires seeing the product already created.

| Field            | Type     | Required | Notes                                         |
| ---------------- | -------- | -------- | --------------------------------------------- |
| Price            | currency | yes      | Sets the default variant price                |
| Compare-at price | currency | no       | Shown as strikethrough on storefront          |
| Cost per item    | currency | no       | Used for margin calculation                   |
| SKU              | text     | no       | Unique per tenant; leave blank to auto-assign |
| Barcode          | text     | no       | UPC, EAN, ISBN                                |

### Step 3 — Inventory & shipping (Physical products only)

| Field             | Type           | Required    | Notes                                  |
| ----------------- | -------------- | ----------- | -------------------------------------- |
| Track inventory   | toggle         | yes         | Off = unlimited stock                  |
| Quantity          | integer        | if tracking | Default variant initial stock          |
| When out of stock | radio          | if tracking | Prevent / Allow backorders             |
| Weight            | decimal + unit | no          | Required for calculated shipping rates |
| Requires shipping | checkbox       | no          | Defaults on for Physical               |

### Step 4 — Organization & publish

| Field       | Type         | Required | Notes                          |
| ----------- | ------------ | -------- | ------------------------------ |
| Collections | multi-select | no       | Assign to existing collections |
| Tags        | tag-input    | no       | Comma-separated                |
| Status      | radio        | yes      | Draft (default) / Active       |

"Create product" button. Draft = saved but not published to storefront. Active = live immediately.

**Post-wizard:** toast says "Product created — add images and variants from the product page."

---

## 5. B2B Account wizard

**Trigger:** "New account" button on `/b2b/accounts` list.

**Steps: 4**

Requires the `b2b` module to be active. The wizard creates the account + at least one contact atomically. If the contact creation step is skipped, the account is created with zero contacts (valid — contacts can be added later from the account detail view).

### Step 1 — Account identity

| Field        | Type      | Required | Notes                                        |
| ------------ | --------- | -------- | -------------------------------------------- |
| Company name | text      | yes      |                                              |
| Account type | select    | yes      | Customer / Prospect / Distributor / Reseller |
| Website      | url       | no       |                                              |
| Industry     | select    | no       | 20 standard industry codes                   |
| Tags         | tag-input | no       |                                              |

### Step 2 — Primary contact

| Field              | Type     | Required | Notes                                   |
| ------------------ | -------- | -------- | --------------------------------------- |
| First name         | text     | no       |                                         |
| Last name          | text     | no       |                                         |
| Email              | email    | no       | Creates CRM customer record if provided |
| Phone              | tel      | no       |                                         |
| Job title          | text     | no       |                                         |
| Is billing contact | checkbox | no       |                                         |

Step header: "Who should we contact at this company?" Skip label: "Skip for now — add contacts from the account page."

When an email is provided, the system checks if a CRM customer already exists with that email. If so, a notice appears: "Brandon Korous is already a contact — we'll link them to this account." No duplicate is created.

### Step 3 — Pricing & terms

| Field         | Type     | Required | Notes                                              |
| ------------- | -------- | -------- | -------------------------------------------------- |
| Pricing tier  | select   | no       | Pulls from `b2b_pricing_tiers`                     |
| Payment terms | select   | no       | Net 15 / Net 30 / Net 60 / COD / Prepaid           |
| Credit limit  | currency | no       | Enforced at order creation if set                  |
| Tax exempt    | toggle   | no       | Requires exemption cert (attach in account detail) |

### Step 4 — Addresses

| Field            | Type           | Required | Notes                    |
| ---------------- | -------------- | -------- | ------------------------ |
| Billing address  | address fields | no       |                          |
| Shipping address | address fields | no       | Same as billing checkbox |

"Create account" button. Always creates as Active status (B2B accounts don't have a draft concept).

---

## 6. Customer wizard

The basic customer overlay form (already shipped) covers the most common case: add a prospect or retail customer quickly. The wizard path is invoked only when the user explicitly wants a **full profile** from the start.

**Trigger:** Dropdown on the "New customer" button: "Quick add" (existing overlay) | "Full profile" (wizard).

**Steps: 3**

### Step 1 — Identity & type

Same as the existing overlay form fields: type, name, email, phone, company, job title.

### Step 2 — Address & preferences

| Field                    | Type           | Required | Notes                     |
| ------------------------ | -------------- | -------- | ------------------------- |
| Default billing address  | address fields | no       |                           |
| Default shipping address | address fields | no       | Same as billing checkbox  |
| Preferred contact method | select         | no       | Email / Phone / SMS       |
| Do not contact           | toggle         | no       | Suppresses all outbound   |
| Marketing emails         | toggle         | no       | Defaults to on unless DNC |
| Language                 | select         | no       | For email template locale |

### Step 3 — Segments & notes

| Field         | Type         | Required | Notes                               |
| ------------- | ------------ | -------- | ----------------------------------- |
| Segments      | multi-select | no       | Assigns to existing manual segments |
| Tags          | tag-input    | no       |                                     |
| Internal note | textarea     | no       | First activity log entry            |

---

## 7. CMS Content wizard

**Trigger:** "New content" button anywhere in the CMS module — `/cms`, `/cms/posts`, `/cms/types/{typeKey}`. When triggered from a type-specific context (e.g. `/cms/posts`), Step 1 is skipped and the type is pre-selected.

**Steps: 3** (Step 1 conditionally skipped)

### Step 1 — Content type selection

Shown only when the user enters the wizard from a top-level context (not type-specific).

A grid of type cards, one per active content type in the tenant's schema:

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  📝 Blog Post   │  │  ❓ FAQ Entry    │  │  👤 Team Member  │
│                 │  │                 │  │                 │
│ Routable        │  │ Non-routable    │  │ Non-routable    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

Each card shows:

- Type icon (from the content type's configured icon, or a default doc icon)
- Type name
- "Routable" or "Non-routable" label (routable types generate a public URL; non-routable are data-only)
- Description (from the content type definition, if set)

Selecting a type advances immediately to Step 2 — no "Next" button needed on a pure selection step.

If the tenant has no content types defined yet, this step shows an empty state: "No content types yet — define your first content type in CMS → Content Types." with a link. The wizard cannot proceed without at least one type.

### Step 2 — Required fields

Renders only the fields from the selected content type's schema that are marked `required: true`. Optional fields are intentionally withheld — the goal is to get the record created with the minimum viable data and let the user fill the rest in the full entry editor.

The fields are rendered by `<SchemaFieldRenderer>`, a dynamic component that maps field type → the appropriate `@sparx/ui` input:

| Schema field type | Rendered as                                                                        |
| ----------------- | ---------------------------------------------------------------------------------- |
| `text`            | `<Input>`                                                                          |
| `textarea`        | `<Textarea>`                                                                       |
| `richtext`        | `<RichTextEditor>` (simplified toolbar — bold/italic/links only in wizard context) |
| `number`          | `<Input type="number">`                                                            |
| `boolean`         | `<Switch>`                                                                         |
| `select`          | `<Select>`                                                                         |
| `multiselect`     | `<MultiSelect>`                                                                    |
| `date`            | `<DatePicker>`                                                                     |
| `reference`       | `<RecordPicker>` (search + select an existing record)                              |
| `media`           | skipped in wizard — always deferred to entry editor                                |

If the content type has **no required fields**, this step is skipped entirely and the wizard goes straight to Step 3. The title field (present on all types) is always treated as required regardless of the schema definition.

Step header copy: "Fill in the required fields for this [Type Name]. Everything else can be added after you create the entry."

### Step 3 — Template & publish settings

| Field        | Type     | Required       | Shown when                                                                  |
| ------------ | -------- | -------------- | --------------------------------------------------------------------------- |
| Title        | text     | yes            | Always (if not already in Step 2 as a required schema field — deduplicated) |
| Slug         | text     | yes (routable) | Routable types only — auto-generated from title, editable                   |
| Template     | select   | no             | Routable types only — lists templates linked to this content type           |
| Status       | radio    | yes            | Always — Draft (default) / Published                                        |
| Publish date | datetime | no             | Only when Status = Published — defaults to now                              |

**Template selector behavior:** Shows only templates that have a first-class link to this content type (per docs/51 §4). If no templates are linked, the field is hidden entirely. If exactly one template is linked, it is pre-selected and the field is collapsed (shown as a read-only badge: "Template: Landing Page").

**Slug uniqueness:** Validated on blur (debounced `GET /v1/content/types/{typeKey}/check-slug?slug={slug}`). Duplicate slugs show an inline error and suggest a suffix: "This slug is taken — try `team-meeting-2`."

"Create entry" button. On success:

- Entry is created
- The wizard closes and the full entry editor opens immediately (same surface pattern as other wizards)
- Toast: "Entry created — add media and fill optional fields from the editor."

---

## 8. Import/Export

### Philosophy

- Import creates or updates records (upsert by natural key — SKU for products, email for customers)
- Export always gives exactly what the user filtered/selected on the current list view
- Errors in import rows don't abort the whole file — row-level errors are reported after the run
- No file is ever silently partially-applied: the user sees a row-by-row result

### Supported entities

| Entity                | Import                                | Export | Natural key for upsert |
| --------------------- | ------------------------------------- | ------ | ---------------------- |
| Products              | ✓                                     | ✓      | SKU                    |
| Product variants      | ✓ (as product rows with variant cols) | ✓      | SKU                    |
| Inventory adjustments | ✓                                     | ✓      | SKU + location         |
| Customers             | ✓                                     | ✓      | Email                  |
| B2B accounts          | ✓                                     | ✓      | Company name + domain  |
| Orders                | export only                           | ✓      | —                      |
| Discounts             | ✓                                     | ✓      | Code                   |

### File format

CSV, UTF-8, comma-separated, quoted string values. Excel `.xlsx` is accepted on upload and converted server-side (via `xlsx` package) — the download is always `.csv`.

Template CSV links appear on the import dialog: "Download template" pre-fills headers and one example row.

### Import flow

**Entry point:** "Import" button in list toolbar (appears alongside the "New X" button).

**Steps:**

1. **Upload** — drag-and-drop or file picker. File is validated on upload:
   - Column headers checked against the entity schema
   - Missing required columns → hard error before proceeding
   - Unknown columns → warning (will be ignored)
   - Row count shown: "47 rows found"

2. **Map columns** (shown only if headers don't match exactly — e.g., a Shopify export uses different column names)
   - Left: detected column names; Right: Sparx field selector
   - Auto-mapped where names match; manual for unrecognized columns
   - Required fields flagged red if unmapped

3. **Preview** — first 5 rows shown in a table with the mapped fields. Toggle: "Update existing records" (on = upsert by natural key; off = create only, skip if key exists).

4. **Import** — runs as a background job. The dialog closes immediately and a notification bar appears at the top of the page: "Import in progress — 47 rows". Clicking opens an import status drawer showing per-row results as they land.

5. **Results** — after completion: "44 imported, 2 updated, 1 error". The error row is shown with the specific failure reason. A "Download error report" link gives a CSV of just the failed rows with an `_error` column appended — the user fixes and re-imports just the failures.

### Export flow

**Entry point:** "Export" button in list toolbar, or via bulk-select → "Export selected".

Options shown in a small dropdown/popover:

- **Export all** — exports the full list with current filters applied
- **Export selected** — only checked rows (only shown when rows are selected)

Format is always CSV. Download begins immediately (no background job for reasonable sizes; large exports >10k rows use a background job + email notification).

**Export column set:** matches what's visible in the list view + all non-displayed but importable fields. A "Choose columns" option is deferred to Phase 2.

### Import API

`POST /v1/{entity}/import` — multipart form upload. Returns `{ jobId }`.
`GET /v1/{entity}/import/{jobId}` — job status + row-level results.

Import jobs are tenant-scoped, RLS-enforced. Jobs are retained 30 days then purged.

---

## 9. Bulk operations

### Selection model

Every list view with more than one record supports row selection via checkboxes. Selection state:

- **None selected:** Toolbar shows standard actions (New, Import, Export, filters)
- **1+ selected:** Bulk action bar slides up from the bottom of the viewport (not replacing the toolbar — both are visible)

The bulk action bar pattern:

```
[✓ 12 selected]  [Clear]  |  [Action 1]  [Action 2]  ...  [Delete]
```

Action buttons in the bulk bar are labeled, not icon-only. Destructive actions (Delete) are right-aligned and always behind a confirmation.

### Per-entity bulk actions

**Products:**

| Action                 | Confirmation required | Notes                                                                                             |
| ---------------------- | --------------------- | ------------------------------------------------------------------------------------------------- |
| Set status: Active     | no                    |                                                                                                   |
| Set status: Draft      | no                    |                                                                                                   |
| Set status: Archived   | no                    |                                                                                                   |
| Add to collection      | no                    | Multi-select collections in a popover                                                             |
| Remove from collection | no                    |                                                                                                   |
| Add tags               | no                    | Tag input in a popover                                                                            |
| Remove tags            | no                    | Tag input in a popover                                                                            |
| Adjust price (%)       | no                    | "Increase all by 10%" or "Decrease by 5%" — always shows a dry-run preview first                  |
| Delete                 | yes — useConfirm      | "Delete 12 products? This cannot be undone. Variants and inventory records will also be removed." |

**Customers:**

| Action              | Confirmation required | Notes                                  |
| ------------------- | --------------------- | -------------------------------------- |
| Add to segment      | no                    |                                        |
| Remove from segment | no                    |                                        |
| Add tags            | no                    |                                        |
| Set do-not-contact  | yes                   |                                        |
| Merge duplicate     | no (opens merge UI)   | Only available when exactly 2 selected |
| Export selected     | no                    |                                        |
| Delete              | yes                   |                                        |

**Orders:**

| Action              | Confirmation required | Notes                                                              |
| ------------------- | --------------------- | ------------------------------------------------------------------ |
| Mark as fulfilled   | no                    | Prompts for tracking number if single; bulk marks without tracking |
| Archive             | no                    |                                                                    |
| Print packing slips | no                    | Opens PDF in new tab                                               |
| Export selected     | no                    |                                                                    |

**B2B Accounts:**

| Action                        | Confirmation required | Notes |
| ----------------------------- | --------------------- | ----- |
| Set pricing tier              | no                    |       |
| Set payment terms             | no                    |       |
| Add tags                      | no                    |       |
| Set status: Active / Inactive | no                    |       |
| Delete                        | yes                   |       |

### Bulk price adjustment

Because incorrect price changes are hard to undo at scale, the price adjust action always shows a two-step preview:

1. Input: percentage change (increase or decrease) + rounding (to nearest $0.01 / $0.05 / $0.10 / $1.00)
2. Preview table: "12 products — before → after" showing current price and new price per product
3. "Apply" button — applies only after the user reviews the preview

This is not a wizard (it's a popover); it follows the bulk bar pattern. A "Revert" option appears in the bulk bar for 30 minutes after a bulk price change (stores pre-change prices on the job record and patches back).

### Bulk confirmation standard

All bulk destructive actions use `useConfirm` with:

- Target count: "Delete **12 products**?"
- Loss statement: what will be lost (variants, inventory, order history references)
- Action labels: confirm = "Delete 12 products" (red), cancel = "Cancel"

No bulk action silently does nothing on error — row-level errors surface in a toast: "11 updated, 1 failed — see details."

---

## 10. Implementation plan

### Phase 1 — Product wizard

Build the 4-step product wizard as the primary "New product" creation path. The existing product-create-form overlay becomes the "Quick add" fallback accessed via dropdown. Both paths result in the same server action (`createProduct`).

Files:

- `apps/app/src/app/(dashboard)/commerce/products/_components/product-wizard.tsx`
- `apps/app/src/app/(dashboard)/commerce/products/_components/product-wizard-steps/` (step-1.tsx through step-4.tsx)
- Reuse the existing `Stepper` from `@sparx/ui`

### Phase 2 — Import/Export (Products + Customers)

Start with the two highest-volume entities. Import as background job (Pub/Sub → Cloud Run worker); export as synchronous download for <5k rows, background + email for larger.

New service: `services/import-worker/` (Cloud Run, Pub/Sub push, subscribes to `import.job.created`).

Files:

- `apps/app/src/app/(dashboard)/_components/import-dialog.tsx` — shared dialog shell
- `apps/app/src/app/(dashboard)/_components/export-button.tsx` — shared export trigger
- `services/api-rest/src/routes/v1/products/import.ts`
- `services/api-rest/src/routes/v1/customers/import.ts`
- `services/import-worker/` — new Cloud Run worker (TF module `cloud-run-worker`)

### Phase 3 — Bulk operations (Products + Customers)

Bulk action bar as a shared `@sparx/ui` component, entity-specific action configs registered per list page.

Files:

- `packages/ui/src/components/data/bulk-action-bar.tsx`
- `apps/app/src/app/(dashboard)/commerce/products/_components/product-bulk-actions.tsx`
- `apps/app/src/app/(dashboard)/crm/customers/_components/customer-bulk-actions.tsx`

### Phase 4 — CMS Content wizard

Build the 3-step CMS content wizard (type selector → required schema fields → template + publish). The schema-driven `<SchemaFieldRenderer>` component is the key deliverable here — it's reusable across any future dynamic-field surface.

Files:

- `apps/app/src/app/(dashboard)/cms/_components/content-wizard.tsx`
- `apps/app/src/app/(dashboard)/cms/_components/content-wizard-steps/` (type-select.tsx, required-fields.tsx, template-publish.tsx)
- `packages/ui/src/components/form/schema-field-renderer.tsx` — shared dynamic field component

### Phase 5 — B2B Account + Customer full-profile wizards

Build the B2B account wizard (4 steps) and the customer full-profile wizard (3 steps). Depends on Phase 1 stepper pattern being established.

### Phase 6 — Remaining entities + Excel import

Add import/export for orders, inventory adjustments, B2B accounts, discounts. Add Excel `.xlsx` upload support. Add column chooser to export.

---

## 11. Cross-cutting rules

- **Wizard steps are never forms-within-forms.** Each step is a standalone controlled React component with its own `useForm` instance. State is lifted into the parent wizard and merged only on the final "Create" server action call.
- **No wizard step makes a network write until the final step.** Intermediate steps validate client-side only. This avoids partial records and simplifies rollback.
- **Import jobs are audited.** Every import job writes to `audit_logs` with actor, entity type, row count, success count, error count.
- **Export contains no PII that the tenant doesn't already own.** Exporting customers includes their email, name, and address — this is the tenant's own data. No cross-tenant data is ever included.
- **Bulk operations respect the same module guards as single-record operations.** If B2B module is inactive, the B2B account bulk actions are not rendered.
- **All imports are idempotent.** Re-importing the same file twice produces the same result as importing once (upsert by natural key, not append).
- **The CMS wizard never renders all schema fields — only required ones.** The full entry editor is the surface for optional fields. This keeps the wizard fast and prevents cognitive overload when a content type has 20+ fields.
- **`SchemaFieldRenderer` is the only place that maps schema field types to UI components.** Do not inline field-type → component logic anywhere else.
