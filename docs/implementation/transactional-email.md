# Transactional email — coverage + build tracker

Version: 0.4
Author: Brandon Korous
Last Updated: 2026-07-26

> The **living** status + decision log for sparx's transactional & lifecycle email.
> It answers three questions the design docs don't: what the platform actually
> _sends_ today, where the _gaps_ are, and _what we're building_ to close them.
>
> It complements — does not replace — the static docs:
>
> - [13 — Email platform PRD](../13-email-platform-prd.md) — the module design.
> - [docs/93 (archived) — one-tenant email system](../archive/93-one-tenant-email-system.md) — why tenant→customer emails are Builder-authored.
> - [120 — email builder silica adoption](../120-email-builder-silica-adoption.md) — the silica rendering path.
> - Memory: `project_transactional_email_redesign` — the base design language + the fingerprint refresh.
>
> When a decision here contradicts an older assumption, **this doc wins** and the
> older doc should be reconciled. Update this file in the same change that ships the
> thing it describes.

**Status legend:** ✅ shipped · 🟡 code-complete, uncommitted/pending deploy · ⬜ not started · 🔎 needs verification

---

## 1. How email works here (the three layers)

Every email a person receives is the product of **three** independent layers. A gap
in any one means no email arrives — the audit in §3 checks all three.

| Layer         | What it is                                            | Where it lives                                                                                                                                                |
| ------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Body**      | The editable content a tenant can rewrite             | Silica `DEFAULT_EMAIL_TEMPLATES` (bucket A) **or** a coded React-Email template (bucket B)                                                                    |
| **Trigger**   | The thing that decides "send it now, to this address" | A **system-automation seed** (`email.send_campaign` → `builderEmailKey`) **or** a **direct** `sendTenantEmailByKey` call **or** a direct `email.send` publish |
| **Transport** | Render + relay                                        | publish `email.send` → `email-worker` → Mailgun (`sparx.email`)                                                                                               |

### Two body systems

- **Bucket A — tenant-editable Builder defaults (silica).** Now **37** keyed templates in
  [`packages/builder-schemas/src/default-emails.ts`](../../packages/builder-schemas/src/default-emails.ts)
  (registry) + [`default-emails-silica.ts`](../../packages/builder-schemas/src/default-emails-silica.ts)
  (bodies). Provisioned per-tenant on `module.activated`, per-site overridable, fully
  editable in `/builder/email`. **These are the ones the §2 redesign covers.** Adding
  one = a body factory in `SILICA_EMAIL_BODIES` + a registry entry in `TEMPLATES`.
- **Bucket B — platform React-Email templates.** ~16 coded templates in
  [`packages/email/src/templates/`](../../packages/email/src/templates/) composed in
  `<EmailLayout>`. Auth (OTP/magic-link/verification/reset), team-invite, welcome-merchant,
  partner-welcome, domain-renewal, forms ×2, jobs ×2, feedback-response, chat-notification,
  market-settlement-report, **+ the three sparx-billing templates (P4)**. **Not
  tenant-editable**; now on the unified frame (brand bar + tiered footer) as of **P5 🟡**.

### The trigger layer

A provisioned body **does nothing on its own** — something must fire it. Two paths:

- **System-automation seed** ([`packages/automation-actions/src/seeds/`](../../packages/automation-actions/src/seeds/)):
  a row installed on module activation whose action is `email.send_campaign` with a
  `builderEmailKey`. This is how abandoned-cart, post-purchase-review, the invoicing
  dunning ladder, B2B nudges, chat-satisfaction, win-back all send. Event- or
  schedule-triggered; the `module:'email'` gate holds the send until email is on.
- **Direct send** (`sendTenantEmailByKey`, [`services/api-rest/src/lib/tenant-email.ts`](../../services/api-rest/src/lib/tenant-email.ts)):
  a hard-coded call at the moment of the action. Used by order-confirmation
  (on payment, [`payment-webhook-reconcile.ts`](../../services/api-rest/src/lib/payment-webhook-reconcile.ts))
  and all of scheduling (bookings, waitlist, owner-notify).

