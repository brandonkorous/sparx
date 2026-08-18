---
title: API & Events
type: map
status: active
---

# api-events

Our own interfaces — the surfaces other systems (and the dashboard) consume. One service layer, many transports ([[one-service-many-transports]]).

## Notes

- [[rest-api]] — the Fastify REST service (46 v1 domains).
- [[mcp-server]] — the first-class MCP server (~150 tools).
- [[event-catalog]] — the REAL Pub/Sub event names (the doc examples are wrong).
- [[email-pipeline]] — `email.send` → worker → render → send. **Provider is Mailgun, not Postal.**

## Sources of truth

`wizeworks/services/api-rest/src/routes/v1/` · `wizeworks/services/api-mcp/src/tool-registry.ts` · `wizeworks/packages/events/src/types.ts` · `services/email-worker/` + `wizeworks/packages/email/src/`.
