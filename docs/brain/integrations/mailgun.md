---
title: Mailgun (email send)
node: integrations
type: reference
status: active
sources:
  - packages/email/src/providers/mailgun.ts
  - terraform/envs/prod/serverless.tf
---

The **production email provider** — transactional send on `sparx.email` via the Mailgun HTTP API. `SPARX_EMAIL_PROVIDER=mailgun`, `SPARX_MAILGUN_DOMAIN=sparx.email`, region us; secret `mailgun-api-key`. `console` in dev/CI. Wired at [[email-pipeline]].

- **Postal is decommissioned** — `packages/email/src/providers/postal.ts` + `k8s/postal/*` linger as a smoke-test fallback + cleanup candidate. Root CLAUDE.md still says Postal ([[claude-md-drifted]]).
- Cloudflare `sparx.email` MX / SPF / DKIM / DMARC records are still stubbed TODO.

Related: [[email-pipeline]], [[phased-infra]], [[rejected]]
