# One Tenant Email System — collapse coded templates into the Builder

**Version:** 1.1 (**BUILT** — S1–S6 landed 2026-06-12; deviations + status in §7)
**Author:** Brandon Korous
**Last Updated:** 2026-06-12

> **Decision.** Every email a **tenant sends to its own customers** is a
> Builder-authored node-tree — there is exactly **one** authoring system for tenant
> email (the Email Builder, docs/52). The coded React Email templates that today
> render `order-confirmation` / `shipping-confirmation` / the appointment set move
> into the Builder as keyed defaults (joining the 13 of docs/91). Emails that sparx
> sends to the **merchant** (onboarding, account, operational) and **auth/security**
> infrastructure (password reset, email verification) **stay coded**. The
> `/email/templates` dashboard page — a thin subject/intro/outro override surface
> over just two coded templates — is **removed**: with tenant content owned by the
> Builder and platform/auth email owned by code, it is pure redundancy and a source
> of "why are there two transactional-email pages" confusion.

---

## 0. Why this exists

After docs/91, a tenant's email lives in **three** places at once:

1. **Coded React Email templates** — rendered in the lean `email-worker` via
   `renderTemplate()` from a discriminated union keyed by `template`
   ([services/email-worker/src/handler.ts](../../services/email-worker/src/handler.ts)).
   Eleven templates: `password-reset`, `welcome-merchant`, `email-verification`,
   `domain-renewal-reminder`, `order-confirmation`, `shipping-confirmation`,
   `chat-notification`, `appointment-confirmation`, `appointment-reminder`,
   `appointment-cancelled`.
2. **Builder-authored trees** — the 13 `DEFAULT_EMAIL_TEMPLATES` (docs/91) plus any
   tenant-created emails, rendered by `renderEmailTree()` and sent **pre-rendered**
   as `kind:'raw'` (the dispatch-time send-by-key path).
3. **`/email/templates`** — the `EmailTemplate` (`source='builtin'`) override layer,
   which lets a tenant edit the **subject + intro/outro slots** of just **two** of
   the coded templates (`welcome-merchant`, `password-reset`).

Three systems for one concept. The page in (3) is titled "Transactional templates"
yet the Builder now owns the real transactional surface (welcome, invoices, dunning,
B2B quotes…), so a merchant hunting for "where do I edit my order confirmation"
can land on the wrong one. This doc collapses (1)+(3) into (2) for everything a
tenant authors, and **keeps** the genuinely-different platform/auth emails coded.