---

## 2. Part 1 — base-design redesign ✅ (uncommitted)

**Status: COMPLETE, uncommitted.** All 22 bucket-A bodies rebuilt onto one polished,
**tenant-generic** base design; tests green; a fingerprint-gated refresh ships the
redesign to already-provisioned tenants without clobbering their edits.

**The base design language** (memory `project_transactional_email_redesign` has the full detail):
thin brand-color top bar → wordmark header → heading → short lead → a rounded, bordered,
theme-tinted **detail card** carrying a **semantic status cue** (`✓ Confirmed`/`Shipped`/`Past due`)
and one **emphasized hero datum** (large, brand-primary) → ONE centered primary button
(+ optional secondary text link) → reassurance → tiered footer. Line-item emails keep
`itemsTable` below the card. Everything derives from the tenant brand — nothing hardcoded to sparx.

**What shipped (all uncommitted, in the working tree):**

| Area                                                           | File                                                                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| The 22 redesigned bodies                                       | `packages/builder-schemas/src/default-emails-silica.ts`                                                  |
| Authoring kit (`detailPanel`/`button(align)`/`itemsTable` fix) | `packages/builder-schemas/src/silica-email-kit.ts`                                                       |
| Frame (brand bar + wordmark + tiered footer)                   | `packages/email/src/silica/frame.ts`                                                                     |
| Role-aware brand colors                                        | `packages/email/src/silica/brand-colors.ts`                                                              |
| Tenant webfont `<link>`                                        | `packages/email/src/silica/render-silica-email.ts`, `packages/site-themes/src/fonts.ts`                  |
| Footer-link resolution                                         | `services/api-rest/src/lib/email-data.ts`                                                                |
| Fingerprint refresh ("migration")                              | `packages/builder/src/services/email-default-refresh.ts`                                                 |
| Refresh wiring                                                 | `packages/builder/src/services/email-service.ts`, `services/api-rest/src/lib/email-provisioning.ts`      |
| Tests                                                          | `default-emails-silica.test.ts`, `email-default-refresh.test.ts`, `email-provisioning-reconcile.test.ts` |

**The refresh mechanism** (why existing tenants pick up the redesign): `bodyFingerprint`
is an id-stripped canonical sha256 of a body's `root.children`. `PRIOR_DEFAULT_BODY_FINGERPRINTS`
holds every past shipped body per key; a default row whose draft **and** published bodies
both hash into the prior set is replaced with the current design — anything edited is left
alone. Rides the same activation + 6-hourly reconcile path as `repairLegacyRows`, never a SQL
migration. **Going forward: when a default body is redesigned again, APPEND the outgoing
body's fingerprint to that key's set (never remove).**

**Requires silicaui 0.33** (email box-decoration/roles/webfonts).

---

## 3. Part 2 — coverage audit

Reading: does a business event that _should_ tell a person something actually send an
email today? A row is a **gap** when the event fires but no body+trigger pair exists.

### 3a. Covered (bucket A — tenant → customer) ✅

| Domain              | Keys                                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Commerce            | order-confirmation, shipping-confirmation                                                                                     |
| Marketing/lifecycle | welcome-customer, win-back, abandoned-cart, post-purchase-review, chat-satisfaction                                           |
| B2B                 | b2b-account-approved, b2b-quote-received, b2b-quote-expiring, b2b-invoice-due                                                 |
| Invoicing           | invoicing-reminder, invoicing-overdue (×3 ladder), invoicing-receipt                                                          |
| Scheduling          | booking-confirmation, booking-reminder, booking-rescheduled, booking-cancelled, waitlist-offer, booking-notification-internal |

### 3b. Covered (bucket B — platform) ✅ (design not unified — see §4 Phase 5)

Auth (login-otp, magic-link, email-verification, password-reset), team-invitation,
welcome-merchant, partner-welcome, domain-renewal-reminder, form-submission ×2,
job-application ×2, feedback-response, chat-notification, market-settlement-report.

