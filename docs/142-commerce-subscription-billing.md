# sparx Platform — Commerce Subscription Billing (recurring charges for a tenant's customers)

**Version:** 1.1
**Author:** Brandon Korous
**Last Updated:** 2026-08-04

> **Built 2026-08-04.** All six slices in §10 are implemented. Three things in v1.0 turned out to be
> wrong once the code was written, and are corrected below rather than left to mislead:
>
> 1. **The dunning policy already existed.** `DunningPolicy` was specified in
>    `@sparx/commerce-schemas` and `commerce_site_settings.default_dunning_policy` was already its
>    per-tenant home — neither had a reader. §4.1's invented shape is replaced by the real one, and
>    open question 1 is answered: the tenant-level setting needs a UI, not a schema.
> 2. **`getVaultedMethod` became `completeVault`.** Stripe hands back a server-created SetupIntent
>    id; Square and Authorize.net hand back a browser card token and have no such object. One
>    parameter shape now carries both.
> 3. **`paymentMethodRef` was already there and already dead** — a required field on
>    `CreateSubscriptionInput` that `create()` never read. That is the literal mechanism of the bug
>    this doc describes, and it is now replaced by `billingMode` + `paymentMethodId`.

> Extends [94-ADR-payment-gateway.md](94-ADR-payment-gateway.md) and
> [111-multi-gateway-payments.md](111-multi-gateway-payments.md). 94 defined the vendor-agnostic
> `PaymentGateway` abstraction and sparx Pay; 111 added bring-your-own gateways and the
> `GATEWAY_CATALOG` capability model. This doc adds the one capability neither covers — **charging a
> card the customer is not sitting in front of** — and builds the recurring-billing engine on top of it.
> It does not redefine the interface; it fills a missing slot.
>
> **Not to be confused with [17-billing-subscriptions.md](17-billing-subscriptions.md)**, which is
> WizeWorks charging _tenants_ for modules. See §1.1 — conflating the two is the mistake this doc
> exists to correct.

---

## 0. Why

A tenant can create a subscription today. It will never charge anyone.

The lifecycle is complete and real: `subscriptionService` exposes 15 operations, `/v1/commerce/subscriptions`
serves them, the workbench ships three surfaces (`commerce.subscriptions.list`,
`commerce.subscription.detail`, `commerce.product.subscriptions`), and the MCP tools are wired. A business
owner can create, pause, skip, resume, change items, change the address and cancel — and watch all of it
in a UI that works.

Nothing collects money. `findDueOccurrences` has no caller. `processOccurrence` creates the renewal order
and advances the schedule but never attempts payment, so the order lands unpaid, `order.paid` never
publishes, and **fulfilment never triggers either**. `recordDunningAttempt` writes a correct row that
nothing ever calls. `dunningPolicy` is written and never read.

Underneath all of it sits the actual blocker: **`PaymentGateway` cannot charge a stored card.** The
interface is `createPaymentIntent / confirmPayment / capturePayment / cancelPayment / refund /
createPaymentLink / parseWebhook / verifyWebhookSignature`. There is no way to save a reusable payment
method and no way to charge one, and no `CustomerPaymentMethod` model exists in the schema. Recurring
billing with no card on file is not a scheduling gap — it is a missing capability.

---

## 1. The decision

**sparx owns the schedule and charges off-session through whichever gateway the tenant already
connected.** It does not delegate the schedule to a third-party billing provider.

### 1.1 Why the schema said otherwise

The header comment on `packages/db/prisma/schema/41-commerce-subscriptions.prisma` reads:

> _SubscriptionBilling provider (Stripe by default) drives the actual charge schedule; the
> subscription-billing-worker advances Sparx state on the back of provider webhook events._

That describes the opposite architecture — Stripe Billing holds the card, runs the clock, retries the
dunning, and sparx mirrors the result off webhooks. Neither the `SubscriptionBilling` provider nor the
`subscription-billing-worker` was ever written. The provider interface was an empty socket and was
removed in the integrations consolidation (2026-08); this doc supersedes that comment, which is corrected
as part of slice 1.

The comment is best read as the **platform-billing pattern copied one file too far.**
[73-billing.prisma](../packages/db/prisma/schema/73-billing.prisma) implements exactly that design, and
there it is correct: WizeWorks charges each tenant through one Stripe subscription per tenant with one
item per active module, on WizeWorks' own credential, with Stripe as the source of truth. That works
because on the platform side **there is exactly one merchant — us.**

