---
title: The email pipeline
node: api-events
type: rule
status: active
sources:
  - services/email-worker/src/handler.ts
  - packages/email/src/providers/index.ts
  - packages/email/src/templates/
---

Outbound email defaults to **publishing `email.send` to Pub/Sub**. `email-worker` consumes, validates against a Zod discriminated union of template ids (or a pre-rendered `raw` broadcast), resolves per-site brand, calls `renderTemplate()` (`@sparx/email`, React Email → html + auto plaintext), then `getEmailProvider().send()`.

- **Failure model:** unknown-template / parse error → `rejected` + ack (no retry); transient/5xx → throw → nack → Pub/Sub redelivers.
- **Escape hatch:** direct `sendTemplate()` / `sendEmail()` is reserved for **synchronous-required** flows (OTP, future 2FA); a non-OTP direct send needs PR justification.
- **Templates compose atomic components** inside `<EmailLayout>` — never inline raw `style={}`; extend a component or add a token. Plaintext is auto-generated — never hand-write it.

## ⚠️ Provider is Mailgun, not Postal

The sending **domain** `sparx.email` is still correct, but the **provider** in prod is **Mailgun** (`SPARX_EMAIL_PROVIDER` defaults `console`; prod = `mailgun` via `SPARX_MAILGUN_API_KEY` / `SPARX_MAILGUN_DOMAIN`). **Postal is decommissioned** — retained only as a smoke-test fallback. Root `CLAUDE.md` still says Postal; trust `services/CLAUDE.md` + the code. See [[claude-md-drifted]].

Related: [[event-catalog]], [[event-driven]], [[integrations]], [[claude-md-drifted]]
