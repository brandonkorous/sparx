# @sparx/email — the platform email integration

Scoped guidance for sparx's coded email templates + the send pipeline. Loads when
working in this tree. See root [CLAUDE.md](../../CLAUDE.md) for cross-cutting rules,
[services/CLAUDE.md](../../services/CLAUDE.md) for the worker fleet, and the
[[project_platform_email_redesign]] memory for the running punch-list.

This file is the **binding conventions + footguns**. The one-line orientation: an
email is a TEMPLATE (here) that a PUBLISHER triggers by putting an `email.send` event
on the bus; the WORKER validates + renders + relays it. Get any of those three wrong
and the mail silently never arrives.

## Two audiences, two chassis — never cross them

- **PLATFORM email = the platform → the account owner / partner / staff.** Redesigned
  on the **"Signal"** system: `PlatformEmailLayout` (`templates/_layout.tsx`) — a solid
  ink masthead + the structural block kit. These sends pass no TENANT brand, so the
  palette is `signal`'s. **They are not "always sparx-branded" — that was true until
  2026-08-16 and is the multi-brand leak this package was carrying.** The sending
  PRODUCT's name, URL, billing address and console origin arrive on
  `brand.platform`, set by email-worker from the tenant's `platform_brand`, and are
  read via `usePlatformName()` / `usePlatform()` / `platformNameOf()` (subjects).
  See RULE below. This is what "our emails" means.