### 3c. Gaps — events that fire with no email

| Event                                                         | Missing email                         | Layer(s) missing                                           | Priority   |
| ------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------- | ---------- |
| `order.cancelled`                                             | Order cancelled (customer)            | ~~body + trigger~~                                         | **P1 🟡**  |
| `order.refunded`                                              | Refund confirmation                   | ~~body + trigger~~                                         | **P1 🟡**  |
| `order.delivered`                                             | Delivered (+ review nudge)            | ~~body + trigger~~                                         | **P1 🟡**  |
| `order.payment_failed`                                        | Payment problem (customer)            | ~~body + trigger~~ (internal notification already existed) | **P1 🟡**  |
| `subscription.created`                                        | Subscription active                   | ~~body + trigger + merge-token vocab~~                     | P2 🟡      |
| `subscription.renewed`                                        | Renewal receipt                       | ~~body + trigger + vocab~~                                 | P2 🟡      |
| `subscription.payment_failed`                                 | Subscription payment failed           | ~~body + trigger + vocab~~ (internal notification existed) | P2 🟡      |
| `subscription.paused` / `.resumed` / `.cancelled`             | Subscription state changes            | ~~body + trigger + vocab~~                                 | P2 🟡      |
| `return.approved`                                             | Return approved (RMA + label)         | ~~body + trigger~~                                         | P3 🟡      |
| `return.received` / `return.refunded`                         | Return received / refunded            | ~~body + trigger~~                                         | P3 🟡      |
| B2B account declined                                          | Application declined                  | body + trigger — **needs a new event first** (none exists) | P3 (defer) |
| `b2b.order.approved` / `.rejected`                            | B2B order approval outcome (customer) | ~~body + trigger~~                                         | P3 🟡      |
| `dropship.order.*`                                            | Dropship status (mostly ops-facing)   | —                                                          | P4 (low)   |
| `partner.payout.paid`                                         | Partner payout notice                 | bucket-B body + trigger                                    | P4         |
| Domain lifecycle (verified / SSL issued / expiring / expired) | Beyond the renewal reminder           | bucket-B body + trigger                                    | P4         |

### 3d. Gap — the tenant's OWN sparx bill (platform → tenant, Layer 1)

~~The Stripe **billing** webhook sends **no email at all**.~~ **Addressed in P4 🟡:**
the webhook now emails the tenant a sparx-branded receipt, payment-failed notice, and
trial-ending notice. Still open (deferred): card-expiring + plan-changed.

---

## 4. Part 3 — build plan

Each new **bucket-A** email is three edits: (1) a body factory in `SILICA_EMAIL_BODIES`
on the base design, (2) a `TEMPLATES` registry entry (key/name/type/category/subject/
preheader/sources/refs), (3) a trigger — a new system-automation seed (`email.send_campaign`

- `builderEmailKey`) or a direct send. New keys provision automatically (the provisioner
  creates MISSING keys); **no fingerprint entry is needed for a brand-new key** — fingerprints
  only gate refreshing _existing_ rows.

### Phase 1 — commerce order lifecycle (closes the receipt asymmetry) 🟡 (code-complete, uncommitted)

**Shipped 2026-07-26** — four new bucket-A emails on the base design, each with body +
registry entry + legacy tree + trigger seed; `resolveOrder` extended with the three
tokens they need; tests green (builder-schemas 250, email 30, automation-actions 53),
typecheck + lint + prettier clean. Files touched:

- `packages/builder-schemas/src/default-emails-silica.ts` — 4 silica bodies + `SILICA_EMAIL_BODIES`
- `packages/builder-schemas/src/default-emails.ts` — 4 legacy trees + 4 `TEMPLATES` registry entries
- `services/api-rest/src/lib/email-data.ts` — `resolveOrder` now returns `refundTotal` · `deliveredAt` · `cancelReason`
- `packages/automation-actions/src/seeds/commerce.ts` — 4 `email.send_campaign` seeds (transactional)
- `packages/automation-actions/src/seeds/index.ts` — registered under `commerce`
- tests: `default-emails.test.ts` (22→26), `default-emails-silica.test.ts` (+2 order-lifecycle tests)