Commerce subscriptions have as many merchants as there are tenants, each with their own processor. The
assumption that makes delegation correct on the platform side is the assumption that fails here.

### 1.2 Why delegation fails for a tenant's customers

- **It only works for Stripe tenants.** `sparx_pay`, `square`, `authorize_net`, `first_pay`, `custom` and
  `manual` tenants could not offer subscriptions at all — so subscriptions would become a reason to
  switch processors, which directly contradicts 111 §0: _"the processor must never be the reason a
  tenant walks."_
- **It moves the tenant's recurring revenue out of sparx.** Their customer's next charge date would live
  in a dashboard sparx does not own, which is backwards for a platform whose pitch is that the business
  runs from one place.
- **It creates a two-way sync surface.** Every sparx-side edit — pause, skip, change items, change
  address — would need pushing into the provider's schedule and confirming back. That drift is the
  common failure mode of this pattern: the owner sees one thing in the UI and the customer is charged
  another.
- **It orphans what is already built.** `findDueOccurrences`, `computeNextOccurrence`, `processOccurrence`,
  `DunningAttempt`, `dunningPolicy` and the `past_due` status all assume sparx owns the cadence. Delegating
  makes every one of them dead code — a rewrite wearing a shortcut's clothes.

### 1.3 What we lose, honestly

Stripe Billing would have given us SCA handling, retry logic and the card-updater network (automatic
refresh of expired or reissued cards) for free. Owning the schedule means we handle SCA ourselves (§5.3)
and write our own retry ladder (§7), and we do **not** get card-updater — an expiring card becomes a
dunning failure and a customer email rather than a silent success. That is a real cost and it is
accepted; §12 keeps card-updater on the list as a per-adapter enhancement.

---

## 2. Binding decisions

- **D1 — Stored methods are a gateway capability, not a gateway.** `GatewayCapabilities` gains
  `storedMethods`. A gateway that cannot vault declares `false` and the product degrades honestly (§8)
  rather than the feature disappearing.

- **D2 — sparx never stores a PAN.** `CustomerPaymentMethod` stores the gateway's own token plus display
  metadata (brand, last4, expiry month/year). This preserves 94's central decision: _do not build money
  transmission infrastructure, do not pursue PCI DSS Level 1._ Card data is captured by the gateway's own
  hosted element and never transits sparx.

- **D3 — The tick is a k8s CronJob hitting an internal route.** `POST /internal/commerce/subscription-tick`,
  added to the existing `services/api-rest/src/routes/internal/commerce-cron.ts` and
  `k8s/cronjobs/commerce-subscription-tick.yaml`. Same shared-secret auth
  (`X-sparx-Internal-Cron-Token`), same sequential per-tenant loop as the reservation reaper. **No new
  service.**

- **D4 — Every subscription produces an order, paid or not.** The renewal order is the record of what was
  owed; payment is a separate fact recorded against it. This keeps the invoice/link fallback (§8) and the
  card path on one code path, and keeps a failed renewal visible in the orders list instead of vanishing.

- **D5 — Idempotency is the advancing `nextOccurrenceAt`.** Order creation and the schedule advance happen
  in one transaction, so a double-fired cron cannot bill twice. The charge is attempted _after_ that
  transaction commits; a charge that fails leaves the schedule advanced and the order unpaid, which is
  what dunning then operates on.

- **D6 — Retry timing lives in `DunningAttempt.nextRetryAt`.** It is already on the model. The tick reads
  due retries alongside due occurrences (§6), so there is one scheduler, not two.

- **D7 — A subscription must be created with an explicit payment intent.** Either a vaulted method id, or
  `billingMode: 'invoice'`. Creating a subscription with neither is rejected at the API. This is what
  prevents the current silent failure from reappearing in a new shape.

- **D8 — Order of adapter support follows reach, not neatness.** Stripe-family first (`sparx_pay` +
  `stripe_direct` — the default and the most common), then Square and Authorize.net. Every other tenant
  gets working subscriptions on day one through invoice mode (§8).

---

## 3. What exists vs. what this builds

