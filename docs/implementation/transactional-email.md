# Transactional email — coverage + build tracker

Version: 1.7
Author: Brandon Korous
Last Updated: 2026-07-28

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

## 8. Live-send quality pass (2026-07-26) — spacing, footer, canvas colours

A real test-send to a Gmail inbox (Template tenant) surfaced three defects the canvas
diagnosis had partly hidden. All fixed + verified by rendering the redesigned bodies with
a real Playwright screenshot (ember-brand tenant, full compliance) before shipping.

1. **Cramped vertical rhythm (systemic).** `copyBlock` stacked heading → lead → button in
   one section with NO gap between blocks — the projector gives siblings no rhythm of
   their own, so they rendered touching. Fixed: a `spaced()` helper interleaves a
   `spacer(16)` between every pair of `copyBlock` children (edges left to the section's
   `paddingY`). `packages/builder-schemas/src/silica-email-kit.ts`.
2. **Bare footer ("business name" and nothing else) on test-send + preview.** The footer
   chrome composed, but the account/contact/legal `footerLinks` were only passed on the
   live automation path — `renderPreview` + `prepareTestSend` called the renderer without
   them. Fixed: both now take `footerLinks`, and the routes resolve them
   (`resolveEmailFooterLinks`) and pass them through. `builder-email-service.ts` +
   `services/api-rest/src/routes/v1/builder/emails.ts`.
