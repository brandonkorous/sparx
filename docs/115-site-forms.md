# 115 — Site Forms (contact / lead capture)

Version: 1.0
Author: Brandon Korous
Last Updated: 2026-07-05

A tenant can drop a **Contact form** block onto any Builder page (or the site
chrome). When a visitor submits it, the message is **always stored** in a
dashboard inbox, and — per the form's own configuration — the owner is emailed,
the visitor gets an optional confirmation reply, and the person is optionally
added to the CRM as a prospect. Turning on the CRM later **backfills** every lead
already captured.

This replaces the previous inert `el:form` "Contact form" catalog entry, which
rendered but did nothing (its Button was `type="button"` and the `<form>` had no
action) — see the diagnosis that motivated this work.

---

## 1. Principles

- **Store everything, always.** The durable `FormSubmission` row is the backbone;
  email / autoresponder / CRM are fan-out actions on top of a record you can
  always return to. A dropped Contact form works with sensible defaults (emails
  the owner) even with no configuration and no CRM.
- **Modules, not tiers.** The submission + owner email + autoresponder are
  ungated. Adding a lead to the CRM is gated on the `crm` module; when it's off
  the form still works and the dashboard offers to turn CRM on.
- **Security first (the endpoint is public and unauthenticated).** The single
  governing rule: the client sends only **identifiers + field values**; it never
  sends anything that controls routing, and never a tenant/site _id_.

## 2. The security model

The submit endpoint `POST /v1/public/forms/submit` is anonymous and internet-facing.

- **Tenant/site are resolved server-side from slugs.** `?tenant=<slug>` →
  `prisma.tenant.findUnique` against the non-RLS dispatch row; `?property=<slug>`
  (or the primary site) resolved under `withTenant`. The client never supplies an
  id, and all writes go through `withTenant` so Postgres RLS is the backstop.
