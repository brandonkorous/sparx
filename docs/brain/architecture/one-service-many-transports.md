---
title: One service, many transports (API-first, MCP-first)
node: architecture
type: rule
status: active
sources:
  - services/api-rest/src/app.ts
  - services/api-mcp/src/tool-registry.ts
  - services/CLAUDE.md
---

Every UI feature exists as an **API endpoint first**; the dashboard is one consumer among many. REST (`services/api-rest`), MCP (`services/api-mcp`), and GraphQL (`services/api-graphql`) are **separate first-class services** that dispatch into the **same module service layer** — "one service, many transports."

- The **MCP server is first-class**, not a plugin or afterthought ([[mcp-server]]).
- **Respect service boundaries:** GraphQL is its own service — `services/CLAUDE.md` explicitly forbids bundling it into api-rest. Don't add functionality to a service whose name/docs exclude it.

**Why:** transport-specific business logic drifts; a shared service layer keeps REST and MCP behaviourally identical.

**How to apply:** new capability → write the service-layer function first, then thin REST + MCP adapters over it. See [[api-events]].

Related: [[rest-api]], [[mcp-server]], [[api-events]]