3. **Canvas colours fell to silica's neutral defaults entirely** (black button, dark
   status — not just the button). Root cause: the canvas theme came from the site PAGE
   theme (`compileThemeForTenant`), which for this site resolved to nothing → silica's
   `DEFAULT_EMAIL_COLORS`. Fixed: the `/v1/builder/emails/frame` endpoint now returns
   `{ frame, colors }` where `colors` is the send's OWN role→hex map
   (`emailBrandColorDefaults` = `applyBrandColors`'s `roleMap`); the studio builds the
   canvas theme from `colors`, so `resolveEmailColorDefaults(canvasTheme)` === the send
   map and the canvas repaints in exactly the inbox colours. Endpoint response +
   `buildFrame`→`buildChrome`, workbench `useEmailFrame`→`useEmailChrome`.

**Rollout to existing tenants.** The `copyBlock` change alters every body's fingerprint,
so `PRIOR_DEFAULT_BODY_FINGERPRINTS` was regenerated: the currently-deployed (pre-spacing)
fingerprint for ALL 37 keys is appended (the 15 P1–P5 keys had NO prior entry at all — a
pre-existing gap that failed the "every key covered" test, since tests aren't in the
pre-push guard). Pristine default rows now refresh to the spaced design on the next
activation / 6-h reconcile; edited or custom rows are untouched. **Caveat:** a tenant that
CUSTOM-authored an email (e.g. Template's "Maren & Wilde" welcome) is not pristine, so it
keeps its authored body — it must be re-authored or reset to pick up the new defaults.

All green: builder-schemas 250, builder 68 (refresh test now passes), email 34,
email-platform 10; typecheck + lint clean across builder(-schemas)/email(-platform)/
api-rest/workbench.

## 9. Email-builder "10/10" initiative (2026-07-27)

A standing goal: make the workbench email builder best-in-class. An inventory scored
seven dimensions; personalization (loops via `itemsTable`, conditionals via `when`,
15 sources, fallbacks) and template breadth (37 defaults) already score 8–9. The weak
axis is **pre-send confidence (5/10)** — the studio could render but not _check_.

### Slice 1 — "Preview & Check" (shipped, uncommitted)

The Preview dialog became **Preview & check**: a device toggle (desktop 600px / mobile
375px), a **plain-text view** (the `text` part was rendered but never shown), and a
collapsible **pre-send checklist**.

- New `@sparx/email/silica` export `lintEmailRender({ doc, html, subject, preheader })`
  → `EmailCheck[]` ([lint.ts](../../packages/email/src/silica/lint.ts)). Six always-on
  categories (so it reads as a checklist, green when clean): subject, preview text,
  links (dead `#`/empty → error; `example.com` → warning), image descriptions (missing
  alt), personalization tags (unknown source root → error), and **email size** (Gmail's
  ~102 KB clipping cliff). Copy is written for a non-technical owner.
- Runs server-side in `renderPreview` (needs the real projected byte size); `checks`
  rides on `RenderedPreview` → the `/preview` route → the studio dialog.
- **Calibration:** validated against all 37 shipped defaults (zero findings) AND a
  deliberately-broken email (catches every issue). No check may false-positive on our
  own templates.

### Finding — the merge-tag catalog is a SUBSET of what the resolver resolves

Building the tag check surfaced a real gap: `EMAIL_SOURCES` (the flat catalog driving
autocomplete + the merge-tag picker) does **not** include `subscription.*` or `return.*`
— yet `resolveSubscription`/`resolveReturn` ([api-rest email-data.ts](../../services/api-rest/src/lib/email-data.ts))
resolve them at send, and the subscription-_/return-_ templates use them. Same for
resolver-only order fields (`order.shippingAddress`, `order.deliveredAt`,
`order.cancelReason`, `order.refundTotal`) and `booking.newHeadline`. So the tokens DO
resolve — they're just undiscoverable in the author's picker, and can't be field-validated.
The tag check is therefore **root-level only** for now (catches `{{oder.total}}`, misses
`{{customer.frstName}}`). **Follow-up:** complete `EMAIL_SOURCES` to match the resolver,
which (a) puts those tags in autocomplete and (b) unlocks accurate field-level validation.

### Remaining roadmap (impact-ordered)

2. Dark mode, actually designed — ship `@media (prefers-color-scheme: dark)` CSS in the
   send `head` (today `colorScheme:'light dark'` is declared but no dark CSS ships).
3. Complete the merge-tag catalog (the finding above) + persistent saved blocks
   (`useSavedBlocks` is unwired to the server) + richer palette via `host.catalog()`.
4. Binding diagnostics surfaced in-canvas (`host.onDiagnostic`) + in-inspector merge-tag
   picker (`host.inspectorPanels`).
5. Email version history / rollback + re-enable local crash-recovery (`persistKey`).

## 10. Slice 2 — dark mode, aligned to the site (2026-07-27, uncommitted)

Dark mode was **declared** (silica emits the `color-scheme`/`supported-color-schemes`
`<meta>` pair + `:root` rule) but not **designed** — on a dark-mode client the email
showed its light design on a dark screen. Now it renders the tenant's own **site dark
theme**, per Brandon's direction ("our brand defines the light and dark theme for the
site, and the emails should align to the site").

**How.** silica's `EmailBody.colorScheme` doc delegates the dark DESIGN to the host,
"supplied via the projector's `head.css` hook". The projected HTML has no class hooks
(only `.sui-col`), so the block remaps **by value**: for each neutral the light render
used, a rule keyed to that exact hex — as a `bgcolor="…"` attribute or a `color: …`
inline-style substring — overrides it to the brand's dark counterpart. Because the light
hexes come from the same role map the projector paints with, the selectors match by
construction; brand hues that don't shift and the fixed semantic colours emit no rule
and survive.

**Wiring.**

- `BrandTokens.dark?: BrandDark` ([brand.tsx](../../packages/email/src/components/brand.tsx))
  — the site's dark neutrals (+ optional dark brand hue). `defaultBrand.dark` carries the
  sparx default theme's dark neutrals so even an unbranded send renders a real dark theme.
- `brand-service` ([brand-service.ts](../../packages/email-platform/src/services/brand-service.ts))
  now compiles BOTH modes (`compileTokens(key, { light: overlay, dark: overlay })`) and
  attaches `dark` — so the email dark palette IS the site's dark palette.
- `emailBrandDarkColorDefaults(brand)` ([brand-colors.ts](../../packages/email/src/silica/brand-colors.ts))
  builds the dark role map (unset brand hues fall back to light → unmapped).
- `buildDarkModeCss(light, dark)` ([dark-mode.ts](../../packages/email/src/silica/dark-mode.ts))
  emits the `@media (prefers-color-scheme: dark)` block; `render-silica-email` feeds it via
  `EmailHeadExtras.css`.

**Verified:** default brand → surfaces `#FFFFFF→#0b1120` / `#F8FAFC→#111827`, text
`#0F172A→#e2e8f0`, borders → dark, sparx accent preserved; a branded tenant additionally
shifts its hue to the site's dark value (`#4f46e5→#6366f1`). Selectors match the rendered
hexes exactly (case preserved). Email 37 tests (+3 dark-mode) + email-platform 10 green;
typecheck + lint + prettier clean.

**Seeing it — Light/Dark preview toggle.** Dark mode is invisible in the light canvas,
so Preview & Check gained a **Light/Dark toggle** (shown only when the brand has a dark
palette). An iframe can't be forced to report a dark OS preference, so `renderPreview`
also returns the dark rules UNGATED (`darkModeRules`, no `@media`); the dialog strips the
send's `@media` block for a deterministic light view, and injects the ungated rules for
dark — so the owner sees the exact dark theme a dark-mode client renders, regardless of
their own OS. `darkModeRules`/`buildDarkModeCss` split in `dark-mode.ts`; `darkCss` on the
preview response → `EmailPreview` → `previewSrcDoc` in the studio.

**Known refinement (not blocking):** the fixed semantic status colours (success green,
etc.) are NOT remapped for dark — the theme system models no dark semantics, so remapping
would mean inventing colours. On a dark surface a mid-dark green reads dimmer than ideal;
lightening semantics in dark is a follow-up once the theme system carries dark semantics.
Gmail / Outlook.com force-invert regardless — dark mode remains progressive enhancement.

## 11. Slice 3 — merge-tag catalog completed + field-level validation (2026-07-27, uncommitted)

The pre-send **Personalization tags** check (Slice 1) could only validate a token's
_source root_ (`{{oder.total}}` → unknown source). It could NOT validate the _field_
(`{{order.totl}}`), because the send-time resolver (api-rest `email-data.ts`) resolved
MORE than the binding catalog (`EMAIL_SOURCES` in
[binding.ts](../../packages/builder-schemas/src/binding.ts)) declared — so field-checking
would have flagged our own shipping templates. A check that false-positives on our own
defaults is worse than no check, so Slice 1 stayed root-only and flagged the gap.

**The gap, closed.** `EMAIL_SOURCES` now mirrors the resolver EXACTLY:

- **`subscription`** source added (status / interval / amount / itemCount / nextOrderDate /
  pausedUntil / currentPeriodEnd / manageUrl) — mirrors `resolveSubscription`.
- **`return`** source added (status / outcome / refundAmount / refundMethod / labelUrl /
  hasLabel / manageUrl) — mirrors `resolveReturn`.
- **`order`** gained `refundTotal` / `deliveredAt` / `cancelReason` / `shippingAddress`.
- **`booking`** gained `newHeadline` / `pendingApproval`.

Side benefit: those tags now appear in the author's `{{` autocomplete, the Merge tags
reference panel, and the MCP `list_merge_tags` tool — they resolved at send but were
invisible to authors before.

**Field-level validation, now on.** `checkMergeTags`
([lint.ts](../../packages/email/src/silica/lint.ts)) builds its vocabulary straight from
`EMAIL_CATALOG`, so a new source/field is covered the moment it lands — no second list.
Rules: an unknown ROOT is a source typo; a known OBJECT source with an unknown FIELD is a
field typo; both render blank, so both are errors. ARRAY sources (products, CMS
collections) and LOOP aliases (`item`, `items`, `product`, `commerce`, `cms`) iterate —
their fields belong to the loop's record, not the flat catalog — so those roots are
validated at the root only. The historical `tenant` alias reuses `site`'s fields plus the
back-compat `siteUrl`/`storeUrl` URLs.

**Verified.** Every shipped default's token maps to a catalog field, so the
`lint.test.ts` "every shipped default passes clean" tripwire stays green; a new case
proves a field typo (`{{customer.frstName}}`) errors while a loop token (`{{item.…}}`)
stays clean. builder-schemas 250, email 42 (+1), email-platform 10 — all green;
typecheck + lint + prettier clean.

## 12. Slice 4 — richer Insert palette (curated content blocks) (2026-07-27, uncommitted)

The Email Builder's Insert palette was the bare 8 silica primitives (text, image,
button, divider, spacer, columns, social, html/video). A best-in-class builder also
offers **pre-composed content blocks** — a summary card, a call to action, a callout —
so an author drops a polished, on-brand section in one move instead of hand-assembling
section → border → radius → rows → spacers. Slice 4 adds them.

**What's available already (not rebuilt).** Confirmed against the installed `@wizeworks/
silicaui-builder@0.34.2` type surface: the workbench already passes a full
`EmailBuilderHost` — `resolveBinding`/`resolveCollection` (live data resolution in the
canvas) + `dataSources()` (the real binding picker). So the binding picker, live
resolution, and `{{` autocomplete are wired. `host.onDiagnostic` (an earlier roadmap
note) **does not exist** in 0.34.2 — it's a silicaui ask, not something to build here.

**What Slice 4 adds — `host.catalog()`.**

- `EMAIL_CONTENT_BLOCKS` ([email-content-blocks.ts](../../packages/builder-schemas/src/email-content-blocks.ts))
  — four curated `EmailPaletteItem`s (Text block, Summary card, Call to action, Callout),
  each a single pre-composed section built from the `silica-email-kit` factories, keyed
  `sx-*` so they never clash with a built-in.
- Wired via `host.catalog = () => ({ extend: EMAIL_CONTENT_BLOCKS })` in
  [email-editor.tsx](../../apps/workbench/surfaces/builder/email/email-editor.tsx) —
  MERGE semantics, so these ADD to silica's built-in catalog rather than replace it.
- `calloutCard(children)` added to the kit — a tinted, bordered card wrapping free
  content (the marketing twin of `detailPanel`). Both now share one `CARD` box-decoration
  constant, so the card look is defined once (the `detailPanel` refactor is byte-identical
  — the shipped-default render assertions are unchanged).

**Two silica guarantees make it safe + on-brand for free:** `EmailEditor.insert` runs
`stampIds` which RECURSES over the whole inserted subtree, so a composed block's authored
`def-` ids never collide (even dropped twice); and every colour is a neutral default
paired with its `*Auto` flag, so `setColorDefaults` (editor) and the send's brand pass
repaint each block in the tenant's own theme. Copy is deliberately placeholder — a
starting layout to overwrite, carrying no data binding (the author personalizes via the
binding picker or `{{tokens}}`).

**Verified.** New `email-content-blocks.test.ts` (2 cases): every block is a single
top-level `section` with a unique `sx-` key; `make()` yields fresh, internally-unique ids
each call (the layer-drag / React-key footgun). builder-schemas 252 (+2), email 42
(kit refactor byte-identical), workbench typecheck + lint clean; prettier clean.

## 13. Slice 5 — email version history / rollback (2026-07-27, uncommitted)

`publishSilica` was a one-way overwrite: `silica_published_document` held exactly the last
publish, so there was no answer to "what did this email look like before I published that
change", and no way back from a bad publish except re-authoring by hand — the worst
position for a non-technical owner who just pushed a mistake to a LIVE transactional email.
The SITE builder already solved this (docs/126: `builder_releases` + content-addressed
`builder_page_artifacts`); Slice 5 mirrors that convention onto emails.

**New table — `builder_email_versions`** (append-only, tenant-scoped + FORCE RLS,
[schema](../../packages/db/prisma/schema/51-builder.prisma) +
[migration](../../packages/db/prisma/migrations/20270119000000_builder_email_versions/migration.sql)).
One row per publish: the full silica `EmailDocument` snapshot, content-addressed by `hash`
(reusing artifact-service's `hashTree`/`canonicalJson`) for no-op dedupe, plus a
denormalized `subject` + `actor_id`. Simpler than the site's release/manifest tables
because an email is ONE self-contained document — no multi-tree manifest. A dedicated
table (not the property-scoped site tables) because an email's `property_id` is nullable
(tenant-wide defaults). `tenant_id` is a scalar + hand-SQL FK, so no back-relation is
forced onto `Tenant`; cascade rides the email FK. Additive — no backfill, no FORCE-RLS
backfill footgun; history begins accumulating from the next publish.

**Service** ([email-version-service.ts](../../packages/builder/src/services/email-version-service.ts)):
`captureEmailVersionTx` (seals the just-published doc inside `publishSilica`'s transaction,
skips a byte-identical no-op republish) + `listEmailVersions`. **Restore lives in
`emailService.restoreEmailVersion`** (it returns a full email DTO; keeping it there avoids
an import cycle) and is deliberately **NON-DESTRUCTIVE and to the DRAFT** — it loads the
chosen version onto `silica_draft_document` for the author to review in the studio and
re-publish. An email goes to real inboxes, so a restore never silently republishes (unlike
the site's republish-forward). Both `publishSilica` capture and restore write an audit log.

**Routes** ([emails.ts](../../services/api-rest/src/routes/v1/builder/emails.ts)):
`GET /v1/builder/emails/:id/versions` + `POST …/:id/versions/:versionId/restore`.

**Studio** ([email-editor.tsx](../../apps/workbench/surfaces/builder/email/email-editor.tsx)):
a **History** button (shown once an email has been published) opens a dialog listing every
published version newest-first, each with a **Restore** action behind a confirm ("nothing
goes live until you Publish"). The live version is badged "Live now". Restore pushes the
returned draft into the query cache, resets the seed guard, and bumps a remount key so
`<EmailBuilder>` re-mounts on the restored draft. `useEmailVersions` is lazy (fetched only
when the panel opens).

**Deliberately NOT done — local crash-recovery (`persistKey`).** The earlier roadmap paired
this with version history, but re-enabling silica's local IndexedDB draft recovery now
CONFLICTS with the server-owned draft model: on mount it would restore a stale local draft
over the server draft — including over a just-restored version or another device's save.
The studio already guards navigation loss (explicit Save + dirty leave-guard), so
`persistKey` stays `null`; genuine crash-recovery would need conflict resolution against the
server draft and is a separate, deliberate follow-up.

**Verified.** `prisma generate` run (user-authorized; dev down) so the new model's types
resolve. @sparx/db, @sparx/builder, @sparx/api-rest, @sparx/workbench typecheck clean;
builder 68 tests + builder-schemas 252 + email 42 pass; lint + prettier clean. **Operational
note:** the migration is authored as a file (applies in prod via the DB Migrate workflow);
the migration was ALSO applied to LOCAL docker (`prisma migrate deploy`, user-authorized) —
`builder_email_versions` exists locally with `rls=true force=true` + the tenant-isolation
policy (verified), so the local publish path works.

## 14. Slice 6 — deeper Preview & Check (deliverability + accessibility) (2026-07-27, uncommitted)

The pre-send checklist (Slice 1) had six checks. Slice 6 deepens the "confidence before
send" pillar — the original weakest dimension — with three more, each **calibrated against
all 37 shipped defaults so it never false-positives** (the `lint.test.ts` "every shipped
default passes clean" tripwire stays green):

- **Subject length** (folded into the existing Subject row, no new row): warns when the
  subject is long enough that inboxes truncate the end (~90 chars). `{{tokens}}` are counted
  at a nominal RENDERED width, so a token-heavy but visually short subject isn't flagged.
  Longest real default subject ≈ 63 chars → all pass.
- **Link wording** (new `link-text` row, accessibility): warns on a link/button label that
  doesn't say where it goes ("click here", "here", a bare URL) — worst on a screen reader,
  which reads links out of context. A tight vague-label set, so a real CTA ("View your
  order", "Read more") is never flagged; every shipped CTA is descriptive → all pass.
- **Text and images** (new `image-text` row, deliverability + readability): warns on an
  image-heavy, text-sparse email (inboxes block images by default and spam filters distrust
  image-only mail, so it can arrive blank). Only fires with content images present AND < 40
  chars of copy; the wordmark/footer live in the host frame (not walked), and the defaults
  are text-led → all pass.

All in [lint.ts](../../packages/email/src/silica/lint.ts); the studio checklist renders the
new rows with no UI change (it maps `EmailCheck[]` generically). **Verified:** email 45
tests (+3: long-subject warns / token-subject passes, vague-vs-descriptive link label,
image-only email); the shipped-default tripwire green with 8 rows now; typecheck + lint +
prettier clean.

## 15. Slice 7 — pick a picture from the library (media picker) (2026-07-27, uncommitted)

The email builder's image fields were plain URL inputs — an author had to paste an image
URL, a technical act every other builder surface (CMS, site, commerce) spares them with the
shared media browser. **This turned out NOT to be a silicaui ask** (contrary to an earlier
assumption): silica's email host has no `pickAsset`, but it exposes `inspectorPanels?(node)`
whose `ctx.update()` writes through the engine's own mutation path — a host panel on the
asset-bearing kinds is all a picker needs (docs/120 §6 already noted this; the dashboard had
built one, the workbench had not).

- [email-asset-panel.tsx](../../apps/workbench/surfaces/builder/email/email-asset-panel.tsx)
  (new) — `emailInspectorPanels(node)` returns a **Picture** panel on `image` (writes `src`),
  `video` (writes `thumbnail`), and `section` (writes `bgImage`); each shows the current
  picture + a Choose/Change button (and Remove for the optional thumbnail/background). It
  writes the picked asset's **URL** (a mail client fetches cross-origin — an id is meaningless).
- Wired into the host as `inspectorPanels: emailInspectorPanels`, and `<EmailBuilder>` is
  wrapped in `<MediaPickerProvider source="marketing">` so the panel resolves the SAME
  `useMediaPicker()` browser the CMS/site/commerce fields use (uploads file under Marketing).
  The panel renders above the built-in Settings; the built-in URL field stays, so a pasted
  URL still works.

**Verified:** workbench typecheck + lint + prettier clean. (Reused the proven `MediaPicker`,
so no new screenshots per the verify-by-typecheck rule.)

### The one genuine remaining silicaui ask — server-persistable saved blocks

Everything else on the "10/10" list is now in our control and built. The single feature that
truly needs a silicaui change is **persisting "saved blocks" to the account** (best-in-class
reusable content blocks that sync across devices/users). Raised with WizeWorks; their design
review corrected two facts below and reshaped the API — this section reflects the **agreed
design**, not the original request.

- **Today:** `<EmailBuilder>`'s `useSavedBlocks()` persists `SavedBlock[]` (`{id, name, node,
savedAt}`) to **browser `localStorage`** (key `silicaui-email-saved-blocks`) — NOT IndexedDB,
  which is the separate _draft-autosave_ (`persistKey`) path. Exposed via `getSavedBlockNode`
  (a non-hook accessor the Canvas uses to resolve `saved:<id>` drags outside React render) + a
  "Saved" section in the Insert palette. There is **no host seam** to observe or redirect that
  persistence, so a saved block survives a reload but not a device or user change, and can't be
  shared. WizeWorks frames this as an inconsistency in their OWN contract (the only authoring
  artifact a host cannot persist), so it qualifies on universal merit — not a sparx-specific ask.
- **Agreed design — a CONTROLLED collection** (matching the `document`/`onChange(project, ops,
meta)` idiom the builder already uses, NOT a set of write callbacks):

  ```ts
  savedBlocks?: readonly SavedBlock[];              // present → host-owned (controlled)
  onSavedBlocksChange?(
    next: SavedBlock[],                             // resulting optimistic list
    change:
      | { type: 'save'; block: SavedBlock }
      | { type: 'rename'; id: string; name: string }
      | { type: 'delete'; id: string },
  ): void;
  ```

  Omit `savedBlocks` → today's local behavior, byte-for-byte (no forced migration). Supply it →
  the host owns the list, persists to its backend, and re-renders with the authoritative array —
  so **server-assigned ids, failed saves, and cross-device sync all just work**, because the
  array is the single source of truth rather than a shadow copy. One intent arg covers all three
  verbs. Plus an exported `readLocalSavedBlocks()` so a host can one-time-migrate a user's
  existing browser-local blocks on first login instead of orphaning them.

  > This SUPERSEDES the originally-requested `savedBlocks?()` + `onSaveBlock?`/`onRenameBlock?`/
  > `onDeleteBlock?` shape. That was a "half-seam": fire-and-forget writes into an async backend,
  > with no path for the server's id to come back, no way to surface a failure, and drift when the
  > host's list and the builder's optimistic list disagree. The controlled prop fixes all of that.
  > (The original ask also wrongly cited "the site builder persists symbols via host callbacks" —
  > it does not: `Site.symbols` is document-scoped and flows through `onChange`, which actually
  > argues FOR the controlled-collection shape.)

- **Implementation wrinkle (theirs):** `getSavedBlockNode()` reads the module store directly for
  outside-render drag resolution, so under a controlled list that store must be kept mirrored
  from the prop (a `useEffect` sync) or a host block's drag-insert returns undefined. Their
  scoped estimate: ~half a day incl. tests, on the silica side.
- **Our side (the other half):** consuming it is a Slice-5-shaped build — a new tenant-scoped
  `SavedBlock` table + REST + wiring the controlled prop (fetch the tenant's blocks, pass them in,
  persist on `onSavedBlocksChange`, reconcile the server id back into state).
- **Also raised, deliberately DECOUPLED:** WizeWorks offered the same seam for the SITE builder's
  symbols (a multi-site tenant can't share symbols across the account today, since `Site.symbols`
  is per-property/document-scoped). That's a separate data-model decision on our side, not to be
  bundled into this ask.
- **Workaround:** none clean — the store is silica-internal. Not blocking; local-only saved
  blocks still work within a session/device.

This is the successor to the closed 0.33/0.34 asks (frame, `toolbarSlot`, subject/preheader
relocation). **✅ Delivered in silicaui 0.35.0** exactly as designed above — the controlled
`savedBlocks` prop, `onSavedBlocksChange(next, change)`, the `SavedBlockChange` intent union,
`readLocalSavedBlocks()` + `clearLocalSavedBlocks()` migration seam, and a `getSavedBlockNode()`
that now reads the host-owned list when one is mounted. Our side is built in **§17 (Slice 9)**.

## 16. Slice 8 — "unpublished changes" indicator (2026-07-27, uncommitted)

A published transactional email keeps sending its LAST published version while an author
edits + saves the draft — so a saved edit isn't live until the next Publish. Nothing signalled
that gap ("I changed it, but did customers get it?"). Slice 8 surfaces it.

- `BuilderEmailDto.hasUnpublishedChanges` ([email.ts](../../packages/builder-schemas/src/email.ts))
  — computed in `toDto` ([email-service.ts](../../packages/builder/src/services/email-service.ts))
  as `published && canonicalJson(draftDoc) !== canonicalJson(publishedDoc)` (reusing
  artifact-service's canonical encoding, so key-order / round-trip noise never counts as a
  change). Always false for an unpublished email — the `published:false` state says that already.
- The studio ([email-editor.tsx](../../apps/workbench/surfaces/builder/email/email-editor.tsx))
  shows a soft **"Unpublished changes"** warning badge beside the Published badge when the flag
  is set; it clears on Publish (draft == published) via the normal query invalidation.

**Verified:** builder-schemas 252 + builder 68 tests pass; builder / builder-schemas /
workbench / api-rest typecheck + lint + prettier clean.

## 17. Slice 9 — server-backed saved blocks (2026-07-27, uncommitted)

The §15 silicaui ask shipped in **0.35.0**, so this closes the last item on the "10/10" list
that needed an external change. The tenant's saved-block library moves from silica's browser
`localStorage` (trapped in one browser, lost on a device/user change, unshareable) to an
**account-level, server-backed library shared tenant-wide** via silica's `savedBlocks`
controlled prop.

- **Install:** catalog bumped `^0.34.2 → ^0.35.0` for all 11 `@wizeworks/silicaui*` packages
  ([pnpm-workspace.yaml](../../pnpm-workspace.yaml)); `pnpm install` clean; the three consumers
  (workbench / email / builder-schemas) typecheck against 0.35.0 with no incidental breakage.
- **DB:** new `BuilderEmailBlock` model + `builder_email_blocks` migration
  ([51-builder.prisma](../../packages/db/prisma/schema/51-builder.prisma),
  [20270120000000_builder_email_blocks](../../packages/db/prisma/migrations/20270120000000_builder_email_blocks/migration.sql))
  — tenant-scoped `{ name, node (JSONB), actorId }`, FORCE RLS + `tenant_isolation`, `tenant_id`
  as a scalar + hand-SQL FK (no back-relation on Tenant), additive/no backfill. Mirrors the
  Slice-5 `builder_email_versions` shape.
- **Contract:** `SilicaEmailNodeInput` (structural, opaque — an object with a string `kind`) +
  `CreateSavedEmailBlockInput` / `RenameSavedEmailBlockInput`
  ([email-silica.ts](../../packages/builder-schemas/src/email-silica.ts),
  [email.ts](../../packages/builder-schemas/src/email.ts)).
- **Service:** `savedEmailBlockService` (list / create / rename / delete), 1:1 with silica's
  `SavedBlockChange` intents; create returns the SERVER row so the host reconciles the
  optimistic temp id; rename/delete return a boolean so a stale id 404s
  ([saved-email-block-service.ts](../../packages/builder/src/services/saved-email-block-service.ts)).
- **REST:** `GET/POST /v1/builder/email-blocks` + `PATCH/DELETE /v1/builder/email-blocks/:blockId`
  — a `/email-blocks` path (tenant-level, never under `/:id`), no builder-schemas dep in the
  route ([emails.ts](../../services/api-rest/src/routes/v1/builder/emails.ts)).
- **Workbench:** `useSavedEmailBlocks` + create/rename/delete hooks (opaque `node`, like
  `silicaDoc`), each reconciling the cache on **settle** so a save's temp id → server id and a
  failed write rolls back ([email-data.ts](../../apps/workbench/surfaces/builder/email/email-data.ts)).
  The studio ([email-editor.tsx](../../apps/workbench/surfaces/builder/email/email-editor.tsx))
  renders `savedBlocks` + `onSavedBlocksChange` (optimistic `setQueryData(next)` → matching
  mutation), and runs a **one-time migration** (`readLocalSavedBlocks` → upload each →
  `clearLocalSavedBlocks`) the first time the server list settles, so pre-existing browser-local
  blocks aren't orphaned.

**Verified:** migration applied to local docker (`prisma migrate deploy`; `builder_email_blocks`
confirmed `rls=t force=t` + `builder_email_blocks_tenant_isolation` policy via psql) + client
regenerated; **builder / builder-schemas / workbench / api-rest all typecheck + lint clean**;
builder 68 + builder-schemas 252 tests pass. Migration also applies in prod via the DB Migrate
workflow on the next push to `main`.

**Decoupled (not built):** the same seam for SITE-builder symbols (§15) remains a separate
data-model decision, deliberately out of scope here.

## 18. Slice 10 — measurable email links (click + revenue attribution) (2026-07-27, uncommitted)

The email builder could not answer "did anyone click, and did it lead to a sale?" — a 10/10
gap. Bare links landed on the storefront with no referrer (mail clients strip it), so the
tenant's own analytics recorded the visit as **direct** and the email got zero credit. Slice 10
makes every email's links measurable **end-to-end**, in the tenant's own reports, with zero
configuration for the owner.

**How it works (two sides).**

- **Send tags on-site links.** New `@sparx/email/silica` `link-tracking.ts` (`tagEmailHtmlLinks` /
  `tagEmailTextLinks` / `tagTrackedUrl`) rewrites every link to the tenant's own site with
  `utm_source=<email key/slug>` · `utm_medium=email` · `utm_campaign=<the email's name>`, over the
  final post-interpolation URLs. **On-site only** — a carrier/social/partner link can't be measured
  by the tenant's analytics, so it's left alone; `mailto:`/`tel:`/anchors and any author-set
  `utm_source` are never touched. Wired into `renderSilicaEmail` (last step), so **every** send path
  tags: transactional/automation (`tenant-email.ts`), broadcasts (`broadcast-service`), preview +
  test-send. Tracked hosts + campaign resolve once via `emailTrackingService.resolveEmailTracking`
  (email-platform): the tenant's verified custom domains + the `SPARX_SITE_BASE` host; campaign =
  the author override (`BuilderEmail.trackingCampaign`) else the email's name; `undefined` (no-op)
  when there's no site host (dev).
- **Analytics reads it.** The storefront beacon (`apps/site`) forwards the landing URL's
  `utm_medium`/`utm_campaign` on the **first** pageview only; the collect route accepts them; the
  classifier (`site-analytics.ts`) returns `source='email'` on `utm_medium=email` (ahead of the
  referrer) and stores the campaign (new `site_analytics_events.campaign` column). Orders inherit it
  for free — `resolveOrderAttribution` already copies the first-touch pageview's source, and now its
  campaign too (new `orders.attribution_campaign`).

**What the owner sees.** Preview & Check gains a plain-language line — _"3 links are tracked —
clicks show in your reports under 'Welcome email.' 1 link goes to another website, which your
reports can't follow."_ A **Tracking** popover in the studio explains it and lets them name the
campaign (defaults to the email's name). In their reports: **Email** is now a named traffic source
(both "Where visits came from" and "Revenue by traffic source"), plus two per-campaign drills —
`builder.traffic.email_campaigns` ("Visits from your emails") and `commerce.revenue.by_email_campaign`
("Revenue from your emails") — so _Welcome email → 38 visits → 4 orders → $612_ is answerable.

**DB (applied to local docker, regenerated):** additive nullable columns on three FORCE-RLS tables —
`site_analytics_events.campaign`, `orders.attribution_campaign`, `builder_emails.tracking_campaign`
(migration `20270121000000_email_link_attribution`); no backfill.

**Not built (flagged, separate):** **form-submission** email attribution. Forms capture only
referrer/IP/UA in a JSON `context` blob with no source column and no `resolveOrderAttribution`-style
resolver — they lack the whole attribution spine, not just the email slice, so email→form
attribution is a separate build on top of generic form attribution.

**Verified:** email 59 (+14 link-tracking) · builder 68 · builder-schemas 252 · email-platform 10 ·
commerce 48 tests pass; email / builder-schemas / builder / email-platform / commerce / api-rest /
workbench / site typecheck + lint + prettier clean.

## 19. Marketing automation — completing the surface (2026-07-28, uncommitted)

Prompted by "shouldn't there be marketing automation with emails, and shouldn't the CRM send
automated emails?" — the honest answer, verified in the seed catalog, is **it already ships and
runs on by default**: the automation engine (docs/81) installs **~45 system automations** per
tenant as each module activates, including `Welcome new customers`
(`CRM_WELCOME_NEW_CUSTOMER`, `crm.customer.created` → welcome email), `Abandoned cart nudge`
(a real 15-min `cart` scan → recovery email ~2h later), `Win back inactive customers` (90-day
lapse), post-purchase review, order/subscription/return lifecycle, and B2B + invoicing dunning.
So both halves were already true. This session **completes the surface** around that engine —
three pieces, all "implement, don't defer."

### 19a. Authoring catalog now matches the engine + engagement triggers

The workbench authoring catalog (`automations-catalog.ts`) had drifted BEHIND the engine: it
offered fictional events (`commerce.order.refunded`, `crm.deal.won/lost` — the engine does "won"
via `crm.deal.stage_changed` + a `deal.stageType == won` condition) and was missing many real,
resolvable triggers and scan entities.

- **`TRIGGER_EVENTS`** rewritten to the engine's real resolver inventory (builtins.ts +
  automation-actions/resolvers.ts): added `order.paid/fulfilled/delivered/payment_failed`, all six
  `subscription.*`, all three `return.*`, `inventory.low/depleted`, `crm.customer.subscribed`,
  `crm.deal.created`, `crm.billing_document.stage_changed`, `crm.b2b_account.created`,
  `b2b.order.approved/rejected`; fixed `order.refunded`; removed the two fictional deal events.
- **`SCAN_ENTITIES`** gained the three registered scanners it was missing — `cart` (abandoned
  carts), `quote` (awaiting a decision), `conversation` (chat) — so an owner can author a scan
  over them, not just consume the seeds that already do.
- **New resolvers** (`automation-actions/resolvers.ts`) so every offered trigger resolves fields:
  `b2b.invoice.overdue` / `b2b.account.credit_hold` (hydrate the account + primary contact),
  `crm.task.created`, and the **email-engagement** trio `email.opened/clicked/bounced` (hydrate
  the customer by id/address + campaign).
- **The engagement tee.** `email.opened/clicked/bounced` were published on the platform bus but
  **not teed to the automation fan-in** (`pubsub-bridge.ts` teed only order.\*), so those triggers
  were dormant. Added them to the (renamed) `PLATFORM_TEE_TOPICS` set — the same tee installed in
  both api-rest (where the Mailgun webhook republishes them) and the worker — so "opened but didn't
  click → follow up" / "clicked → start a sequence" now fire.

### 19b. Recipe gallery (docs/81 §9)

The 45 system automations only surfaced as rows in a list (filter "Set up by sparx"), reachable
by nobody who thinks in goals. New **`automations.recipes`** workbench surface — a browse-by-goal
gallery (`recipe-gallery.tsx` + a curated `recipes-catalog.ts` mapping each shipped automation
NAME → a goal group + plain-English one-liner + icon). Goal-grouped cards ("Recover lost sales",
"Keep customers coming back", "Get paid on time", …), each with a big ON/OFF toggle
(`useSetAutomationStatus`), a state badge, and a "Customize" that opens the automation. This IS the
one-click Templates Library §9 specifies — a presentation layer over data that already exists.

### 19c. Email SEQUENCES — the one genuinely-missing capability

The docs' "abandoned-cart **3-email sequence**" was, in reality, a single nudge — there was **no
reusable multi-touch journey object** (the `email.sequence_add/remove` actions were enum entries
with no executor). Built greenfield:

- **Data** (`packages/db/prisma/schema/88-email-sequences.prisma`, migration
  `20270124000000_email_sequences`): `EmailSequence` (name, **site-optional `propertyId`** —
  null = tenant-wide, set = one site, exactly like an automation; `reentryPolicy` once|always;
  `exitOnPurchase`; ordered JSON `steps` like `automations.actions`) + `EmailSequenceEnrollment`
  (one person's progress: `recipientEmail` captured at enroll, `currentStep`, `nextRunAt`,
  `status`, an `activeDedupe` partial-unique that guarantees at most one ACTIVE enrollment per
  person per sequence, `sourceRefs` for the designed email's DataSources). Both FORCE-RLS +
  `tenant_isolation`; a `find_due_sequence_enrollments` SECURITY DEFINER scan for cross-tenant
  drain discovery (mirrors `find_due_automation_runs`).
- **`@sparx/email-sequences`** — a new LEAN, backend-safe package (deps: `@sparx/db` +
  `@sparx/email-sends` only, no render/React — same rationale as email-sends, so the worker stays
  lean), with a client-safe `./schemas` subpath (zod only) the workbench editor imports. It owns
  CRUD, `enroll`/`unenroll` (re-entry policy + a marketing do-not-contact opt-out honored at
  enroll), `listEnrollments`, and **`drainDueEnrollments`** — the tick that advances each due
  enrollment one step: sends the current step via the **same `enqueueSend`** a one-shot
  `email.send_campaign` uses (suppression + per-recipient render + Mailgun stay where they live),
  schedules the next, exits on the `exitOnPurchase` goal, completes at the end. Idempotent per step
  (a `seq:<id>:<n>` dedupe key), self-guards with a new `EMAIL_SEQUENCE_DRAIN` advisory lock, and
  runs in the automation-worker's cron next to the run tick.
- **Executors** (`automation-actions/sequences.ts`): `email.sequence_add` / `email.sequence_remove`
  (module `email`, gated) translate the triggering customer into an enroll/unenroll — flipped from
  `available: false` to real, available actions in the authoring catalog with a `sequenceId` picker.
- **REST** `/v1/email/sequences` (CRUD + `/enrollments` + manual `/enroll` `/unenroll`) and a
  **workbench Sequences surface** (list + step editor with a friendly delay control + email-source
  picker + a site picker defaulting to the working site + enrollments view).

### 19d. Gold blueprint — a live welcome journey

The sparx blueprint now ships a real **2-touch welcome series** (not a single email): a new
`sequences` block in `BlueprintSchema` + the installer (resolves each step's `emailName` → the
created Builder email id, an `activate` flag installs live vs draft, `exitOnPurchase` stops it on
a purchase). The sparx blueprint adds a day-3 follow-up email (`welcome-email-2.json`) and a
`Welcome series` sequence over both — installed as a **draft** to match the emails' D4
review-before-send posture (a draining sequence must reference PUBLISHED emails). The tenant
reviews + publishes the two emails, turns the series on, and pairs it with the on-by-default
`Welcome new customers` automation (enrols on `crm.customer.created`) for a hands-off first week.
Blueprint version bumped `1.0.0 → 1.1.0` (payload changed).

### Hand-off (DB-adjacent — deliberately NOT run this session)

Per the standing DB rule, the migration + new-model code are authored as files only. To bring it
live, in order: **(1)** `pnpm install` (registers the new `@sparx/email-sequences` workspace
package + the api-rest / automation-worker / automation-actions dep links); **(2)** apply
migration `20270124000000_email_sequences` (docker locally, then the DB Migrate pipeline for prod);
**(3)** `prisma generate` (creates the `EmailSequence` / `EmailSequenceEnrollment` client models).
Until (2)+(3), the sequence service / executors / REST / installer typecheck-fail ONLY on the
missing prisma models — expected; every other package (workbench catalog, resolvers, recipe
gallery, pubsub tee) typechecks now.