There is **no synchronous blocker.** All of these — including password reset — are
already published as async `email.send` events
([wizeworks/packages/auth/src/email-events.ts](../../packages/auth/src/email-events.ts),
[wizeworks/services/api-rest/src/routes/v1/public/account.ts](../../services/api-rest/src/routes/v1/public/account.ts#L314)).
The only truly synchronous email would be OTP/2FA, which does not exist yet (§8).

---

## 1. The classification principle (keystone)

> An email is **Builder-authored** when its audience is the **tenant's own
> customer** and its content is **brand / commerce / lifecycle** the merchant would
> reasonably want to control.
>
> An email **stays coded** when it is either
> (a) **platform** — sparx → the merchant/staff (onboarding, billing, domain,
> operational alerts), or
> (b) **auth/security infrastructure** — password reset, email verification — where
> merchant-editable structure is a security and support liability. This holds **even
> when the recipient is the tenant's customer** (the site password reset is
> exactly this case, and it stays coded).

Brand still applies to coded emails — `brandService.resolveEmailBrand` already
inlines the tenant's (or site's) logo + colors at render
([handler.ts:226](../../services/email-worker/src/handler.ts#L226)). "Stays coded" means
the merchant doesn't edit **structure/copy**, not that it's unbranded.

### 1.1 Per-template disposition

| Template                   | Audience                             | Sender today                                | Disposition                                           |
| -------------------------- | ------------------------------------ | ------------------------------------------- | ----------------------------------------------------- |
| `order-confirmation`       | tenant → customer                    | Stripe webhook + `stripe-payment-reconcile` | **→ Builder** (`order-confirmation` key)              |
| `shipping-confirmation`    | tenant → customer                    | fulfillment flow                            | **→ Builder** (`shipping-confirmation` key)           |
| `appointment-confirmation` | tenant → customer                    | `v1/b2b/scheduling`                         | **→ Builder** (`appointment-confirmation` key)        |
| `appointment-reminder`     | tenant → customer                    | `v1/b2b/scheduling`                         | **→ Builder** (`appointment-reminder` key)            |
| `appointment-cancelled`    | tenant → customer                    | `v1/b2b/scheduling`                         | **→ Builder** (`appointment-cancelled` key)           |
| `welcome-merchant`         | sparx → merchant                     | Better Auth (`@wizeworks/auth`)             | **Stays coded** (platform onboarding)                 |
| `email-verification`       | sparx → dashboard user               | Better Auth (`@wizeworks/auth`)             | **Stays coded** (auth)                                |
| `password-reset`           | dashboard user **and** site customer | Better Auth + `public/account`              | **Stays coded** (auth infra — §1.2)                   |
| `domain-renewal-reminder`  | sparx → merchant                     | `domain-worker` cron                        | **Stays coded** (platform/account)                    |
| `chat-notification`        | sparx-system → owner/admin **staff** | `lib/chat/notify`                           | **Stays coded** (operational; links to the dashboard) |

The customer-facing chat email (`chat-satisfaction`) is already a Builder default —
`chat-notification` above is the **staff** alert, a different email.

### 1.2 The one carve-out: site customer password reset

The site customer reset
([account.ts:331](../../services/api-rest/src/routes/v1/public/account.ts#L331))
**reuses the same `password-reset` coded template** as the dashboard. It is a
tenant→customer email, so by the audience test alone it would move to the Builder —
but it carries a one-shot security token (`resetUrl`) and an enumeration-safe
contract. A merchant who deleted the link node from a Builder-authored reset email
would silently lock their customers out and create a phishing-shaped support
incident. **Auth/security emails are therefore a deliberate exception: they stay
coded regardless of recipient.** If a merchant ever needs to brand the reset email
beyond logo/colors, §8 sketches a gated path; we do **not** build it now.

---

## 2. Target architecture — render-by-key at dispatch

The Builder path already exists; the migration **generalizes it**. Today the
automation dispatcher resolves a `BuilderEmail` by `key`, renders it, and emits a
`kind:'raw'` send ([wizeworks/services/api-rest/src/lib/email-dispatch.ts](../../services/api-rest/src/lib/email-dispatch.ts),
[email-data.ts](../../services/api-rest/src/lib/email-data.ts)). We lift that into one
reusable primitive that **any** direct sender can call.

```
sendTenantEmailByKey(ctx, {
  key,                 // 'order-confirmation' | 'shipping-confirmation' | 'appointment-*'
  to,                  // recipient
  propertyId,          // per-site override resolution (docs/49 Phase 7b)
  ref,                 // EmailRecipientRef — the entity ids the tree resolves against
})
   1. tree   = emailService.getPublishedByKey(ctx, key, propertyId)
               ?? DEFAULT_EMAIL_TEMPLATES[key].tree          // code-shipped fallback
   2. data   = resolveEmailData(ctx, tree, ref, [subject, preheader])
   3. out    = renderEmailTree({ tree, subject, preheader, to, data, brand })
   4. publish 'email.send' { kind:'raw', ...out, propertyId } → email-worker delivers as-is
```

Why api-rest, not the worker: api-rest is the composition root that already has
`@wizeworks/builder` + the commerce-aware `resolveEmailData`; the worker stays lean
(it only ever receives `kind:'raw'` for these, exactly as broadcasts + automations
already do). This is the established split (docs/52 §6), not a new dependency.

**Code-shipped fallback** (step 1) is the safety net that lets us delete the coded
templates: if a tenant predates provisioning or dropped its row, the send still
renders from the `DEFAULT_EMAIL_TEMPLATES` tree in `@wizeworks/builder-schemas`. The
6-hour provisioning reconcile
([wizeworks/services/api-rest/src/lib/email-provisioning.ts](../../services/api-rest/src/lib/email-provisioning.ts))
back-fills the row so the tenant can then edit it.

### 2.1 No new safety gate is needed for the moved emails

The five moved templates are **not** credential-bearing. Their CTAs degrade
gracefully — every `*Url` already falls back to the store root when an entity
doesn't resolve ([email-data.ts](../../services/api-rest/src/lib/email-data.ts), `homeUrl`).
The CAN-SPAM marketing gate (docs/91 §8) continues to apply unchanged to the
marketing trees. A required-token gate is reserved for the hypothetical future where
an **auth** email becomes Builder-authored (§8) — out of scope here.

---

## 3. Data resolver extensions

`resolveEmailData` already serves `customer / tenant / order / cart / quote /
invoice / b2bAccount / loyalty / commerce.product / promotion / cms.*`. The moved
templates need:

| New source root         | Fields                                                                              | Source                                             |
| ----------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| `order.shippingAddress` | name, line1, line2, city, region, postalCode, country                               | extend `resolveOrder` (already loads the order)    |
| `shipping.*`            | `carrier`, `trackingNumber`, `trackingUrl`, `estimatedDelivery`, `address.*`        | new resolver over the order's latest `Fulfillment` |
| `appointment.*`         | `service`, `startAt` (date + time labels), `location`, `rescheduleUrl`, `cancelUrl` | new resolver over the scheduling entity            |

These follow the existing resolver idiom exactly: entity-scoped, selected by
`collectEmailSourceKeys` so a tree that doesn't reference them costs nothing, every
`*Url` resolved to a real site route. Add the new ref ids
(`fulfillmentId`, `appointmentId`) to `EmailRecipientRef`.

---

## 4. The five new Builder default trees

Authored in `wizeworks/packages/builder-schemas/src/default-emails.ts` exactly like the 13
(the `node()`/`body()` helpers), appended to `DEFAULT_EMAIL_TEMPLATES`. Provisioning
and the reconcile back-fill pick them up automatically (they iterate the array), and
each is per-site overridable via the same `(tenant, property, key)` model. Count
goes **13 → 18**.

| key                        | type          | category   | binds                                                                                       |
| -------------------------- | ------------- | ---------- | ------------------------------------------------------------------------------------------- |
| `order-confirmation`       | transactional | order      | `customer`, `order.items` (`line_item_table`), `order.total`, `order.shippingAddress`       |
| `shipping-confirmation`    | transactional | order      | `customer`, `order.number`, `shipping.carrier/trackingNumber/trackingUrl/estimatedDelivery` |
| `appointment-confirmation` | transactional | scheduling | `customer`, `appointment.service/startAt/location`                                          |
| `appointment-reminder`     | transactional | scheduling | `customer`, `appointment.service/startAt/location`                                          |
| `appointment-cancelled`    | transactional | scheduling | `customer`, `appointment.service/startAt`, `appointment.rescheduleUrl`                      |

All five are transactional (no `unsubscribe_link`/`physical_address`) — they're
triggered by an action the customer took, so the CAN-SPAM marketing gate doesn't
apply.

---

## 5. Retire the coded templates + the override page

Once the five senders route through `sendTenantEmailByKey`:

**Remove the moved coded templates**

- Delete the 5 components + exports from `@wizeworks/email`
  ([wizeworks/packages/email/src/templates/index.ts](../../packages/email/src/templates/index.ts)).
- Delete their 5 arms from `TemplateSendSchema`
  ([handler.ts:43](../../services/email-worker/src/handler.ts#L43)) and the matching
  `TemplateSend` union in `@wizeworks/email`. The worker keeps **`kind:'raw'`** + the
  5 surviving coded templates (`password-reset`, `welcome-merchant`,
  `email-verification`, `domain-renewal-reminder`, `chat-notification`).

**Delete `/email/templates`**

- Page + dashboard nav entry:
  [apps/dashboard/app/(dashboard)/email/templates/](<../%3C../apps/dashboard/app/(dashboard)/email/templates/%3E>).
- Routes: `/v1/email/templates` (+ `/builtin/:key`, `/preview`, `/test-send`)
  ([wizeworks/services/api-rest/src/routes/v1/email/templates.ts](../../services/api-rest/src/routes/v1/email/templates.ts)).
- `templateService` builtin surface + `BUILTIN_TEMPLATES`
  ([wizeworks/packages/email-platform/src/builtin-templates.ts](../../packages/email-platform/src/builtin-templates.ts),
  [services/template-service.ts](../../packages/email-platform/src/services/template-service.ts)).
- **Audit `EmailTemplate` (`source='builtin'`)** before dropping the model: confirm
  no other reader, then drop the override rows/table in a pipeline migration. Zero
  prod users → no data to migrate, but the migration must still go through the DB
  Migrate workflow (hand-authored SQL), never a laptop.

**Re-home what's left.** The two surviving _customizable_ coded emails
(`welcome-merchant`, `password-reset`) lose their subject/slot override UI. That is
intentional — they are platform/auth infrastructure, not tenant content. If a
subject tweak is ever wanted, it belongs in a small **Settings → Email**
read-mostly panel, not a "Templates" page that competes with the Builder. Tracked,
not built here.

---

## 6. Migration of the senders

| Sender                  | File                                                                                           | Change                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Stripe payment captured | [webhooks/stripe.ts](../../services/api-rest/src/routes/v1/webhooks/stripe.ts#L216)            | replace `publish('email.send', {template:'order-confirmation'})` with `sendTenantEmailByKey('order-confirmation', { ref:{ orderId } })` |
| Payment reconcile       | [lib/stripe-payment-reconcile.ts](../../services/api-rest/src/lib/stripe-payment-reconcile.ts) | same                                                                                                                                    |
| Shipping confirmation   | fulfillment flow (`order.fulfilled`)                                                           | `sendTenantEmailByKey('shipping-confirmation', { ref:{ orderId, fulfillmentId } })`                                                     |
| Appointment ×3          | [v1/b2b/scheduling.ts](../../services/api-rest/src/routes/v1/b2b/scheduling.ts)                | `sendTenantEmailByKey('appointment-*', { ref:{ appointmentId } })`                                                                      |

Each carries `propertyId` where the originating entity has one, so per-site brand +
per-site overrides apply (docs/49 Phase 7b). All five live in **api-rest**, which
already has the Builder + resolver — no service gains a new heavy dependency.

---

## 7. Build plan (slices) — ALL BUILT 2026-06-12

| Slice  | Scope                                                                                                         | Status                                                                                                                                                                                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **S0** | This doc                                                                                                      | ✅                                                                                                                                                                                                                                                                                                     |
| **S1** | `sendTenantEmailByKey` primitive + code-shipped fallback in `getPublishedByKey`                               | ✅ [tenant-email.ts]; fallback lives IN `getPublishedByKey` so the automation path heals too                                                                                                                                                                                                           |
| **S2** | Resolver: `order.shippingAddress`/`statusUrl`, `shipping.*`, `appointment.*` + `fulfillment/appointment` refs | ✅ [email-data.ts] + `shipping`/`appointment` added to `EMAIL_SOURCES` (binding.ts)                                                                                                                                                                                                                    |
| **S3** | Author the 5 default trees; `DEFAULT_EMAIL_TEMPLATES` 13 → 18                                                 | ✅ unit asserts 18 keys + tree validity                                                                                                                                                                                                                                                                |
| **S4** | Migrate the senders                                                                                           | ✅ — but only **3 live senders** existed: `order-confirmation` (stripe-payment-reconcile), `appointment-confirmation`/`-cancelled` (b2b/scheduling). `shipping-confirmation` + `appointment-reminder` had **no caller** (reminder cron unbuilt), so their trees ship ready but nothing sends them yet. |
| **S5** | Retire the 5 coded templates + worker schema arms                                                             | ✅ removed from `@wizeworks/email` (5 components), `send.tsx` union, worker `TemplateSendSchema` (only order/shipping arms existed), `events` `EmailSendPayload` union                                                                                                                                 |
| **S6** | Delete `/email/templates` + drop `EmailTemplate`                                                              | ✅ page/routes/`templateService`/`BUILTIN_TEMPLATES`/manifest nav gone; model + the dead `Broadcast.template_id`/`ScheduledSend.template_id` FK columns dropped (migration `20260818000000_drop_email_templates`, applied to docker, drift-clean)                                                      |

**Deviations from the plan:**

- **Fallback placement (S1).** The code-shipped fallback was put INSIDE
  `emailService.getPublishedByKey` rather than only in the new primitive, so the
  existing automation send-by-key path (`email-dispatch.ts`) self-heals too — a
  tenant missing a default row renders the shipped tree instead of failing.
- **`chat-notification` stays coded (§1.1 refinement).** Confirmed it targets
  owner/admin **staff** and links to the dashboard — operational, not a customer
  email — so it stayed coded alongside the platform/auth set.
- **Two trees have no sender yet (S4).** `shipping-confirmation` +
  `appointment-reminder` are authored + provisioned but inert until a fulfillment
  email + a reminder cron are wired. Not a gap in this migration — those callers
  never existed.
- **Test caveat.** `email-provisioning-reconcile` + `builder-emails-per-site`
  count-assertions pass on CI/prod (RLS-enforced) but fail under the **local docker
  superuser** (`sparx_owner` bypasses RLS, and `provisionDefaultEmails`'s
  "already-provisioned?" check trusts RLS), with dev tenants present. Left as
  authored — fixing would mean adding explicit `tenant_id` predicates against the
  file's RLS-trust convention, or wiping dev data.

**Canvas follow-up (not in this doc's scope, tracked separately).** The Email
Builder _canvas_ is a WYSIWYG approximation that rendered merge tokens raw and used
site heading sizes. Partly addressed: `sampleEmailText` (builder-schemas) now
interpolates `{{tokens}}` against editor SAMPLE data in the canvas Heading/Text/
Button so it reads like a real email. The heading-SIZE mismatch (site hero sizes vs
the email's 20px) is still open.

---

## 8. Forward: OTP/2FA and auth-in-Builder (not built)

When OTP/2FA lands it is the first **synchronous** email — the user is blocked
waiting on the code. `renderEmailTree` is a fast in-memory render, so even a
Builder-authored OTP could render synchronously through the `sendEmail()` escape
hatch (services/CLAUDE.md). But per §1, auth/security email **stays coded** for now;
OTP ships coded alongside `password-reset`.

If we ever expose auth emails to Builder authoring, the safety contract is a
**required-token gate**: a `password-reset` tree that doesn't bind `{{auth.resetUrl}}`
is refused at dispatch and falls back to the code-shipped default — never send a
reset with no link. This reuses the compliance-gate machinery (docs/91 §8). Noted
for completeness; out of scope.

---

## 9. Open decisions

- **`EmailTemplate` model fate** (§5): drop entirely, or keep the table for a future
  Settings→Email subject panel? Default: drop after the no-reader audit; re-add when
  a concrete need appears.
- **Appointments module liveness**: the three appointment templates are wired from
  `v1/b2b/scheduling`. Confirm the scheduling surface is active for the tenants that
  need it before retiring the coded appointment templates (S5) — otherwise S3/S4 land
  but S5 waits.
