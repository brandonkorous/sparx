# Default Email Templates & Per-Site Email

**Version:** 1.1 (13 trees BUILT as `DEFAULT_EMAIL_TEMPLATES`; division confirmed — 4 nodes + resolver + `*Url` + compliance gate are the automation module's; final node JSON pending the reference template)
**Author:** Brandon Korous
**Last Updated:** 2026-06-12

> **Scope.** Two coupled bodies of work:
>
> 1. **The 13 default email templates** — the starter transactional + marketing
>    emails every tenant gets on email-module activation, as **Builder-authored
>    node-trees** (tenant-owned, fully editable), not coded React Email components.
>    This settles the email-defaults question in favour of Builder-authored trees.
> 2. **Per-site email** (docs/49 Phase 7b tail) — `property_id` on `BuilderEmail`,
>    `/builder/email` authoring scoped per-site, and built-in **overrides** that
>    resolve `(tenant, property, key)` → `(tenant, key)` so a site can fork a
>    default without affecting its siblings.
>
> The two are **one system**: the 13 defaults are provisioned tenant-wide
> (`property_id = null`); a site overrides one by forking it to a per-site row with
> the same `key`. There is no third parallel system — this reconciles the existing
> coded `DEFAULT_AUTOMATIONS` (§7).

---

## 0. Coordination boundary (read first)

This work spans two agents. The split is firm:

**Division confirmed 2026-06-12** (the automation agent's Q1/Q2): all four node
types, the resolver/`DataSource` + every `*Url` token, and the compliance gate are
the automation module's; this doc owns the trees' content/structure, the per-site
email model, provisioning, and the reconciliation. The agent builds **zero** trees;
this side builds **zero** node types and **zero** resolver.

| Owned by the **automation module**                                                                                                                          | Owned **here** (this doc)                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| All **four** node types — `line_item_table`, `conditional_block`, `unsubscribe_link`, `physical_address` — defined + rendered + gate-checked (their Step 2) | The **content + structure** of all 13 templates (§4) — final; trees authored now (`DEFAULT_EMAIL_TEMPLATES`) |
| The **reference template** (`invoicing-overdue`) + the exact node-JSON shapes, handed over when Step 2 lands                                                | The **per-site email model**: `BuilderEmail.property_id` + `key`, override resolution (§6)                   |
| The **merge-field resolver / `DataSource`** (§3) + every `*Url` token (incl. the new `order.reviewUrl`), resolved at dispatch                               | **Provisioning** the 13 defaults on email activation + the `DEFAULT_AUTOMATIONS` reconciliation (§7)         |
| The **compliance gate** (their Step 4) — checks for the `unsubscribe_link` node it owns                                                                     | **Placing** `unsubscribe_link` + `physical_address` in the 3 marketing trees so they pass the gate           |

**Sequencing.** The 13 trees are **authored now** (§4 / `DEFAULT_EMAIL_TEMPLATES`),
against the published field vocabulary + node palette — the four new node types are
placed with **provisional** `props`/`binding`, finalized against the
`invoicing-overdue` reference template when Step 2 lands. The `BuilderEmail` _table_
change (§6) is **mine alone** — the automation agent's node work lives in
`@sparx/builder-schemas`' node registry + `renderEmailTree`, not the `BuilderEmail`
Prisma model — so there is **no shared-table collision**; §6/§7 are unblocked and
sequence only behind the node-JSON finalization (so provisioned trees ship final).

**Current-state map** (verified 2026-06-12): `BuilderEmail`
([packages/db/prisma/schema/51-builder.prisma](../packages/db/prisma/schema/51-builder.prisma))
has no `property_id` and no `key`; `emailService.getPublishedById`
([packages/builder/src/services/email-service.ts](../packages/builder/src/services/email-service.ts))
looks up by id only; `resolveEmailData`
([services/api-rest/src/lib/email-data.ts](../services/api-rest/src/lib/email-data.ts))
exposes `recipient/order/cart/loyalty/commerce.product/promotion/cms.*` as **labels**
and is missing `quote`/`invoice`/`b2bAccount` and every `*Url` token; the email node
registry ([packages/email/src/builder/render-email-tree.tsx](../packages/email/src/builder/render-email-tree.tsx))
has `Heading/Text/Prose/Button/Image/ImageDisplay/Divider` + `Section/Stack/Grid/Card`
but **no** `line_item_table`, `conditional_block`, unsubscribe, or address node;
provisioning seeds only `EmailAutomation` rows, never Builder email trees; the
compliance gate is greenfield.

---

## 1. Why Builder-authored, not coded

Coded templates (the `@sparx/email` `TemplateSend` union) cannot be edited by a
tenant, can't render a working CTA without bespoke prop plumbing, and don't carry a
per-site identity. The default emails become **Builder node-trees** so that:

- A tenant **edits** every default in `/builder/email` — copy, layout, colours —
  with no deploy.
- CTAs **work**: `*Url` tokens (`recoveryUrl`, `payUrl`, `reviewUrl`, `portalUrl`)
  resolve at dispatch (§3), fixing the old "coded templates can't render a working
  link" problem.
- A **site** overrides any default with its own version (§6), branded as that site
  (per-site brand merge already lands via docs/49 Phase 7a `resolveEmailBrand`).
- One substrate: the same render path (`renderEmailTree`), the same authoring
  surface, the same per-recipient deferred render the email Builder already uses
  (docs/52 §6).

---

## 2. Shared authoring rules

These bind every template (and every tenant edit):

- **Brand chrome is automatic.** Every tree renders inside `EmailLayout` — logo,
  colours, fonts, footer resolve from the tenant's (or the active site's) brand at
  dispatch via `resolveEmailBrand`. **Never hardcode brand.**
- **Plain-text is auto-generated** (`render({ plainText: true })`). Never hand-write
  a text body.
- **Compliance (marketing).** A **marketing** template MUST include an
  `unsubscribe_link` node and the `physical_address` node — the compliance gate
  (§8) refuses to send a marketing email whose tree lacks an unsubscribe node. A
  **transactional** template MUST NOT include unsubscribe.
- **Functional, not beautiful.** Tenant-owned and fully editable once provisioned;
  the default is a clean, working starting point, not a showpiece.
- **Merge syntax:** `{{source.field}}`, optional fallback `{{customer.firstName ?? "there"}}`.

---

## 3. Merge-field vocabulary (the resolver contract)

This is the contract the resolver / `DataSource` (automation-module-owned) exposes.
Listed here so the templates (§4) bind real fields, and so the resolver gap is
explicit. **Current** = state of `resolveEmailData` today; the resolver must reach
**Target** before the templates render correctly.

| DataSource             | Scalar fields                                                  | Collection (for `line_item_table`)                            | Current resolver state                                                                |
| ---------------------- | -------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `customer`             | `firstName lastName fullName email company`                    | —                                                             | partial — `firstName/lastName/email` only (no `fullName`, `company`)                  |
| `tenant`               | `name storeUrl supportEmail`                                   | —                                                             | missing — `storeUrl` derived per-send; no `name`/`supportEmail` source                |
| `order`                | `number total subtotal status placedAt reviewUrl`              | `order.items[]`: `name quantity unitPrice lineTotal`          | partial — labels only (`statusLabel`/`totalLabel`); no raw values, no `items[]`       |
| `cart`                 | `total itemCount recoveryUrl`                                  | `cart.items[]`: `name quantity unitPrice lineTotal`           | partial — `items[]` (title/priceLabel/imageUrl); no `total`/`itemCount`/`recoveryUrl` |
| `quote`                | `number total status validUntil reviewUrl`                     | `quote.items[]`: `name quantity unitPrice lineTotal`          | **missing**                                                                           |
| `invoice` (billingDoc) | `number total balance dueDate daysUntilDue overdueDays payUrl` | `invoice.items[]`: `description quantity unitPrice lineTotal` | **missing**                                                                           |
| `b2bAccount`           | `companyName paymentTerms creditLimit status portalUrl`        | —                                                             | **missing**                                                                           |

Every `*Url` token (`storeUrl`, `recoveryUrl`, `payUrl`, `reviewUrl`, `portalUrl`)
is owned by the automation module and resolved to a **real working link at
dispatch** — use them freely; that's what makes the CTAs work.

> **Resolved (2026-06-12):** `order.reviewUrl` is **in the vocabulary** — the
> resolver maps it to the first purchased product's PDP (`{storeUrl}/products/{handle}`,
> where the review UI lives), falling back to `storeUrl` only when the order has no
> resolvable product. So template #4's CTA uses `{{order.reviewUrl}}` directly (no
> storeUrl fallback in the tree).