| Layer                                                                                      | State                      |
| ------------------------------------------------------------------------------------------ | -------------------------- |
| `Subscription` / `SubscriptionItem` / `SubscriptionEvent` / `DunningAttempt` models        | Built                      |
| `subscriptionService` — create, pause, resume, skip, cancel, change items/address/schedule | Built                      |
| `/v1/commerce/subscriptions` routes + MCP tools                                            | Built                      |
| Workbench list, detail, and per-product subscription surfaces                              | Built                      |
| `findDueOccurrences`, `computeNextOccurrence`, `recordDunningAttempt`                      | Built, **uncalled**        |
| `processOccurrence` — renewal order + schedule advance                                     | Built, **does not charge** |
| A scheduler that ticks                                                                     | **Missing**                |
| A stored payment method                                                                    | **Missing**                |
| An off-session charge                                                                      | **Missing**                |
| A dunning ladder that retries                                                              | **Missing**                |
| Customer-facing card management + failure emails                                           | **Missing**                |

---

## 4. Data model

One new model, in a new schema file `packages/db/prisma/schema/42-commerce-payment-methods.prisma`.
Migration `20270204000000_commerce_subscription_billing` — which sorts after the current newest
(`20270203000000_record_page_addresses`), per the monotonic-naming constraint in
[packages/db/CLAUDE.md](../packages/db/CLAUDE.md).

```prisma
model CustomerPaymentMethod {
  id         String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId   String @map("tenant_id") @db.Uuid
  customerId String @map("customer_id") @db.Uuid

  // Which gateway minted the token. A token is meaningless to any other gateway,
  // so a tenant who switches processors re-vaults rather than migrates.
  gatewayId String @map("gateway_id") @db.VarChar(40)

  // The gateway's own references. `methodRef` is what gets charged; `customerRef`
  // is the gateway-side customer the method hangs off (Stripe requires both).
  methodRef   String  @map("method_ref") @db.VarChar(255)
  customerRef String? @map("customer_ref") @db.VarChar(255)

  // Display only — never enough to reconstruct a card. What a person needs to
  // recognise which card this is.
  brand     String? @db.VarChar(20)
  last4     String? @db.VarChar(4)
  expMonth  Int?    @map("exp_month")
  expYear   Int?    @map("exp_year")

  isDefault Boolean   @default(false) @map("is_default")
  status    String    @default("active") @db.VarChar(20) // active | expired | revoked
  lastUsedAt DateTime? @map("last_used_at") @db.Timestamptz

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  tenant   Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@unique([tenantId, gatewayId, methodRef])
  @@index([tenantId, customerId, status])
  @@map("commerce_customer_payment_methods")
}
```

Tenant-scoped, so a normal RLS `ENABLE + FORCE` table — the migration adds the policy by hand, as always.

`Subscription` gains two columns in the same migration:

```prisma
  // Which vaulted method renews this. Null with billingMode 'invoice' is valid;
  // null with billingMode 'card' is the state D7 exists to prevent.
  paymentMethodId String? @map("payment_method_id") @db.Uuid
  // card | invoice — how this subscription collects. See §8.
  billingMode     String  @default("card") @map("billing_mode") @db.VarChar(10)
```

`onDelete: Restrict` from `Subscription` to `CustomerPaymentMethod`: removing a card that an active
subscription renews on must fail loudly, not silently break the next renewal.

### 4.1 Dunning policy shape

**This already existed and had no reader.** `DunningPolicy` is defined in
`packages/commerce-schemas/src/subscriptions.ts`, and `commerce_site_settings.default_dunning_policy`
was already the per-tenant column for it. Nothing parsed either. Inventing a second policy shape in
the billing module would have been the fork, so the real one is used as-is:

```ts
export const DunningPolicy = z.object({
  maxAttempts: z.number().int().min(1).max(10).default(4),
  retryDelaysHours: z.array(z.number().int().positive()).max(10).default([24, 72, 168, 336]),
  finalOutcome: z.enum(['cancel', 'pause', 'mark_past_due']).default('pause'),
  notifyCustomerOnFirstFailure: z.boolean().default(true),
  notifyCustomerOnFinalFailure: z.boolean().default(true),
});
```

Resolution order is subscription override → tenant default → schema defaults, in
`subscriptionBilling.resolveDunningPolicy`. A malformed blob on one subscription degrades to the
defaults rather than throwing — one bad JSON value must not be able to stop every renewal in a tenant.

