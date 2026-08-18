---
title: Better Auth (self-hosted)
node: architecture
type: rule
status: active
sources:
  - wizeworks/packages/auth/src/server.ts
  - wizeworks/packages/auth/src/organizations.ts
  - wizeworks/packages/auth/src/api-keys.ts
---

Auth is **Better Auth, self-hosted** — not Auth0/Clerk/any SaaS. The `organization` plugin is remapped so **the tenant Prisma model IS the Better Auth `organization`** (`modelName: 'tenant'`). sparx owns the tenant lifecycle (`allowUserToCreateOrganization: false`, `disableOrganizationDeletion: true`); the plugin manages membership/invitations/active-org. `session.activeOrganizationId` drives the JWT `tid`/`role` (falling back to the home membership `users.tenantId`).

- **Two separate instances:** staff (Layer 1 — `users`, globally-unique email) and customer/shopper (Layer 2 — `customer_users`, per-`(tenant, email)`, RLS-scoped). They share **zero rows**.
- Plugins: `mcp` (OAuth 2.1 server for the MCP connector, PKCE-required), `organization`, `nextCookies` (must stay last). Instance is lazily built behind a `Proxy` so workers importing a util don't force-construct it.
- Auth emails (invites, reset, verify) publish `email.send` via `publishAuthEmail` — never inline.

## ⚠️ Correction to root CLAUDE.md

CLAUDE.md says "use Better Auth's primitives for org membership, API keys, and MFA." In code, **only org membership** uses the plugin. **API keys are custom** (`wizeworks/packages/auth/src/api-keys.ts` — `sk_live_*`, SHA-256-hashed, custom `apiKey` model in `05-api-keys.prisma`). **MFA/two-factor is not implemented** (no `twoFactor` plugin). Treat the API-key/MFA line as aspirational — see [[claude-md-drifted]].

Related: [[rls-multi-tenancy]], [[mcp-server]], [[modules-are-flags]], [[claude-md-drifted]]
