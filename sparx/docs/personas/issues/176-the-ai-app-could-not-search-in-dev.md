# 176 — The AI app could not search: "TYPESENSE_API_KEY env var is required"

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 12 (AI over MCP)
**Surface:** MCP `search_all`, `search_products` (local dev)
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 over MCP, 2026-10-11
**Blocked on:** —

## What happened

Doty's AI app called `search_all` and `search_products`. Both answered "TYPESENSE_API_KEY
env var is required": a setup message about the server, handed to the customer's app.
The workbench's own search works.

## What should have happened

The search answers. A missing server setting is never the customer's message.

## Where it lives

The MCP service's local settings (`wizeworks/services/api-mcp/.env`, and the
`.env.example` it is copied from) had no search settings; api-rest's have them. The
cluster sets them for the MCP service (`k8s/apps/api-mcp.yaml`), so production is not
affected.

## The fix

The four search settings added to `wizeworks/services/api-mcp/.env.example`, with why,
and to the local `.env` (same values as api-rest). The service reads them at start.

## Confirmed by

P01, 2026-10-11, after Brandon restarted dev, over Doty's key: `search_products` with
"fuel tank" found 40, the first "Titan Fuel Tanks Power Stroke Diesel Fuel Tank 65 gallon
7020317" and two S&B tanks; `search_all` with "wasatch" found Renée and Teodora. Reading
the copy it returned found issue 223.

## Rating effect

—