The default is deliberately gentle: four attempts over two weeks, then **pause** rather than cancel. A
paused subscription resumes the moment the customer updates their card; a cancelled one has to be
re-sold. Cancelling a paying customer because their card expired is a self-inflicted churn wound, so
it is opt-in. Only the first and final failures email the customer, so a bank having a bad week does
not produce four identical messages.

---

## 5. The gateway contract extension

### 5.1 Capability

```ts
export interface GatewayCapabilities {
  refunds: boolean;
  capture: boolean;
  paymentLinks: boolean;
  webhooks: boolean;
  /** Can vault a payment method and charge it later without the customer present
   *  (card-on-file / merchant-initiated). Gates subscriptions on the card path. */
  storedMethods: boolean;
}
```

Per-gateway, with §2 D8's order in mind:

| Gateway         | `storedMethods` | Notes                                                  |
| --------------- | --------------- | ------------------------------------------------------ |
| `sparx_pay`     | `true`          | Stripe Connect — SetupIntent on the connected account  |
| `stripe_direct` | `true`          | Stripe — SetupIntent on the tenant's own account       |
| `square`        | `true`          | Square Cards API — slice 5                             |
| `authorize_net` | `true`          | Authorize.net CIM — slice 5                            |
| `first_pay`     | `false`         | Vault support unconfirmed; invoice mode until verified |
| `paypal`        | `false`         | Adapter unwritten (`coming_soon` today)                |
| `custom`        | `false`         | Generic hosted redirect — no vault seam                |
| `manual`        | `false`         | No processor at all                                    |

`capabilityPhrases()` in `packages/payments/src/integration.ts` gains the owner-facing line —
**"Subscriptions and auto-ship"** — so the picker says which processors support recurring before a tenant
commits to one.

### 5.2 Interface

Two methods, both optional on the interface and required when `storedMethods` is true:

```ts
  /** Begin vaulting a method. Returns whatever the gateway's client element needs
   *  to collect the card (a SetupIntent client secret, a hosted page URL). The card
   *  itself never reaches sparx. */
  createSetupSession?(params: CreateSetupSessionParams): Promise<SetupSession>;

  /** Charge a vaulted method with the customer absent (merchant-initiated).
   *  `requiresAction` in the result means the issuer demanded authentication —
   *  see §5.3. */
  chargeStoredMethod?(params: ChargeStoredMethodParams): Promise<StoredChargeResult>;
```

```ts
interface StoredChargeResult {
  status: 'succeeded' | 'failed' | 'requires_action';
  paymentRef: string | null;
  /** Set on 'requires_action' — where to send the customer to authenticate. */
  actionUrl?: string;
  failureReason?: string;
  /** True when the gateway says the method is permanently dead (card closed,
   *  account revoked) rather than transiently declined. Skips the retry ladder. */
  methodDead?: boolean;
}
```

`methodDead` matters: retrying a closed card three times over five days accomplishes nothing except
three more decline fees and three more emails. A permanent failure jumps straight to the policy's
`finalOutcome` and asks the customer for a new card.

### 5.3 Authentication (SCA) on an off-session charge

Vaulting captures a mandate — the customer's agreement to be charged on a schedule — at the moment they
first pay. Most later charges then clear without the customer present. Some do not: an issuer can demand
authentication on a merchant-initiated charge, which Stripe surfaces as `authentication_required`.

That maps to `status: 'requires_action'`, and it is **not** a decline. Treated as one it would cancel
healthy subscriptions. The handling:

1. Record a `DunningAttempt` with `outcome: 'retry_scheduled'` and the reason.
2. Email the customer a link to `actionUrl` to confirm the payment.
3. Set `nextRetryAt` per the policy so the ladder still runs if they ignore it.

The renewal order stays unpaid until the customer confirms, at which point the gateway webhook settles it
through the path that already exists for interactive payments.

---

## 6. The tick

`POST /internal/commerce/subscription-tick` — added to the existing `commerce-cron.ts`, not a new file.
`k8s/cronjobs/commerce-subscription-tick.yaml` copies `commerce-reservation-reaper.yaml` verbatim except
the path and schedule.

**Schedule: `*/15 * * * *`.** Renewals are dated, not urgent — a subscription due "today" does not care
about the minute. Fifteen minutes bounds the worst-case delay at a quarter hour while keeping the query
count low. `concurrencyPolicy: Forbid`, as with every other commerce cron.