- **TENANT email = a tenant → their own customer** (order/shipping/appointment,
  forms, careers, chat). Builder-authored silica node-trees (rendered by key), OR the
  legacy coded `EmailLayout` (brand-driven, per-tenant). **A dedicated tenant-brand
  redesign pass is deferred** — do NOT migrate a tenant template onto
  `PlatformEmailLayout` (it would stamp sparx ink on a tenant's mail).

The **5 coded templates still on legacy `EmailLayout`** are tenant-facing on purpose:
`form-submission-notification`, `form-submission-confirmation`, `job-application-received`,
`job-application-confirmation`, `chat-notification`. `EmailLayout` also serves
`renderAuthoredEmail` (broadcasts) — leave it alone until the tenant pass.

## RULE: a template never writes the platform's name

**No template may contain the string `sparx`** — not in body copy, not in a
subject, not in a `preview` / `footerReason`, not in a `mastheadRight`, not in a
`footerLinks` href, and above all not as a wordmark drawn in JSX. WizeWorks runs
two products on one platform and ONE email worker drains the queue for both, so a
literal there reaches the other brand's customer.

| You need                            | Use                                                    |
| ----------------------------------- | ------------------------------------------------------ |
| the product's name, in a component  | `usePlatformName()`                                    |
| its URL / billing address / console | `usePlatform()` → `.url` `.billingEmail` `.appUrl`     |
| the product's name, in a SUBJECT    | subjects take `platform: string`; `send.tsx` passes it |
| the wordmark                        | `<PlatformWordmark>` — never hand-drawn                |

Anything nullable (`url`, `billingEmail`, `appUrl`) is null when the brand has
published none: **omit the line, never invent one.** A guessed URL is a link to a
404 and a guessed address bounces a customer's reply.

The **six sparx-PRODUCT templates are the exception**, and only because they are
ABOUT sparx: `market-settlement-report`, `partner-welcome`,
`partner-application-received`, `partner-earnings`, and the two
`job-application-*` (WizeWorks' own careers page). A Piggles tenant never
receives one — there is no Piggles marketplace or partner programme
(piggles/CLAUDE.md, "A sparx PRODUCT is not a Piggles capability"). They are
listed by name in `SPARX_OWN_PRODUCTS` in `every-template.test.ts`; adding to
that list needs the same argument.

`every-template.test.ts` renders EVERY template a second time with a second
brand and asserts the string never appears. That test is the enforcement — 110
literals across 29 files had accumulated with nothing checking.

## The Signal design system (platform templates)

- **Tokens = `signal` in [components/tokens.ts](src/components/tokens.ts).** DELIBERATELY
  separate from `EMAIL_DESIGN` in `@sparx/builder-schemas` — that one is mirrored by the
  tenant Email-Builder canvas, so **mutating it shifts the builder's scale**. Evolve the
  platform look in `signal`, never in `EMAIL_DESIGN`.
- **Compose the block components, don't hand-roll markup.** [components/blocks.tsx](src/components/blocks.tsx)
  exports the "layout carries the message" pieces: `EmailDisplayHeading`, `EmailLead`,
  `EmailSectionLabel`, `EmailAmountHero`, `EmailLineItems` (receipt table + total rule),
  `EmailStatusList`, `EmailSteps`, `EmailTimeline`, `EmailPayCard`, `EmailAlert`,
  `EmailCodeBlock`, `EmailFallbackLink`, `EmailFinePrint`, `EmailActionButton`
  (`variant: 'primary' | 'ghost'`). A new "kind" of email that needs a new visual
  device → add a block here, don't inline it in the template.
- **Email-rendering rules (why the code looks the way it does):** mail clients strip
  `<style>` and ignore CSS vars → **every value is inlined**; Outlook does NOT inherit
  `font-family` → **set `signal.font` on every text element** (the blocks already do);
  layout is **table-based** (React-Email `Row`/`Column`) because that survives Outlook.
  Money + codes render in `signal.mono` for tabular alignment. Design rules that DON'T
  apply here: shadows/gradients are stripped anyway; the root design system's silica
  components are for app UI, not email.
- **Design intent** (matches the root rules): color with intent (Ember for the one
  action, semantic hues only when state changes), real ink for body copy (`signal.body`),
  muted (`signal.meta`) only for genuine metadata. No eyebrows; a section label is a
  functional group header, not a kicker.
- **Legacy primitives still exist** (`EmailButton`, `EmailHeading`, `EmailCallout`, …)
  and are used by the 5 tenant templates + `EmailLayout`. New PLATFORM work uses the
  Signal blocks, not these.

## Adding a template — the SIX sync points (miss one and it dead-letters)

A template that isn't registered at EVERY point below is either a compile error or,
worse, a silent drop in the worker. In order:

1. **`src/templates/<name>.tsx`** — the component + a `<name>Subject` (string or fn) +
   a `<Name>EmailProps` interface. Compose `PlatformEmailLayout` + Signal blocks.
2. **`src/send.tsx`** — add the id to `TemplateId`, a member to the `TemplateSend`
   union, and a `case` in `renderTemplate`'s switch (render html+text, return the
   subject).
3. **`src/templates/index.ts`** — re-export the component/subject/props.
4. **`../email-worker/src/template-schema.ts`** — add a `z.object({ template:
z.literal('<name>'), ...TemplateMeta, props: … })` to `TemplateSendSchema`.
   **⚠️ This moved out of `handler.ts` — it lives in `template-schema.ts` now.** If the
   props aren't validated here, the worker's zod parse fails and the message is
   **acked-and-dropped, no send, no error**. Keep props OPTIONAL where the publisher may
   omit them; use `.min(1)` not `.url()` for a field that can be a bare path.
5. **`../events/src/types.ts`** — add the literal to `EmailSendPayload.template` (else a
   `publish('email.send', …, { template })` won't typecheck at the publish site).
6. **`src/__tests__/every-template.test.ts`** — add a realistic `CASES` entry (typed off
   the union) AND bump the `expect(IDS.length).toBe(N)` count.

Extra point for **auth-published** templates: add the literal to
`PublishAuthEmailInput.template` in [`../auth/src/email-events.ts`](../auth/src/email-events.ts)
(a restricted allow-list) or `publishAuthEmail(...)` won't compile.

Then **wire the publisher** (below). A template with no publisher is built but never
sends — a half-finished surface.

## Publishing — always the bus, never a direct send

Outbound email is **event-driven**: put `email.send` on Pub/Sub and let `email-worker`
render + relay. `sendTemplate()` / `sendEmail()` are a **deprecated escape hatch for
synchronous-only flows (OTP, future 2FA)** — a non-OTP direct send needs justification.

Three publish surfaces, by context:

- **Fastify routes/services** — `publish(request.log, 'email.send', tenantId, actorId,
{ to, template, props })` from `@sparx/api-core/pubsub`.
- **Auth / Next (better-auth callbacks, workbench server actions)** — `publishAuthEmail({
tenantId, actorId, template, to, props })` from `@sparx/auth` (no Fastify logger there).
- **Workers / crons** — `publishEvent(publisher, 'email.send', tenantId, null, { to,
template, props }, pubLogger)` (see `domain-worker`'s `handler.ts`/`cron.ts`, or the
  `publishPartnerEmail` helper in `services/api-rest/src/lib/partners/events.ts` for
  service-lib functions that have no request logger).

**Every publish is best-effort + non-blocking.** Wrap it so a mail failure can NEVER
fail the business write or trigger a Pub/Sub retry loop of an already-done job:

- resolve the recipient, guard `if (!email) return`;
- fire the send AFTER the DB write commits (never announce a row that then rolls back);
- for cron/webhook state transitions, dedup so it sends ONCE (a marker column, a
  `previous_attributes` guard, or a known-device count) — the bus redelivers.

## Recipient resolution — the non-obvious bits

- **`Tenant.email` / `Tenant.name`** are documented as billing/ownership-only and
  "never rendered to a customer" — but they ARE the correct address for a **platform →
  owner/partner** email (that's not a customer). Reading them cross-org needs
  `withSystem(...)` (the partner code does this; partner rows carry no email of their own).
- **Auth contexts have no ambient tenant.** `user.tenantId` is a custom field better-auth
  doesn't surface in callback types → read it via `user as unknown as { tenantId?: string }`,
  fallback `?? ''`, exactly like `sendResetPassword` does.
- **`from`** is `SPARX_EMAIL_FROM` / `sparx <noreply@sparx.email>` with the SENDING
  brand's display name substituted by `platformFrom()` (`@wizeworks/brand-core`).
  The address is shared on purpose — one Mailgun domain serves both brands, so it
  cannot move until Piggles has DNS of its own; only the name in front of it does.
  The worker resolves per-tenant BRAND (colors/logo) from `propertyId` when present,
  and overlays `brand.platform` on EVERY send, branded or not — the footer's legal
  line and the masthead state who WE are, which a fully-branded shop needs exactly
  as much as an unbranded one.

## Test gates (keep green)

- **`every-template.test.ts`** — renders EVERY template with realistic props and asserts
  no `{{`, `undefined`, `NaN`, `[object Object]`, that html contains `sparx.works`, and
  pins `IDS.length`. Adding a template without a CASES entry is a COMPILE error (the map
  is typed off `TemplateId`); the count assertion catches a silent drop. It then renders
  every template AGAIN under a second brand and asserts the first one's name appears
  nowhere — see the RULE above.
- **`templates.test.ts`** — per-template subject + key-phrase assertions. When you
  redesign a template, **preserve its subject and any test-pinned phrase** (e.g.
  welcome-merchant must keep "Your site is live on sparx"; the footer must contain
  "WizeWorks"). Change copy the test pins → update the test deliberately, don't drift it.

## Marketing vs transactional — don't duplicate

- **19 KEYED transactional defaults** (`@sparx/builder-schemas` `default-emails.ts`) are
  provisioned on email-module activation — order/shipping/dunning. Blueprint `emails` are
  **UNKEYED brand-voiced marketing starters** (welcome/win-back). The coded PLATFORM
  templates here are a THIRD, separate set (sparx's own account/billing/security mail).
  Never re-implement an order confirmation as a coded template.

## Footguns

- **`||` vs `??` lint** (`@typescript-eslint/prefer-nullish-coalescing`) fails the build
  on `a || b`. For an intentional **empty-string → fallback** (a blank subject, a blank
  IP), `??` is WRONG (it keeps `''`). Use a length check —
  `const x = s && s.length > 0 ? s : fallback;` — not `||`.
- **api-rest full typecheck shows ~37 pre-existing Prisma-client-staleness errors**
  (`shipmentPackage`/`pickList`/`AllocationStrategy` — other agents' models, cleared by
  `prisma generate`). They are NOT email work — filter to your files before believing a
  break is yours.
- **Gmail clips a message past ~102 KB** — the silica email lint warns before the cliff;
  keep coded templates lean.
- **new-device-signin** fires on EVERY sign-in unless you dedup (it counts prior sessions
  by user-agent).
- **2FA enable/disable → `two-factor-changed`** is WIRED (both auth instances) via a
  `databaseHooks.user.update.after` hook PATH-GATED on `context.path`, NOT request-level
  `hooks.after`. The exact-signal fact: better-auth flips `twoFactorEnabled` only through
  `internalAdapter.updateUser`, which the twoFactor plugin calls in exactly two places —
  the enable COMPLETION (`/two-factor/verify-totp`, first success while `verified` was
  still false) and `/two-factor/disable`. A 2FA challenge at LOGIN re-runs verify-totp but
  never calls `updateUser`, so there is NO login/enable ambiguity and no profile update
  reaches those paths. The db-hook `context` is the request's endpoint context (ALS), so
  `context.path` is the plugin-relative path and `updated` is the full user row. Tenant:
  `packages/auth/src/server.ts` (`publishAuthEmail`, → `/settings/security`). Operator:
  `packages/operator-auth/src/server.ts` (`publishOperatorEmail`, → console origin). Do
  NOT re-wire this as request-level `hooks.after` — that route can't cleanly tell an
  enable-completion from a login verify. Both fire best-effort inside `try/catch`.

## Where things live

- **`@sparx/email`** (here) — templates, the Signal blocks/tokens, `send.tsx` registry +
  `renderTemplate`, providers (console dev / Mailgun prod).
- **`@sparx/email-worker`** — `template-schema.ts` (the zod gate) + `handler.ts`
  (render + relay + accept-bookkeeping). Runs inside `services/event-worker`.
- **`@sparx/email-platform`** — per-send brand resolution, sending-domain (Mailgun)
  management, analytics, and the SEPARATE management-event bus (`publishEmailEvent` —
  `email.domain.verified` etc.; NOT the `email.send` transport).
- **Publisher sites** — auth (`packages/auth/src/server.ts` hooks + `email-events.ts`),
  billing (`services/api-rest/.../webhooks/stripe-billing.ts`), team/tenant/feedback
  (`services/api-rest/src/routes/v1/*`), partner (`services/api-rest/src/lib/partners/*`),
  domains (`packages/domain-worker/*`), workbench (`apps/workbench/app/accept-invite`).
