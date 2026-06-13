# Default Email Templates & Per-Site Email

**Version:** 1.0 (design — content/structure final; node JSON + schema pending the automation-module node contract)
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

| Owned by the **automation module** (hand-off pending)                                                               | Owned **here** (this doc)                                                                            |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| The node-tree **JSON shapes**: `DataSource` declaration, the new `line_item_table` and `conditional_block` nodes    | The **content + structure** of all 13 templates (§4) — final, design against it now                  |
| The **reference template** published from "Step 2"                                                                  | The **per-site email model**: `BuilderEmail.property_id` + `key`, override resolution (§6)           |
| The **merge-field resolver / `DataSource`** that exposes the vocabulary (§3) and resolves `*Url` tokens at dispatch | **Provisioning** the 13 defaults on email activation + the `DEFAULT_AUTOMATIONS` reconciliation (§7) |
|                                                                                                                     | The **compliance gate**: marketing must carry unsubscribe + address nodes (§8)                       |

**Sequencing.** Content/structure (§4) is final now — design against it. The final
**node JSON** for each template is materialized against the automation agent's node
contract when it lands ("a couple steps out"). Until then we do **not** emit node
trees, and we do **not** mutate `BuilderEmail`'s schema in parallel — §6/§7/§8 are
specced here and built once the contract + the shared `BuilderEmail` change are
confirmed, so the two agents don't collide on the same tables.

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
| `order`                | `number total subtotal status placedAt`                        | `order.items[]`: `name quantity unitPrice lineTotal`          | partial — labels only (`statusLabel`/`totalLabel`); no raw values, no `items[]`       |
| `cart`                 | `total itemCount recoveryUrl`                                  | `cart.items[]`: `name quantity unitPrice lineTotal`           | partial — `items[]` (title/priceLabel/imageUrl); no `total`/`itemCount`/`recoveryUrl` |
| `quote`                | `number total status validUntil reviewUrl`                     | `quote.items[]`: `name quantity unitPrice lineTotal`          | **missing**                                                                           |
| `invoice` (billingDoc) | `number total balance dueDate daysUntilDue overdueDays payUrl` | `invoice.items[]`: `description quantity unitPrice lineTotal` | **missing**                                                                           |
| `b2bAccount`           | `companyName paymentTerms creditLimit status portalUrl`        | —                                                             | **missing**                                                                           |

The `*Url` tokens (`storeUrl`, `recoveryUrl`, `payUrl`, `reviewUrl`, `portalUrl`)
are resolved **at dispatch** by the resolver — this is what makes the CTAs work.

> **One gap to flag to the automation agent:** template #4 (`post-purchase-review`)
> needs a review destination, but `order` has no `reviewUrl`. Either add
> `order.reviewUrl` to the vocabulary, or the review CTA falls back to
> `{{tenant.storeUrl}}`. Marked inline in §4.

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
- button: "Leave a review" → `{{order.reviewUrl}}` _(needs `order.reviewUrl` added to the vocabulary; else falls back to `{{tenant.storeUrl}}` — see §3)_
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

Existing nodes cover most blocks: `Heading`, `Text`/`Prose` (paragraphs), `Button`
(CTAs), `Section`/`Stack` (layout). The blocks that need the **automation agent's new
nodes**:

| Block            | Node                | Status                                                     |
| ---------------- | ------------------- | ---------------------------------------------------------- |
| line item tables | `line_item_table`   | greenfield — automation agent's contract                   |
| conditional copy | `conditional_block` | greenfield — automation agent's contract                   |
| unsubscribe link | `unsubscribe_link`  | greenfield — built here (§8) or theirs; decide at hand-off |
| physical address | `physical_address`  | greenfield — renders `EmailSettings.physicalAddress` (§8)  |

Materialization waits on `line_item_table` + `conditional_block` JSON shapes. The
unsubscribe/address nodes are compliance-owned (§8) — flagged at hand-off so we don't
both build them.

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

## 8. Compliance gate (CAN-SPAM)

Greenfield. Three pieces:

1. **Template rule (send-time gate).** A **marketing** send (scope `marketing`)
   whose published tree contains no `unsubscribe_link` node is **refused** (a clear
   error, recorded on the send) — you cannot send marketing mail without an
   unsubscribe. A **transactional** send must not contain one. Enforced where the
   tree is resolved at dispatch, before `renderEmailTree`.
2. **`unsubscribe_link` + `physical_address` nodes.** The unsubscribe node renders a
   working one-click link (and feeds the `List-Unsubscribe` header, below); the
   address node renders `EmailSettings.physicalAddress`
   ([packages/db/prisma/schema/50-email.prisma](../packages/db/prisma/schema/50-email.prisma)),
   which exists but is not yet surfaced anywhere.
3. **`List-Unsubscribe` header.** The worker/provider sets `List-Unsubscribe` +
   `List-Unsubscribe-Post` for marketing sends (one-click unsubscribe). Independent
   of the tree; pairs with the existing Mailgun `unsubscribed` → `EmailSuppression`
   webhook path.

The 13 templates already place `[unsubscribe + address]` in exactly the four
marketing ones (#2, #3, #4) — _(#2/#3/#4; #1 and #5–#13 are transactional and carry
neither)_ so they pass the gate by construction.

---

## 9. Build sequence

| Step | Work                                                                                             | Blocked on                                   |
| ---- | ------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| 1 ✅ | Content/structure of all 13 templates (§4) + per-site model (§6) + reconciliation (§7)           | — (this doc)                                 |
| 2    | Resolver/`DataSource` reaches the §3 target vocabulary (`quote`/`invoice`/`b2bAccount` + `*Url`) | automation agent (resolver contract)         |
| 3    | `line_item_table` + `conditional_block` node JSON shapes + reference template                    | automation agent (node contract)             |
| 4    | `BuilderEmail.property_id` + `key` migration (§6) + partial uniques                              | step 3 (coordinate the shared schema change) |
| 5    | `emailService.getPublishedByKey` + per-site authoring scope + "Customize for this site"          | step 4                                       |
| 6    | Materialize the 13 node trees against the contract + provision on activation (§7)                | steps 3–5                                    |
| 7    | Compliance gate + `unsubscribe_link`/`physical_address` nodes + `List-Unsubscribe` (§8)          | step 3 (node shapes)                         |

Steps 4–7 are mine; step 1 is done (this doc); steps 2–3 are the hand-off. Step 4's
migration is the one shared mutation — sequenced **after** the node contract so the
two agents touch `BuilderEmail` once, together, not in racing migrations.