- **Recipient addresses never reach the browser.** The Builder published tree is
  served to every visitor. So a form's recipient addresses are **not** kept in the
  tree: they are authored in the inspector (draft only), then at publish they are
  **extracted into a server-only `FormDefinition` row and stripped** from the
  published tree (`CONTACT_FORM_SECRET_PROPS`). The endpoint reads recipients only
  from `FormDefinition` (or falls back to the tenant's account email) — never from
  the request, never from anything the browser saw. **The endpoint can never be
  coerced into mailing an attacker-chosen address** (no open relay).
- **The form must exist.** The endpoint resolves the form node from the published
  page (then the active layout) by its stable node id; if no live ContactForm
  exists at that address it rejects — so it can't be used to spam arbitrary
  tenants.
- **Anti-abuse (all net-new — the platform had none):** a hidden **honeypot**
  field (a filled value ⇒ stored as `spam`, no fan-out, success returned so a bot
  learns nothing); a per-route **rate limit** (30/min); strict Zod caps on field
  count + length; untrusted content is **never rendered as HTML** in the dashboard.
  The storefront proxy now forwards `X-Forwarded-For`/`X-Real-IP` so api-rest
  (`trustProxy`) rate-limits by real client IP, not the proxy pod.
- **No side effects inline.** The endpoint stores the row, publishes `email.send`
  (owner notify + autoresponder) and `form.submitted`, and returns. Workers /
  the in-process CRM consumer do the rest.

## 3. Data model (`packages/db/prisma/schema/85-forms.prisma`)

- **`FormSubmission`** — the durable inbox row. `tenant_id` (RLS), optional
  `property_id` (SetNull), `form_node_id` (stable Builder id), `page_slug`,
  `form_name`, the snapshot `name`/`email`/`phone`/`message` + full `fields` JSON,
  a `context` JSON (ip/ua/referrer/submittedAt), `status` (`new | read | spam |
archived`), and `customer_id` (set once mirrored to CRM). FORCE RLS +
  `tenant_isolation`.
- **`FormDefinition`** — the server-only routing config, keyed
  `@@unique([property_id, form_node_id])`. Holds `recipients[]` (the sensitive
  addresses kept off the published tree), materialized at publish. Cascade on
  property delete. FORCE RLS.

Migration: `20261006000000_form_submissions` (RLS hand-appended; new empty tables,
so no FORCE-RLS backfill loop).

## 4. The Contact form block

`ContactForm` is a wired interactive leaf — the richer sibling of the `Signup`
island (`packages/builder-render/src/contact-form.tsx`). Contract in
`packages/builder-schemas/src/forms.ts`. It renders a fixed, well-designed contact
field set (Name, Email, optional Phone, Message) and, on the live site only,
submits through the injected runtime effect `submitForm`. Config in `props`:
`title/description/submitLabel/successMessage`, `showPhone/messageRequired`,
`notify/addToCrm/autoresponder` (+ `autoresponderSubject/Message`), and the
sensitive `recipients[]`. The catalog `contact_form` entry now stamps this node.

Runtime path: island → `useBuilderRuntime().submitForm({nodeId, values, honeypot})`
→ the apps/site bridge (`storefront-builder-runtime.tsx`) adds the trusted
tenant/site slugs + the current page slug → `contact-client.ts` → `/api/sparx`
proxy → the public endpoint. The editor canvas no-ops the effect, so the form
renders + validates in preview without capturing.

## 5. Flow

1. Store the `FormSubmission` (always; spam flagged, never lost).
2. If `notify`: publish `email.send` (`form-submission-notification`) to each
   recipient (reply-to = the submitter). Fallback recipient = the tenant email.
3. If `autoresponder` + a valid submitter email: publish `email.send`
   (`form-submission-confirmation`).
4. Publish `form.submitted` — dual-published to Pub/Sub (webhooks + automation
   fan-in) and the in-process bus (the CRM lead consumer).
5. The CRM consumer (gated on `crm`, deduped): upsert a **prospect** (no marketing
   consent — `customerService.captureLead`), log the message as a `note` activity,
   and stamp `FormSubmission.customer_id`.

## 6. Dashboard

- **Form submissions inbox** — a `builder`-gated section listing submissions
  (newest first) with status pills, a detail view, lifecycle actions (read / spam
  / archive / delete-behind-confirm), and an "In your contacts" link when mirrored.
  API: `GET|PATCH|DELETE /v1/forms/submissions[/:id]`.
- **Turn on CRM** — when `crm` is off, one tasteful prompt routes through the real
  activation path (`setModuleEnabledAction('crm', true)` → `module.activated`),
  which seeds CRM defaults **and backfills** stored leads (`customer_id IS NULL`,
  not spam) so activation isn't starting from zero. Bounded to 1000 per activation.
- **Inspector** — a ContactForm node configures its copy, field toggles, and the
  routing (recipients + notify/addToCrm/autoresponder), explicit-save.

## 7. Handoff / deploy (this feature is authored as files only)

Per the DB rule, the schema + migration + dependent code are committed as **files
only**; the DB-adjacent steps run through the pipeline:

1. Regenerate the Prisma client (adds `FormSubmission` / `FormDefinition`): the
   DB-dependent packages (`@sparx/builder`, `@sparx/crm`, `api-rest`) will not
   typecheck until this runs — expected. The DB-independent packages
   (`builder-schemas`, `events`, `email`, `builder-render`, `apps/site`) already
   typecheck clean.
2. Apply the migration via the **DB Migrate** workflow (Cloud SQL is private-IP).
3. `terraform apply` to create the `form.submitted` topic (added to
   `terraform/envs/prod/main.tf`).
4. Deploy api-rest + email-worker + apps/site + apps/dashboard.

## 8. Follow-ups

- Prune orphan `FormDefinition` rows (a deleted form leaves an unreferenced row —
  harmless, never read).
- Optional per-form spam scoring / captcha if honeypot proves insufficient.