**Design as built** (matches the table below):

| Key               | Subject direction                         | Trigger                | Card hero + status                                                                    |
| ----------------- | ----------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------- |
| `order-cancelled` | Your order {{order.number}} was cancelled | `order.cancelled`      | Order total · status `Cancelled`/error · reason (optional row)                        |
| `order-refunded`  | Your refund is on the way                 | `order.refunded`       | **Refund amount** emphasize · status `Refunded`/success · method (optional)           |
| `order-delivered` | Your order was delivered                  | `order.delivered`      | Order · status `Delivered`/success · centered "Leave a review"                        |
| `payment-failed`  | There was a problem with your payment     | `order.payment_failed` | **Amount due** emphasize · status `Action needed`/warning · centered "Update payment" |

- Seeds live in `seeds/commerce.ts` (`COMMERCE_ORDER_{DELIVERED,CANCELLED,REFUNDED}_EMAIL`
  - `COMMERCE_PAYMENT_FAILED_EMAIL`), all `module:'commerce'`, transactional, each guarded
    by `customer.email is_set`. All four events are `ORDER_EVENTS` in the trigger resolver,
    so `customer.email` + the `order` refs resolve.
- Merge tokens: reused the `order.*` vocabulary; `resolveOrder` was extended with
  `refundTotal` (refund hero), `deliveredAt`, and `cancelReason` (optional card row).
  The payment-retry + view-order CTA both point at `{{order.statusUrl}}` (the customer's
  order page) — no new URL token invented.

### Phase 2 — commerce subscriptions 🟡 (code-complete, uncommitted)

**Shipped 2026-07-26** — six subscription lifecycle emails, the resolver chain built
end to end. The "blocked on a subscription source" note is resolved: the source now
exists on BOTH sides — the automation trigger resolver (`hydrateSubscription`) and the
dispatch-time data source (`resolveSubscription`).

Keys: `subscription-confirmed` (`subscription.created`), `subscription-renewed`,
`subscription-payment-failed`, `subscription-paused`, `subscription-resumed`,
`subscription-cancelled`. Files:

- `packages/automation/src/resolvers/builtins.ts` — `hydrateSubscription` + `SUBSCRIPTION_EVENTS` (hydrates the sub + its customer so `customer.email` resolves)
- `packages/automation-actions/src/email.ts` — `entityRefsFromFields` now carries `subscriptionId`
- `services/api-rest/src/lib/email-dispatch.ts` — passes `subscriptionId` into the dispatch `EmailRecipientRef`
- `services/api-rest/src/lib/email-data.ts` — `EmailRecipientRef.subscriptionId` + `resolveSubscription` data source (status · interval · amount · nextOrderDate · pausedUntil · currentPeriodEnd · manageUrl)
- `packages/builder-schemas/src/default-emails-silica.ts` + `default-emails.ts` — 6 bodies + trees + registry entries (`category: 'subscription'`)
- `packages/automation-actions/src/seeds/subscriptions.ts` (new) — 6 `email.send_campaign` seeds, `module:'commerce'`, registered in `seeds/index.ts`
- tests: `default-emails.test.ts` (26→32), `default-emails-silica.test.ts` (+1 subscription test)

Note: the Subscription model has no `propertyId`, so brand resolves from the customer's
site (or the tenant primary) — the same fallback welcome-customer uses. Fine.

### Phase 3 — returns / RMA + B2B outcomes 🟡 (code-complete, uncommitted)

**Shipped 2026-07-26** — five emails. Returns got their own `return` data source
(both resolver sides); B2B order outcomes reuse the `order` source.

