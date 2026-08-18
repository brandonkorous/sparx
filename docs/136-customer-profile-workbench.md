# 136 — Customer Profile (workbench CRM): build + tracking

Version: 0.4
Author: Brandon Korous
Last Updated: 2026-07-24

> Living record of the CRM **customer detail → customer PROFILE** rebuild in
> [sparx/apps/workbench](../apps/workbench). Captures what we're building, where we
> are, and why, so the work survives a context compaction and anyone can pick it
> up. The surface is [surfaces/crm/customer-detail.tsx](../apps/workbench/surfaces/crm/customer-detail.tsx)
> and its sibling files.

## Why

The old customer detail was "a basic bitch form" — a single centred `max-w-3xl`
column of identical form cards floating in a wide empty pane, with the person's
identity and worth buried below the fold. The target (set by three real CRM
references — AgileCRM, LadiFlow, ecoManager) is a **read-first profile**: a
persistent identity rail on the left, a tabbed workspace on the right that opens
on a real Overview, with editing as one tab among many.

## Design decisions (the "why" that binds future edits)

- **Read-first profile, not an edit form.** The shell is a persistent **identity
  rail** (`IdentityRail`) + a `Tabs` workspace. The rail is the READ view of
  identity; the **Details** tab is the EDIT view. This is how the "identity shown
  once" rule is satisfied rather than fought — the name is display in the rail and
  editable only on Details (a distinct view), not a read-only heading stacked
  above the field it duplicates.
- **Two write models, deliberately split:**
  - **Draft + one Save (the Details tab):** name, contact, type, rep, account,
    tags. The shell owns the draft; the toolbar owns the single Save; a dirty dot
    on the Details tab carries scope. Mirrors `product-detail`'s tab-save model
    but simpler (only one tab edits, so state lives in the shell, no registry).
  - **Immediate writes (their own records):** addresses, documents, the profile
    photo, logged notes/activities. These are NOT in the Save draft — each commits
    on its own, because each is its own record with its own endpoint.
- **Actions live in the toolbar, not the profile card.** "New deal" / "New task"
  are toolbar buttons (icon-only on a narrow pane), opening the REAL editor
  pre-linked to this customer. We do **not** put action buttons on the rail.
- **Related tabs are lenses, not copies.** Orders/Deals/Tasks/Subscriptions are
  read-only lists whose rows open the real detail pane for that record. Creating
  is a pane (create == edit == pane), so there's one editor, never a second inline
  copy.
- **Only tabs backed by real per-customer data exist.** No empty tabs, no fake
  charts. See "Backend gaps" for what was deliberately NOT built.
- **Photo edits inline on the avatar** (click → upload → immediate commit), not in
  a form field.

## Tabs (current)

`Overview · Notes · Orders · Deals · Tasks · Subscriptions · Activity · Documents · Details`

Nine, matching the AgileCRM reference. **Open question:** consolidate if that's
too many.

- **Overview** — worth KPIs → store-credit tile (only if a balance) → open deals
  (with pipeline stage) → open tasks → recent orders → recent activity. Read-only.
- **Notes** — composer (note / call / meeting) + the human-authored entries only.
- **Orders / Deals / Tasks** — read-only lists → open the real record.
- **Subscriptions** — the customer's standing orders → open the subscription.
- **Activity** — the full read-only event stream (notes + every system event).
- **Documents** — upload (PDF/image) via the media pipeline, list, open, delete.
- **Details** — the edit form (one Save) + Addresses management + Remove customer.

## Status

Legend: ✅ done (code) · ⏳ needs the handoff below to run · ❌ not built (see gaps)

| Slice                                  | Status | Notes                                                             |
| -------------------------------------- | ------ | ----------------------------------------------------------------- |
| Two-column profile shell (rail + tabs) | ✅     | `EditorLayout`-style grid, `@3xl` collapse                        |
| Overview dashboard                     | ✅     | KPIs, open deals/tasks, recent orders/activity                    |
| Store-credit tile                      | ✅     | Reuses existing `…/account-credit/:id/ledger` — no backend change |
| Notes tab + composer                   | ✅     | `POST /v1/crm/activities` (already existed)                       |
| Activity tab (read-only)               | ✅     | New workbench hook over existing endpoint                         |
| Orders / Deals / Tasks tabs            | ✅     | `useOrders` gained a `customerId` filter                          |
| Subscriptions tab                      | ⏳     | Route gained `customer_id` param — **needs api-rest restart**     |
| Addresses add/edit/delete              | ⏳     | New PATCH/DELETE routes + service — **needs api-rest restart**    |
| New deal / task from toolbar           | ✅     | `ctx.params` preset seed in task/deal detail                      |
| Editable photo (inline on avatar)      | ⏳     | `avatarMediaAssetId` column — **needs migration + client regen**  |
| Documents tab                          | ⏳     | New table + routes — **needs migration + client regen + restart** |

## Backend changes

- **DB (author-only; through the pipeline):**
  - Migration [`20270115000000_customer_avatar`](../packages/db/prisma/migrations/20270115000000_customer_avatar/migration.sql)
    — `customers.avatar_media_asset_id` (nullable, soft ref to a MediaAsset, no FK).
  - Migration [`20270115000001_customer_documents`](../packages/db/prisma/migrations/20270115000001_customer_documents/migration.sql)
    — new `customer_documents` table + tenant RLS (`ENABLE`+`FORCE`+`tenant_isolation`;
    new empty table, so no backfill footgun).
  - Schema: [20-crm-customers.prisma](../packages/db/prisma/schema/20-crm-customers.prisma)
    — `Customer.avatarMediaAssetId`, `Customer.documents`, `CustomerDocument` model.
