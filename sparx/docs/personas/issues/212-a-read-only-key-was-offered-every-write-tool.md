# 212 — A read-only key was offered every write tool

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 12 (AI over MCP)
**Surface:** the MCP server, as Doty's AI app sees it (`tools/list`)
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 over MCP, 2026-10-09
**Blocked on:** —

## What happened

Doty made a key for his AI app with five read scopes ("Claude on Doty's laptop": CRM,
commerce, search, invoicing, wholesale, all read). His app asked the server what it
could do and was offered all 634 tools, 423 of them writes (create a product, send a
broadcast, approve an order…) and tools for modules Gillett has not turned on. Each
write it tried came back "forbidden: tool … requires scope … which is not granted".

## What should have happened

An AI app is offered what its key can do. Doty chose read-only on purpose; the app should
not be invited to try to change his business, only to be refused each time.

## Where it lives

`wizeworks/services/api-mcp/src/server.ts` `buildServerForRequest`: every tool not
switched off by the tenant was registered. The scope and module checks ran only when a
tool was called (`dispatch`).

## The fix

- `services/api-mcp/src/tool-listing.ts` `toolsToList`: a tool is offered only when the
  tenant has not switched it off, the credential holds its scope, and its module is on.
- `buildServerForRequest` registers through it, reading which modules are on once per
  connection. `dispatch` keeps its checks as the backstop.

Shared: the same server answers every brand's tenants.

Tests, red first: `tool-listing.test.ts` (3 for the filter, 1 that the server registers
through it, proved red before the change). api-mcp 28 pass (as CI runs them); lint
clean.

## Confirmed by

P01 over MCP, 2026-10-09, with Doty's key (the AI app's own view, which is this surface's
screen): `tools/list` now offers 85 tools, none a write, exactly the tools his five read
scopes allow; before, 634. A listed tool still answers: `list_b2b_invoices` returned
Gillett's invoices, invoice 4471 overdue 43 days first.

## Rating effect

—