Per tenant, sequentially, the tick collects two sets:

1. **Due occurrences** — `findDueOccurrences(ctx, now, limit)`, which already exists and already filters
   `status in ['active','trialing']` with `nextOccurrenceAt <= now`, ordered ascending.
2. **Due retries** — the latest `DunningAttempt` per `past_due` subscription whose `nextRetryAt <= now`.

Both feed the same charge path (§7). The retry set re-charges the **existing** unpaid renewal order rather
than creating a second one — one occurrence, one order, many attempts.

A `limit` per tenant per tick keeps one large tenant from starving the loop; the leftovers are picked up
on the next pass because their `nextOccurrenceAt` is still in the past.

---

## 7. The charge path

Inside `processOccurrence`, after the existing transaction commits:

```
if billingMode === 'invoice'  → §8
resolve the subscription's CustomerPaymentMethod
resolve the tenant's active gateway + its adapter
chargeStoredMethod({ amount, currency, methodRef, customerRef, orderId, idempotencyKey })
```

The `idempotencyKey` is derived from `subscriptionId + occurrence timestamp + attemptNumber`, so a retried
HTTP call to the gateway cannot double-charge even if sparx crashes mid-request.

**On `succeeded`:** record the `OrderPayment` against the renewal order through the existing payment path,
publish `order.paid` — which is what finally makes fulfilment run — write a `DunningAttempt` with
`outcome: 'succeeded'`, and set the subscription back to `active` if it was `past_due`. The existing
`subscription.renewed` publish stays where it is.

**On `failed`:** `recordDunningAttempt` (which already flips the status to `past_due` and computes
`attemptNumber`), set `nextRetryAt` from the policy, write a `payment_failed` `SubscriptionEvent`, and
publish `email.send` for the customer notification. If the ladder is exhausted, or `methodDead` is set,
apply `finalOutcome` instead of scheduling another retry.

**On `requires_action`:** §5.3.

The whole charge sits outside the order-creation transaction on purpose. A gateway call is a network
round-trip to a third party and can hang; holding a database transaction open across it is how connection
pools die under load.

---

## 8. Invoice mode — the fallback that is also a feature

A subscription whose gateway cannot vault, or whose customer is a B2B account on terms, sets
`billingMode: 'invoice'`. The tick still runs, `processOccurrence` still creates the renewal order on
schedule, and instead of charging it:

- generates a payment link via `createPaymentLink` — already on the interface, already implemented by
  every gateway with `paymentLinks: true`;
- publishes `email.send` with the order and the link;
- leaves the order unpaid and the subscription `active`. It is not `past_due` — nothing failed. An unpaid
  invoice is an accounts-receivable state, not a dunning state, and conflating them would show a
  wholesale customer on 30-day terms as a payment failure every single month.

This means **every tenant has working subscriptions from slice 4**, regardless of processor. It is also
what a wholesale account actually wants: a recurring standing order that invoices rather than
auto-charging. Dunning for invoice mode is the existing B2B invoice reminder path, not the card ladder.

---

## 9. Customer-facing surfaces

Nothing above is reachable without these, so they are in scope, not follow-on:

- **Vaulting at checkout.** When a cart contains a subscription item, checkout runs
  `createSetupSession` alongside the payment so the card is saved with a mandate. The copy has to say
  plainly what the customer is agreeing to — what, how much, how often, and how to stop — because
  "surprise recurring charge" is the single most common subscription complaint and the most common
  chargeback reason.
- **Managing the card later.** The storefront account area lists saved methods, sets a default, adds and
  removes. Removing the method behind an active subscription is blocked by `onDelete: Restrict` and must
  say why rather than surfacing a database error.
- **Failure emails — NOT `@sparx/email` templates.** v1.0 was wrong here. Every tenant→customer email
  in the platform is a **Builder-authored** template the merchant can edit, dispatched by a system
  automation listening on an event; the `EmailSendPayload.template` union is for sparx→tenant mail only.
  Six subscription emails already existed on that path (`subscription-confirmed` / `-renewed` /
  `-payment-failed` / `-paused` / `-resumed` / `-cancelled`), wired to `subscription.*` events.
  So the work was two NEW events and two new authored templates, not a platform template:
  - `subscription.authentication_required` → `subscription-authentication-required`
  - `subscription.invoiced` → `subscription-invoice`

  Both are worded deliberately as **not failures** — the first says the card is fine and one tap is
  needed, the second reads as a routine bill. Publishing a hard-coded platform template here would
  have produced the only subscription emails a merchant could not change.