- Returns (`module:'commerce'`): `return-approved` (`return.approved`),
  `return-received` (`return.received`), `return-refunded` (`return.refunded`).
  New `return` source: `hydrateReturn` (builtins — hydrates return → order → customer)
  - `resolveReturn` (email-data — status · outcome · refundAmount · refundMethod ·
    labelUrl · hasLabel). `EmailRecipientRef.returnId` + entity-ref + dispatch-ref wired.
    `return-refunded` supersedes the earlier "reuse order-refunded" idea — its hero is the
    return's own `refundAmount`, cleaner than the order-level refund total.
- B2B order outcomes (`module:'b2b'`): `b2b-order-approved` (`b2b.order.approved`),
  `b2b-order-rejected` (`b2b.order.rejected`) — both carry `orderId`, resolved through
  the existing `order` hydrator (registered in `B2B_ORDER_EVENTS`).
- Seeds: `seeds/returns.ts` (new, 3) + 2 added to `seeds/b2b.ts`; registered in `index.ts`.
- Registry: `default-emails.ts` (26→…, `category: 'return'`/`'notification'`) + silica bodies.
- Tests: `default-emails.test.ts` (32→37), `default-emails-silica.test.ts` (+1),
  `reconcile-seeds.test.ts` (B2B seed list + counts updated: 6→8 B2B, length 7→9).

**Deferred within P3:** `b2b-account-declined` — there is **no** `b2b.account.declined`
event today (only `credit_hold` / `suspended`). It needs a new event + publisher in the
B2B approval flow first; tracked as a follow-up rather than faked.

### Phase 4 — platform → tenant (sparx billing) 🟡 (code-complete, uncommitted)

**Shipped 2026-07-26** — three sparx-branded bucket-B React templates + webhook
publishes. Closes the "the Stripe billing webhook sends no email" gap.

- Templates (`packages/email/src/templates/`): `billing-receipt.tsx`,
  `billing-payment-failed.tsx`, `billing-trial-ending.tsx`, exported from `index.ts`.
- Registered across the three coded-template surfaces: `send.tsx` (union + render
  switch), `email-worker/handler.ts` (`TemplateSendSchema` zod variants), and the
  `EmailSendPayload.template` union in `packages/events/src/types.ts`.
- Webhook (`stripe-billing.ts`): resolves the tenant by `stripeCustomerId` (unique,
  non-RLS root) → billing email, then publishes `email.send` on
  `invoice.payment_succeeded` (receipt), `invoice.payment_failed` (dunning), and
  `customer.subscription.trial_will_end` (trial ending). Amounts formatted from the
  Stripe invoice; CTA is the hosted invoice page (receipt/failed) or the dashboard
  billing settings (trial).
- Tests: `packages/email/src/__tests__/templates.test.ts` (+3 render tests).

**Deferred:** card-expiring (Stripe doesn't emit a reliable event without extra
config) and plan-changed (lower value) — both are additive later. Long-tail
(partner-payout, domain-lifecycle) stays P4-adjacent, unbuilt.

### Phase 5 — unify bucket B onto the new frame 🟡 (code-complete, uncommitted)

**Shipped 2026-07-26** — done in ONE place: `packages/email/src/templates/_layout.tsx`,
the shared frame every bucket-B template (all ~19, incl. the new billing ones) composes.
Added the **thin brand-color top bar** and a **tiered footer** (tagline line over a
`WizeWorks · sparx.works` legal line) matching the silica redesign's frame, so a
person's password-reset now reads like their order-confirmation. Brand colors + fonts
already flowed via `BrandContext`; the change is purely the frame chrome, so it needed
no per-template edits. Test: a frame-cascade assertion in `templates.test.ts`.

**Deferred nicety:** injecting a webfont `<link>` into the bucket-B `<Head>` (the silica
frame does this for tenant brand faces). Bucket-B fonts resolve via CSS `font-family`
with system fallbacks today; a webfont link is additive and lower-value.

---

## 5. Working rules for this work

