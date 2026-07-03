---
title: GoDaddy (registrar)
node: integrations
type: reference
status: active
sources:
  - packages/godaddy/
  - packages/registrar/
---

Domain **registrar / reseller** — buying tenant domains (availability / purchase / DNS / DKIM). `@sparx/godaddy` implements the provider-agnostic `@sparx/registrar` contract; used by the api-rest purchase flow, api-mcp domain tools, and `services/domain-worker` (`src/godaddy.ts`). Secrets `godaddy-api-key` / `-secret` (OTE + PROD).

- **Not platform DNS** — that's Cloudflare ([[topology]]). GoDaddy only buys/registers domains; the `domain.purchased` event then drives DNS config.

Related: [[topology]], [[rejected]]