- **Workbench.** The subscription detail surface gains a "How it gets paid" section: the card, its
  expiry, a picker to move to another saved card, and a "bill them instead" switch. A card
  subscription with no usable card gets a danger callout — it looks completely healthy otherwise
  (active, a next date, an MRR figure) and would silently never charge anyone, which is the exact
  failure this whole doc exists to fix.

---

## 10. Build order

Each slice is independently shippable and leaves the platform working.

1. **Correct the schema comment; add the capability flag.** `storedMethods` on `GatewayCapabilities`, set
   per-gateway per §5.1, plus the `capabilityPhrases` line. Nothing behaves differently yet; the picker
   starts telling the truth about which processors support recurring.
2. **The vault.** `CustomerPaymentMethod` model + migration `20270204000000_commerce_subscription_billing`
   with its RLS policy, the two `Subscription` columns, and the service layer. Migration authored as
   files and handed off — never run locally.
3. **The Stripe adapter methods.** `createSetupSession` + `chargeStoredMethod` on `stripe-direct.ts` and
   `sparx-pay.ts`, with SCA handling. Covers the default gateway and the most common bring-your-own.
4. **The tick and the charge.** The internal route, the CronJob, the charge inside `processOccurrence`,
   the dunning ladder, invoice mode. **This is the slice where subscriptions start collecting money** —
   card for Stripe-family tenants, invoice for everyone else.
5. **Square + Authorize.net.** `storedMethods: true` for the two remaining vault-capable gateways.
6. **Customer-facing.** Checkout vaulting, account card management, the three email templates, the
   workbench additions.

---

## 11. Out of scope

- **Card-updater.** Automatic refresh of expired or reissued cards is a per-gateway network feature
  (Stripe has it; others vary). Until it is wired, an expired card is a dunning failure with an email.
  Worth revisiting once subscription volume makes involuntary churn measurable.
- **Usage-based / metered subscriptions.** The schedule here is fixed-cadence with fixed items. Metering
  is a different data model and a different doc.
- **Proration on mid-cycle item changes.** `updateSubscriptionItems` currently changes what ships next
  cycle. Charging a mid-cycle difference is a follow-on.
- **Delegating to a third-party billing provider.** Decided against in §1 and not to be relitigated
  without a stated reason the multi-gateway constraint no longer applies.

---

## 12. Open questions

1. **A UI for the tenant dunning policy.** Answered halfway: the column
   (`commerce_site_settings.default_dunning_policy`) and the schema both already existed and are now
   read, so a tenant's policy is honoured the moment a value lands there. What does not exist is a
   screen to set it — today it would take an API call. Worth a small Finance → Payments panel, but it
   is not blocking: the defaults are deliberate and safe.
2. **1stPayGateway vault.** Listed `false` because their card-on-file support is unverified, not because
   it is known absent. Worth confirming against their API docs before slice 5 — if it exists, it is a
   cheap addition.
3. **Trial handling.** Resolved by construction: `findDueOccurrences` already selects `trialing` rows,
   and `processOccurrence` already flips status to `active` on the first renewal. A trial's first
   charge therefore runs down the ordinary path. Still worth exercising against a real trial
   subscription before the first tenant sells one.

4. **Square and Authorize.net vaulting is UNEXERCISED.** Both adapters are written against the
   documented Cards API / CIM shapes and both typecheck, but neither has been run against a sandbox —
   the credentials do not exist in this environment. They are `storedMethods: true` in the catalog,
   which means a Square tenant's subscriptions will attempt a card charge rather than falling back to
   invoicing. **Run the sandbox exercise in docs/111 §4 before a tenant on either gateway sells a
   subscription**, or flip those two to `false` until it is done — invoice mode is a working fallback,
   a broken vault is not.

5. **The inline "add a card" route.** The storefront account page routes inline gateways to
   `/checkout/save-card?setup=…`, deliberately reusing checkout's card element rather than building a
   second one that would drift from it. That route does not exist yet — redirect-style gateways work
   today, Stripe-family card-adding from the account page needs it. Adding a card _at checkout_ is
   unaffected.
