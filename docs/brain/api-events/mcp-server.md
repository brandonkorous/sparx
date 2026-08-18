---
title: The MCP server
node: api-events
type: reference
status: active
sources:
  - wizeworks/services/api-mcp/src/server.ts
  - wizeworks/services/api-mcp/src/tool-registry.ts
---

`wizeworks/services/api-mcp` — a **first-class service**, not a plugin. `ALL_MCP_TOOLS` aggregates each module's read/write tool arrays (**~150 tools**: commerce ~32, crm ~34, sitebuilder 22, builder 18, automation 10, email 7, scheduling 7, inventory 6, search 5, domains 5). Tool source lives per package in `packages/<mod>/src/mcp/`.

- **Stateless per request:** each HTTP request authenticates, builds a fresh `McpServer` closing over `{ tenantId, userId }`, registers every enabled tool (skipping per-tenant-disabled via `tool-policy.ts`), dispatches once. Dispatch enforces **scope** → **module gate** (`MODULE_BY_SCOPE`) → Zod parse → run → audit.
- `confirmation: true` tools emit `destructiveHint`; write scopes drive rate limiting.
- **Auth:** Better Auth `mcp` OAuth (see [[better-auth]]) OR the custom `sk_live_*` API keys.
- `wizeworks/services/mcp-site` is the separate **site-facing** MCP.

**How to apply:** add a tool in `packages/<mod>/src/mcp/{read,write}-tools.ts` with a Zod schema + scope; it aggregates into the registry automatically.

Related: [[rest-api]], [[better-auth]], [[one-service-many-transports]]
