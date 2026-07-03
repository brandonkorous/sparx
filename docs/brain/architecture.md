---
title: Architecture
type: map
status: active
---

# architecture

The binding cross-cutting commitments — each **verified against code**, not taken from docs. (The grounding pass found root `CLAUDE.md`'s "early scaffold" framing badly stale — see [[claude-md-drifted]]. The *commitments* below are real; the repo-status framing is not.)

## Commitments

- [[rls-multi-tenancy]] — Postgres RLS is the tenant backstop; every handler runs inside `withTenant`.
- [[better-auth]] — self-hosted; Better Auth orgs = tenants; two instances (staff + customer).
- [[modules-are-flags]] — gate by module flag, never by plan; 404 when disabled.
- [[event-driven]] — publish events; never inline side effects.
- [[one-service-many-transports]] — API-first + MCP-first; REST / MCP / GraphQL are separate services over one service layer.

## Sources of truth

`packages/db/src/tenant-context.ts` · `packages/auth/src/server.ts` · `packages/modules/src/index.ts` · `packages/events/src/` · `services/api-rest` + `services/api-mcp` + `services/CLAUDE.md`.