---

## 4. The 13 templates

Each block list is the **structure**; the quoted strings are the **final functional
copy** (tenant-editable). `[line_item_table]` and `[conditional_block]` reference the
automation agent's new nodes; `[unsubscribe + address]` is the compliance pair (§8).
Subjects/preheaders carry merge tokens.

### 1. `welcome-customer` · transactional · _welcome_

- **Sources:** `customer`, `tenant` · **refs:** `customerId`
- **Subject:** `Welcome to {{tenant.name}}` · **Preheader:** `Thanks for joining — here's what's next.`
- heading: "Welcome to {{tenant.name}}"
- paragraph: "Hi {{customer.firstName ?? "there"}} — thanks for creating an account. You're all set: browse the latest, track your orders, and check out faster every time."
- button: "Start shopping" → `{{tenant.storeUrl}}`

### 2. `win-back` · marketing · _win-back_

- **Sources:** `customer`, `tenant` · **refs:** `customerId`
- **Subject:** `We miss you, {{customer.firstName ?? "friend"}}` · **Preheader:** `Come back and see what's new.`
- heading: "It's been a while"
- paragraph: "We haven't seen you at {{tenant.name}} in a bit, {{customer.firstName ?? "there"}}. There's plenty new since your last visit — come take a look."
- button: "See what's new" → `{{tenant.storeUrl}}`
- [unsubscribe + address]