- **Silica-first, tenant-generic.** Every bucket-A body is built from the `silica-email-kit`
  helpers on the base design — no hardcoded sparx anything; visuals derive from the tenant brand.
- **A new key is not live until its trigger is wired.** Body + registry alone provisions an
  editable-but-never-sent template. Always land the trigger in the same slice.
- **Refresh fingerprints are for EXISTING keys only.** New keys need none; only append a
  fingerprint when _redesigning_ an already-shipped body.
- **Tests per slice:** a body render assertion (status cue + hero datum present) and, where a
  trigger seed lands, its presence in `SYSTEM_AUTOMATIONS`.
- Uncommitted; user handles commits.

---

## 6. Live verification (2026-07-26, on the Template tenant)

Drove the deployed workbench email studio (WizeWorks tenant → Template site) after the
first deploy.

**Confirmed working:**

- **Provisioning:** the 15 new keys were absent at first because the backfill reconcile
  is a 6-hour loop whose first tick is `boot + 6h` (`RECONCILE_INTERVAL_MS`, first
  `setTimeout` at boot). Toggling the email module off/on fired `module.activated` →
  `provisionDefaultEmails`, and **all 15 appeared immediately**. Provisioning is solid;
  the delay is just the timer.
- **Design renders correctly.** Previewed `order-refunded` + `subscription-confirmed`:
  ember brand bar → heading → the rounded tinted **card with the semantic status cue**
  (`✓ Refunded` / `✓ Active`) → ember CTA → reassurance line. The redesign is intact for
  the new emails.

**Bugs found + fixed (uncommitted):**

- **P4 billing CTA was doubly broken:** it pointed at `/settings/billing` on
  `https://sparx.works` (the _marketing_ site — api-rest's `SPARX_DASHBOARD_URL` has no
  default, so the fallback was wrong) **and** no such route existed. Fixed: the fallback
  now defaults to `https://app.sparx.works` (matching `services/domain-worker`), and a new
  redirect route `apps/workbench/app/settings/billing/page.tsx` translates `/settings/billing`
  → the `finance.subscription` pane ("Your sparx bill"), per the readable-path convention.
- **P2 subscription CTA → `/account/subscriptions` (storefront) 404'd** — no such page.
  Repointed to `/account` (exists) as a non-dead interim. **Follow-up:** a real customer
  `/account/subscriptions` storefront page (skip / change date / pause / cancel) — the
  feature the copy promises — does not exist and should be built.

**Open, needs verification / decision:**

- **Wordmark showed "sparx", not the tenant brand,** in the studio preview (brand bar +
  button were ember = sparx primary too). Likely the preview rendering with sparx defaults
  rather than injecting tenant brand — needs a real test-send to confirm the send path
  resolves the tenant logo/name. 🔎
- **Stale data on the Template tenant (pre-existing):** duplicate rows — both
  `Appointment confirmation/reminder/cancelled` (old) and `Booking …` (new), plus four
  `Welcome` entries. Orphans from the appointment→booking rename + welcome seeding; a
  cleanup pass is warranted.
- **The redesign does NOT auto-apply to seeded/edited rows** (by design — the
  fingerprint refresh won't clobber non-pristine rows). A tenant like Template whose
  defaults were seeded custom will keep old bodies unless explicitly reset.

## 7. Email studio ↔ Preview fidelity (2026-07-26)

Question raised: "why is the builder not rendering the email like our preview does — is
that silicaui's fault?" **Answer: not silicaui's fault.** The divergence was two things,
one ours (now fixed), one a genuine silica gap.

**How brand colour reaches the canvas (verified end-to-end in silicaui 0.33):** every
default-email node carries `*Auto` flags + optional `*Role` (`silica-email-kit.ts`).
silica's `EmailBuilder` runs `editor.setColorDefaults(resolveEmailColorDefaults(theme))`
on every `theme` change, which **repaints every node still on its default** (`<field>Auto
=== true`), resolving each node's role via `AUTO_COLOR_FIELDS` (button bg → `primary`,
section bg → `base100`, …). Those defaults are **identical** to the send's
`applyBrandColors` (`@sparx/email/silica/brand-colors.ts`) role map. So canvas colour ==
send colour **iff** `resolveEmailColorDefaults(canvasTheme)` == `roleMap(sendBrand)`.
`resolveEmailColorDefaults` reads `--color-{primary,base-100/200/300,base-content,success,
warning,info,error,…}` off the theme tokens (`silicaui-html` `colorValue`), and
`compiledToSilicaTheme` emits all of them.