- **crm-schemas** [customers.ts](../packages/crm-schemas/src/customers.ts) —
  `avatarMediaAssetId` on `CreateCustomerInput`; `CreateCustomerDocumentInput`
  (new); `UpdateCustomerAddressInput` (already existed).
- **crm service** [customer-service.ts](../packages/crm/src/services/customer-service.ts)
  — write `avatarMediaAssetId` on create/update; `updateAddress`/`removeAddress`;
  `listDocuments`/`addDocument`/`removeDocument`.
- **api-rest** [customers.ts](../services/api-rest/src/routes/v1/crm/customers.ts)
  — address PATCH/DELETE; documents GET/POST/DELETE. Subscriptions `customer_id`
  filter in [providers.ts](../services/api-rest/src/routes/v1/commerce/providers.ts).

## Handoff — required before push / test (my constraints stop me here)

I author DB + dependent code as **files only** and never run
`prisma migrate`/`generate` against the shared stack, so:

1. **Regenerate the Prisma client** — `pnpm --filter @wizeworks/db exec prisma generate`.
   This alone clears the _only_ remaining typecheck/lint errors: 5 in
   `@wizeworks/crm` (`CustomerDocument` not in the client yet) + 1 `no-unsafe-assignment`
   in api-rest. They are expected regen artifacts, **not** logic errors.
2. **Verify no drift on the two hand-authored migrations** — run
   `prisma migrate dev` (or `migrate status`) locally against docker before the
   pipeline deploys. This is the one thing worth eyeballing in a hand-written SQL.
3. **Restart api-rest** — new routes across three features: address edit/delete,
   the subscriptions `customer_id` filter, and documents.

## Backend gaps — deliberately NOT built (don't re-attempt without backend)

- **Segments of a customer** — only the reverse (`/segments/:id/members`) exists.
  No per-customer segment endpoint.
- **Email compose-to-customer** — only segment broadcasts + event-driven
  `email.send`. No transactional "email this customer" route (`mailto:` is the
  only zero-backend option).
- **Gift-card issue write from the workbench** — MCP-only. (Granting _account
  credit_ does have `POST …/account-credit/grant`; issuing gift cards does not.)
- **Office docs (docx/xlsx)** — the media upload allowlist is PDF + images + A/V
  only. Documents currently accepts PDF + images.

## New / changed files (workbench)

- Shell: [customer-detail.tsx](../apps/workbench/surfaces/crm/customer-detail.tsx)
- [customer-overview.tsx](../apps/workbench/surfaces/crm/customer-overview.tsx)
- [customer-related.tsx](../apps/workbench/surfaces/crm/customer-related.tsx) (Orders/Deals/Tasks/Subscriptions/Notes/Activity)
- [customer-addresses.tsx](../apps/workbench/surfaces/crm/customer-addresses.tsx)
- [customer-documents-tab.tsx](../apps/workbench/surfaces/crm/customer-documents-tab.tsx)
- [customer-activity-data.ts](../apps/workbench/surfaces/crm/customer-activity-data.ts)
- Data layer: [customers-data.ts](../apps/workbench/surfaces/crm/customers-data.ts) (address + document mutations, avatar field, presentation helpers)
- Presets: [task-detail.tsx](../apps/workbench/surfaces/crm/task-detail.tsx), [deal-detail.tsx](../apps/workbench/surfaces/crm/deal-detail.tsx)
- Reused: `MediaField` / `useUploadMedia` / `useMediaAssets` from commerce.

## Customer classification → the three-axis model (0.4)

**The full model now lives in its own doc: [137-customer-classification-model.md](137-customer-classification-model.md).**
Read that for the axes, values, migration mapping, and load-bearing moves. Short history of how it
got there, since it happened on this surface:

- **0.3 — richer single dropdown.** "Kind of customer = prospect / retail / wholesale" was
  commerce-centric, so the one `type` dropdown was widened to a loyalty ladder
  (prospect / customer / regular / vip / wholesale). Better, but still one field doing several jobs.
- **0.4 — split into three orthogonal fields** (HubSpot's model, after research): **lifecycle
  stage** (where they are), **lead status** (what a rep is doing now), and **relationship type**
  (how they buy — the load-bearing `type`, now `retail · b2b · partner · vendor`). `prospect`
  became a lifecycle stage; `regular`/`vip` had no home on any axis and are **preserved as tags** by
  the migration. The customer form gained three controls; the rail/list badge leads with lifecycle
  stage. See docs/137.

**Also removed (0.3):** an over-built per-tenant _audience noun_ rename system (a
`tenants.settings.audienceNoun` key, `GET`/`PATCH /v1/tenant/audience`, an
`sparx/apps/workbench/lib/audience.ts` resolver, a "Your audience" setting) — far more than the ask; the
CRM says "Customers" everywhere.

## Open decisions / next

- Tab count (9) — keep or consolidate?
- Whether the photo remove should also offer "pick from library" (currently
  upload-only inline; the library picker still exists via `MediaField` elsewhere).
- Next candidate slices if wanted: gift-card/credit **write** actions (need a new
  api-rest write route), a "send email" action, quotes-via-`b2bAccountId`.