### 3. `abandoned-cart` · marketing · _cart-recovery_

- **Sources:** `customer`, `cart`, `tenant` · **refs:** `customerId`, `cartId`
- **Subject:** `You left something behind` · **Preheader:** `Your cart is still here.`
- heading: "Still thinking it over?"
- paragraph: "Your cart is saved and ready whenever you are. Here's what you left at {{tenant.name}}:"
- [line_item_table] `cart.items`
- text (total): "Total: {{cart.total}}"
- button: "Complete your order" → `{{cart.recoveryUrl}}`
- [unsubscribe + address]

### 4. `post-purchase-review` · marketing · _review_

- **Sources:** `customer`, `order`, `tenant` · **refs:** `customerId`, `orderId`
- **Subject:** `How did we do?` · **Preheader:** `Tell us about order {{order.number}}.`
- heading: "How was your order?"
- paragraph: "Thanks for shopping with {{tenant.name}}, {{customer.firstName ?? "there"}}. We'd love to hear what you thought of order {{order.number}}:"
- [line_item_table] `order.items`
- button: "Leave a review" → `{{order.reviewUrl}}` _(resolver maps it to the first product's PDP — see §3)_
- [unsubscribe + address]

### 5. `b2b-account-approved` · transactional · _notification_

- **Sources:** `customer`, `b2bAccount`, `tenant` · **refs:** `customerId`, `b2bAccountId`
- **Subject:** `Your account is approved` · **Preheader:** `{{b2bAccount.companyName}} is ready to order.`
- heading: "You're approved"
- paragraph: "Good news — {{b2bAccount.companyName}} has been approved for a wholesale account with {{tenant.name}}. You can sign in and order at your account pricing now."
- [conditional_block] _if `b2bAccount.creditLimit` set_ → text: "Your credit line is {{b2bAccount.creditLimit}} on {{b2bAccount.paymentTerms}} terms."
- button: "Go to your portal" → `{{b2bAccount.portalUrl}}`

### 6. `b2b-quote-received` · transactional · _notification_

- **Sources:** `customer`, `quote`, `tenant` · **refs:** `customerId`, `quoteId`
- **Subject:** `Quote received — {{quote.number}}` · **Preheader:** `Here are your quote details.`
- heading: "Your quote is ready"
- paragraph: "Here are the details for quote {{quote.number}}:"
- [line_item_table] `quote.items`
- text (total): "Total: {{quote.total}}"
- [conditional_block] _if `quote.validUntil` set_ → text: "Valid until {{quote.validUntil}}."
- button: "Review & approve" → `{{quote.reviewUrl}}`

### 7. `b2b-invoice-due` · transactional · _invoice_

- **Sources:** `customer`, `invoice`, `tenant` · **refs:** `customerId`, `billingDocumentId`
- **Subject:** `Invoice due in {{invoice.daysUntilDue}} days` · **Preheader:** `Invoice {{invoice.number}} — {{invoice.balance}} due.`
- heading: "Invoice {{invoice.number}}"
- paragraph: "A reminder that invoice {{invoice.number}} is due in {{invoice.daysUntilDue}} days."
- text (amount): "Amount due: {{invoice.balance}} · Due {{invoice.dueDate}}"
- button: "Pay now" → `{{invoice.payUrl}}`

### 8. `b2b-quote-expiring` · transactional · _notification_

- **Sources:** `customer`, `quote`, `tenant` · **refs:** `customerId`, `quoteId`
- **Subject:** `Your quote expires in 48 hours` · **Preheader:** `Quote {{quote.number}} expires soon.`
- heading: "Your quote expires soon"
- paragraph: "Heads-up — quote {{quote.number}} expires on {{quote.validUntil}}. Approve it before then to lock in your pricing."
- text: "Total: {{quote.total}} · Expires {{quote.validUntil}}"
- button: "Approve now" → `{{quote.reviewUrl}}`

### 9. `invoicing-reminder` · transactional · _invoice_

- **Sources:** `customer`, `invoice`, `tenant` · **refs:** `customerId`, `billingDocumentId`
- **Subject:** `Friendly reminder — {{invoice.number}} due {{invoice.dueDate}}` · **Preheader:** `{{invoice.balance}} due {{invoice.dueDate}}.`
- heading: "A quick reminder"
- paragraph: "Just a friendly reminder that invoice {{invoice.number}} is due on {{invoice.dueDate}}. Here's a summary:"
- [line_item_table] `invoice.items`
- text: "Balance due: {{invoice.balance}} · Due {{invoice.dueDate}}"
- button: "Pay invoice" → `{{invoice.payUrl}}`

### 10. `invoicing-overdue` · transactional · _dunning_

- **Sources:** `customer`, `invoice`, `tenant` · **refs:** `customerId`, `billingDocumentId`
- **Subject:** `Invoice {{invoice.number}} is overdue` · **Preheader:** `{{invoice.balance}} is past due.`
- heading: "Your invoice is past due"
- paragraph: "Invoice {{invoice.number}} was due on {{invoice.dueDate}} and is now {{invoice.overdueDays}} days overdue. Please submit payment at your earliest convenience."
- text: "Amount due: {{invoice.balance}} · {{invoice.overdueDays}} days overdue"
- button: "Pay now" → `{{invoice.payUrl}}`

### 11. `invoicing-overdue-2` · transactional · _dunning_ (second notice)

- **Sources / refs:** same as #10.
- **Subject:** `Second notice — {{invoice.number}}` · **Preheader:** `{{invoice.balance}} remains unpaid.`
- heading: "Second notice"
- paragraph: "Our records show invoice {{invoice.number}} remains unpaid and is now {{invoice.overdueDays}} days overdue. Please arrange payment to keep your account in good standing."
- text: "Amount due: {{invoice.balance}} · {{invoice.overdueDays}} days overdue"
- button: "Pay now" → `{{invoice.payUrl}}`

### 12. `invoicing-overdue-final` · transactional · _dunning_ (final notice)

- **Sources / refs:** same as #10.
- **Subject:** `Final notice — {{invoice.number}}` · **Preheader:** `Immediate action required.`
- heading: "Final notice"
- paragraph: "Invoice {{invoice.number}} is now {{invoice.overdueDays}} days overdue and requires immediate attention. This is the final reminder before your account is escalated."
- text: "Amount due: {{invoice.balance}} · {{invoice.overdueDays}} days overdue"
- [conditional_block] consequences-if-unpaid → text: "If payment isn't received, your account may be placed on credit hold and outstanding orders paused."
- button: "Pay now" → `{{invoice.payUrl}}`

### 13. `chat-satisfaction` · transactional · _survey_

- **Sources:** `customer`, `tenant` · **refs:** `customerId`
- **Subject:** `How was your experience?` · **Preheader:** `Tell us how we did.`
- heading: "How did we do?"
- paragraph: "Thanks for chatting with {{tenant.name}}, {{customer.firstName ?? "there"}}. We'd love a quick word on how the conversation went."
- button: "Rate your chat" → `{{tenant.storeUrl}}` _(or a dedicated survey URL when one exists)_

---

## 5. Node-type dependency

Existing nodes cover most blocks: `Heading`, `Text` (paragraphs + amount lines),
`Button` (CTAs), `Section`/`Stack` (layout) — all rendered today. The trees
(`DEFAULT_EMAIL_TEMPLATES`) **place** four new node types that the automation module
owns end-to-end (defines in the node registry, renders in `renderEmailTree`,
gate-checks):

| Block            | Node `type`         | Bound to / purpose                                     |
| ---------------- | ------------------- | ------------------------------------------------------ |
| line item tables | `line_item_table`   | binds `order/cart/quote/invoice.items`                 |
| conditional copy | `conditional_block` | `props.when` — credit line, quote expiry, dunning copy |
| unsubscribe link | `unsubscribe_link`  | marketing-only; feeds `List-Unsubscribe` at dispatch   |
| physical address | `physical_address`  | renders `EmailSettings.physicalAddress`                |

The trees author these **now** with provisional `props`/`binding` (the `node()`
helpers `lineItems`/`conditional`/`unsubscribeLink`/`physicalAddress` in
`default-emails.ts`); the renderer returns `null` for an unknown `type` until the
module ships it, so the existing-node content renders cleanly in the meantime. The
exact `props` JSON is finalized in one place (those four helpers) against the
`invoicing-overdue` reference template.

---

## 6. Per-site email model (docs/49 Phase 7b)

### Schema (`BuilderEmail`)

Two additive columns + the partial uniques (hand-SQL, per the db-migration skill):

```
property_id  UUID NULL  FK → properties(id) ON DELETE SET NULL   -- null = tenant-wide
key          VARCHAR NULL                                        -- built-in key (one of the 13); null = custom author email
```

Uniqueness (two partial indexes — a tenant has at most one tenant-wide built-in per
key, and at most one per-site override per key; custom emails, `key IS NULL`, are
unconstrained):

```sql
CREATE UNIQUE INDEX builder_emails_tenant_key_default
  ON "builder_emails" ("tenant_id", "key")
  WHERE "key" IS NOT NULL AND "property_id" IS NULL;

CREATE UNIQUE INDEX builder_emails_tenant_property_key
  ON "builder_emails" ("tenant_id", "property_id", "key")
  WHERE "key" IS NOT NULL AND "property_id" IS NOT NULL;
```

`builder_emails` is tenant-scoped + RLS-enforced already; `property_id` is
application-tier scoping, not a security boundary (docs/49 §2). The FK is `SET NULL`
so a deleted site's overrides fall back to the tenant-wide default rather than
vanishing mid-flight.

### Resolution — `(tenant, property, key)` → `(tenant, key)`

A new `emailService.getPublishedByKey(ctx, key, propertyId?)`:

1. If `propertyId` and a **published** `(tenant, propertyId, key)` row exists → use it.
2. Else the **published** `(tenant, null, key)` tenant-wide default.
3. Else null (the send falls back to the coded template / is skipped, per dispatch).

The dispatch tick already carries `ScheduledSend.property_id` (Phase 7a); a built-in
send resolves its tree by `key` + that property, so an automation firing on behalf of
a site renders the site's override when one exists, the tenant default otherwise —
both branded as the site (Phase 7a `resolveEmailBrand`).

### Authoring scope

`/builder/email` already lists/【edits】a tenant's emails. Per-site: the list is
scoped to the **active site** (the `x-sparx-property-id` switcher) showing the
tenant-wide defaults plus that site's overrides; a default exposes **"Customize for
this site"** which forks the published tree into a new `(tenant, property, key)` row
the site then edits independently. This mirrors the content-type fork-on-edit pattern
(docs/51). `emailService` methods gain an optional `propertyId`/`PropertyContext`,
exactly as the sitebuilder services did in docs/49 Phase 6a.

---

## 7. Provisioning & `DEFAULT_AUTOMATIONS` reconciliation

**Provisioning.** On `module.activated` (`email`), in addition to seeding
`EmailAutomation` rows, provision the 13 defaults as **published tenant-wide**
`BuilderEmail` rows (`property_id = null`, `key` set, the materialized node tree).
Idempotent (the partial unique on `(tenant, key)` makes re-provision a no-op). This
is the missing half today — activation currently seeds only automation rows.

**Reconciliation (no third system).** The coded `DEFAULT_AUTOMATIONS` keep their
trigger wiring but **point at a provisioned `BuilderEmail` by `key`** instead of a
coded `templateKey`; dispatch resolves the tree via `getPublishedByKey` (§6) with the
per-site fallback. Mapping of the existing 10 automations to the 13 templates:

| Automation (`key` → `triggerEvent`)                                       | Template (`key`)                                                                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `welcome-customer` → `crm.customer.created`                               | `welcome-customer`                                                                                                    |
| `win-back` → `crm.customer.inactive`                                      | `win-back`                                                                                                            |
| `cart-abandoned` → `cart.abandoned`                                       | `abandoned-cart`                                                                                                      |
| `b2b-account-approved` → `crm.b2b.account.approved`                       | `b2b-account-approved`                                                                                                |
| `quote-received` → `crm.quote.created`                                    | `b2b-quote-received`                                                                                                  |
| `invoice-due` → `crm.invoice.due`                                         | `b2b-invoice-due` / `invoicing-reminder`                                                                              |
| `invoice-overdue` → `crm.invoice.overdue`                                 | `invoicing-overdue` (+ `-2`/`-final` via a dunning sequence)                                                          |
| `order-confirmed/-shipped/-delivered`                                     | _existing coded `order-confirmation`/`shipping-confirmation` — not in this set; convert in a follow-on or keep coded_ |
| _(new)_ `post-purchase-review`, `b2b-quote-expiring`, `chat-satisfaction` | new triggers — automation agent wires                                                                                 |

> The automation→email wiring + the `DEFAULT_AUTOMATIONS` migration itself is the
> automation module's (docs/81, docs/84, docs/90-ADR-automation-migration). This doc
> owns the **template side** of that contract (the 13 keyed trees + the per-site
> resolution). The dunning escalation (`-2`, `-final`) is an automation **sequence**
> on the overdue trigger — its scheduling is the automation engine's.

---

## 8. Compliance gate (CAN-SPAM) — automation module's (their Step 4)

The gate is **owned by the automation module** (it checks for the `unsubscribe_link`
node it defines). Recorded here for the template side. Three pieces:

1. **Template rule (send-time gate).** A **marketing** send (scope `marketing`)
   whose published tree contains no `unsubscribe_link` node is **refused** (a clear
   error, recorded on the send) — you cannot send marketing mail without an
   unsubscribe. A **transactional** send must not contain one.
2. **`unsubscribe_link` + `physical_address` nodes** (their node registry +
   renderer). The unsubscribe node renders a working one-click link (and feeds the
   `List-Unsubscribe` header); the address node renders `EmailSettings.physicalAddress`
   ([packages/db/prisma/schema/50-email.prisma](../packages/db/prisma/schema/50-email.prisma)).
3. **`List-Unsubscribe` header** for marketing sends, pairing with the existing
   Mailgun `unsubscribed` → `EmailSuppression` webhook path.

**The template side (mine) is satisfied by construction:** the 3 marketing templates
(`win-back`, `abandoned-cart`, `post-purchase-review`) each place an `unsubscribe_link`

- `physical_address` node; the 10 transactional ones carry neither. The
  `default-emails.test.ts` asserts exactly this, so the trees pass the gate the moment
  it lands.

---

## 9. Build sequence

| Step | Work                                                                                                       | Owner / blocked on                             |
| ---- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1 ✅ | All 13 trees authored — `DEFAULT_EMAIL_TEMPLATES` in `@sparx/builder-schemas` (`default-emails.ts` + test) | mine — **done**                                |
| 2    | Resolver/`DataSource` reaches the §3 vocabulary (`quote`/`invoice`/`b2bAccount` + every `*Url`)            | automation module                              |
| 3    | The 4 node types + the `invoicing-overdue` reference template + exact node-JSON shapes                     | automation module                              |
| 4    | `BuilderEmail.property_id` + `key` migration (§6) + partial uniques                                        | mine — **unblocked** (no shared table, see §0) |
| 5    | `emailService.getPublishedByKey` + per-site authoring scope + "Customize for this site"                    | mine — after step 4                            |
| 6    | Finalize the 4 provisional node shapes against the reference template + provision on activation (§7)       | mine — after step 3                            |
| 7    | Wire `DEFAULT_AUTOMATIONS` to the provisioned trees by `key` (§7)                                          | automation module (engine) + mine (templates)  |

Step 1 is done. Steps 4–5 (the per-site `BuilderEmail` table + authoring) are mine
and **need nothing from the hand-off** — the automation module's node work lives in
the node registry + `renderEmailTree`, not the `BuilderEmail` Prisma model, so there's
no racing migration. Only step 6's _final node JSON_ waits on the reference template;
the trees themselves already compose and pass their tests.