**Fix 1 — colour parity (ours).** The compiled theme's semantic tokens
(`--color-success` etc.) differ from the send's **FIXED** semantic constants (a success is
green for everyone). The email studio now overlays `EMAIL_SEMANTIC_TOKENS` (= the send's
`SEMANTIC`, duplicated with a keep-in-sync note) onto the canvas theme, so the status cues
(`✓ Confirmed` green, warning amber, error red) and the brand button/tint paint on the
edit canvas exactly as the Preview/send does — not silica's neutral `DEFAULT_EMAIL_COLORS`
(whose `primary` is `#111827`, the "black button" that was showing through).

**Fix 2 — one toolbar (ours), mirroring the site Editor.** The studio previously stacked
its own `PaneToolbar` **above** `<EmailBuilder>` (two headers). silica's `EmailBuilder`
exposes `toolbarSlot` for exactly this (added to mirror the site `<Builder toolbarSlot>`);
the switcher, lifecycle (rename/new/delete/customize), status badge, and Preview/Publish/
Save now ride in silica's own editor header — structurally identical to
`studio-surface.tsx`. `apps/workbench/surfaces/builder/email/email-editor.tsx`.

**Fix 3 — the FRAME, now CLOSED (silicaui 0.34).** The brand bar + wordmark + tiered
legal footer are composed at **send** by `composeSendDocument` (`@sparx/email/silica`),
deliberately **outside** the editable body (so an author can't delete the compliance
footer and the frame always reflects the current per-site brand). Originally the email
`EmailBuilder` had **no frame concept at all** and no locked/pinned section, so the canvas
couldn't show it — a genuine silica gap. **silicaui 0.34 shipped the fix we specified: an
`EmailBuilder`/`EmailCanvas`/`EmailPreview` `frame` prop** — host-owned `EmailFrame`
(`{header: SectionNode[], footer: SectionNode[], label}`) that renders ABOVE/BELOW the
authored body as **inert, un-editable chrome** (no selection/drag/edit, never enters the
document, re-supplied every mount), plus `composeEmailDocument(doc, frame)` for the send
path. Wired in:

- `packages/email/src/silica/frame.ts` — extracted **`buildEmailFrame(opts): EmailFrame`**
  as the SINGLE source of truth (brand bar + wordmark → `header`, tiered footer →
  `footer`); `composeSendDocument` now splices that same frame, so send and canvas can't
  diverge. Exported from `@sparx/email/silica` (+ `EmailFrame` type re-export).
- `packages/email-platform/src/services/builder-email-service.ts` — `buildFrame(ctx,
propertyId, footerLinks)` resolves the active site's brand (`resolveEmailBrand`, same as
  the preview/send) → `buildEmailFrame`.
- `services/api-rest/src/routes/v1/builder/emails.ts` — `GET /v1/builder/emails/frame`
  (static route, matched ahead of `/:id`) resolves footer links (`resolveEmailFooterLinks`)
  - returns the frame.
- workbench `email-data.ts` `useEmailFrame()` + `email-editor.tsx` passes
  `frame={frame.data}` to `<EmailBuilder>` (a live render prop — streams in, no mount gate).

The catalog was bumped `^0.33.0 → ^0.34.0` (all 11 `@wizeworks/silicaui*` entries) and
installed. **Net: the edit canvas now shows the full email — brand bar, wordmark, branded
body (colours + semantic status), and the legal footer — matching the Preview/send, with
the frame still un-deletable and always current-brand.**
