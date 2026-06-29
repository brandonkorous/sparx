# WizeWorks Platform — MCP Server Specification

**Version:** 1.4  
**Author:** Brandon Korous  
**Last Updated:** 2026-06-29

---

## 1. Overview

The WizeWorks MCP (Model Context Protocol) Server is a first-class platform service that exposes tenant business data to AI assistants — Claude, ChatGPT, and Microsoft Copilot. It enables natural language interaction with live business data without any custom integration work by the tenant.

The MCP server runs as a dedicated Kubernetes deployment. Access is gated by the **`ai` module** (the AI-Integrations capability), consistent with sparx's module-based model — a tenant activates the `ai` module to use MCP, exactly as it activates any other module. There are **no plan tiers** (no Starter/Pro/Enterprise); "a tenant pays only for what it uses." A request from a tenant without the `ai` module active is rejected at the transport. Per-tool scopes then decide which module's tools each call can run, and a tenant may additionally **disable individual tools** for all of its connections — the per-tenant tool policy (§9).

---

## 2. Supported AI Clients

| Client             | Connection Method | Auth               |
| ------------------ | ----------------- | ------------------ |
| Claude (Anthropic) | MCP over SSE      | OAuth2 / API key   |
| ChatGPT (OpenAI)   | MCP over HTTP     | OAuth2 / API key   |
| Microsoft Copilot  | MCP over HTTP     | OAuth2 / AAD token |

---

## 3. Available Tools

### Orders

| Tool                     | Description                                             |
| ------------------------ | ------------------------------------------------------- |
| `get_orders`             | List orders with filters (status, date range, customer) |
| `get_order`              | Get full detail for a single order                      |
| `get_order_stats`        | Revenue, count, AOV for a time period                   |
| `get_top_customers`      | Customers ranked by spend for a period                  |
| `get_unfulfilled_orders` | Orders awaiting fulfillment                             |
| `update_order_status`    | Change order status (with confirmation)                 |

### Customers & CRM

| Tool                     | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `get_customers`          | List customers with search and filters          |
| `get_customer`           | Full customer profile, order history, CRM notes |
| `get_inactive_customers` | Customers with no orders in N days              |
| `get_b2b_accounts`       | List B2B/wholesale accounts with credit status  |
| `add_crm_note`           | Add a note to a customer record                 |
| `get_pipeline`           | Current deals in CRM pipeline                   |

### Products

| Tool                      | Description                |
| ------------------------- | -------------------------- |
| `get_products`            | List products with filters |
| `get_product_performance` | Sales data per product     |

### Inventory (Inventory module)

The supply-loop surface — scoped `read:inventory` / `write:inventory`, gated on the
`inventory` module (reachable standalone, without commerce). Write tools confirm.

| Tool                      | Scope             | Description                                       |
| ------------------------- | ----------------- | ------------------------------------------------- |
| `get_low_inventory`       | `read:inventory`  | Variants at or below their reorder point          |
| `get_inventory_valuation` | `read:inventory`  | On-hand units + value at cost and retail          |
| `suggest_reorders`        | `read:inventory`  | Reorder suggestions grouped by preferred supplier |
| `update_inventory`        | `write:inventory` | Adjust on-hand for a variant (AI-attributed)      |
| `create_purchase_order`   | `write:inventory` | Draft a PO to a supplier with line items          |
| `receive_stock`           | `write:inventory` | Receive stock against a submitted PO              |

### Dropship

| Tool                          | Description                         |
| ----------------------------- | ----------------------------------- |
| `get_dropship_suppliers`      | List connected suppliers            |
| `sync_supplier`               | Trigger catalog sync for a supplier |
| `get_pending_dropship_orders` | Orders awaiting supplier submission |

### Email

| Tool              | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `send_broadcast`  | Send email to a customer segment (with confirmation) |
| `get_email_stats` | Delivery, open, click rates                          |
| `get_automations` | List active email automations                        |

### Analytics

| Tool                   | Description                                 |
| ---------------------- | ------------------------------------------- |
| `get_revenue_summary`  | Revenue by period, compared to prior period |
| `get_sales_by_product` | Top products by revenue/units               |
| `get_sales_by_channel` | Revenue breakdown by traffic source         |
| `get_conversion_rate`  | Store conversion funnel metrics             |

---

## 4. Example Interactions

```
User: "What are my top 10 customers by revenue this quarter?"

MCP → get_top_customers({ period: "this_quarter", limit: 10 })
→ Returns ranked list with name, email, spend, order count

AI: "Here are your top 10 customers this quarter:
1. Acme Fleet Services — $47,200 (12 orders)
2. Desert Trucking Co — $38,500 (8 orders)
..."
```

```
User: "Which customers haven't ordered in 90 days? Send them a win-back email."

MCP → get_inactive_customers({ days: 90 })
→ Returns 47 customers

AI: "I found 47 customers who haven't ordered in 90 days.
I'll use your 'Win-Back' email template. Confirm to send?"

User: "Yes"

MCP → send_broadcast({
  template: "win-back",
  customer_ids: [...],
  subject: "We miss you — here's 10% off"
})
```

```
User: "What's my revenue this month vs last month?"

MCP → get_revenue_summary({ period: "this_month", compare_to: "last_month" })

AI: "This month: $84,200 (↑ 23% vs $68,400 last month).
Best performing product: Bosch Injector Set at $12,400."
```

---

## 5. Authentication

### Tenant Connection Flow

1. Tenant opens **Settings → AI Integrations**
2. Selects AI client (Claude, ChatGPT, Copilot)
3. Clicks "Connect" — generates a scoped API key. The chosen client is recorded on the key (`api_keys.client` ∈ `claude | chatgpt | copilot | custom`) so the dashboard can label each connection by its assistant. This is descriptive metadata only — it never affects verification or scope.
4. Copies the MCP server URL + API key into their AI client
5. AI client can now access their tenant data

### API Key Scopes

```
read:orders         read:customers      read:products
read:analytics      read:crm            read:email_stats
read:inventory      write:inventory     write:crm_notes
write:order_status  write:email_send
```

The `inventory` tools carry their own `read:inventory` / `write:inventory` scopes and
are additionally gated on the `inventory` module flag — they refuse when the module
is off, so a commerce-only tenant without Inventory active sees no inventory tools.

Write tools require explicit scope grants and always include confirmation steps.

---

## 6. Server Implementation

```typescript
// src/mcp/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'wizeworks',
  version: '1.0.0',
});

server.tool(
  'get_top_customers',
  {
    period: z.enum(['today', 'this_week', 'this_month', 'this_quarter', 'this_year']),
    limit: z.number().min(1).max(100).default(10),
  },
  async ({ period, limit }, context) => {
    const tenantId = context.auth.tenantId;
    const customers = await customerService.getTopBySpend({ tenantId, period, limit });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(customers),
        },
      ],
    };
  }
);
```

---

## 7. Rate Limiting

Rate limits are an **abuse cap, not a billing tier** — eligibility is the `ai` module (§1), so every MCP-eligible tenant gets the same flat per-tenant quota:

| Scope                     | Limit |
| ------------------------- | ----- |
| Requests/minute           | 60    |
| Requests/day              | 5,000 |
| Write `tools/call`/minute | 10    |

The write sub-cap is independent of the overall per-minute cap, to blunt accidental bulk actions. The numbers are a single tunable constant (`MCP_QUOTA` in `services/api-mcp/src/rate-limit.ts`) — there are no per-tenant tiers to thread through.

---

## 8. Audit Trail

All MCP tool calls are logged to the audit log with:

- Actor: `system/mcp/{client}` (e.g., `system/mcp/claude`)
- Action: tool name
- Parameters: sanitized (no PII in log keys)
- Result: success/failure
- Timestamp

Tenants can view their full AI interaction history in the dashboard.

> **Implementation note (v1.4).** The audit row's `entity_id` column is a `uuid`; the tool **name** lives in `action` (`mcp.<tool>`), never in `entity_id`. (An earlier build wrote the name into `entity_id`, which failed the uuid cast and was swallowed by the audit writer's catch — so no `McpToolCall` rows persisted. Fixed by leaving `entity_id` null.) The dashboard's `/v1/ai/reports/*` aggregates read `action` + `diff.outcome` + `actor_id` only.

---

## 9. Per-Tenant Tool Policy

The tool catalog (§3) is code-defined and identical for every tenant; **scopes + the `ai` module gate** decide what a given API key can call. On top of that, a tenant may **disable individual tools** for ALL of its connections — a per-tenant allow/deny overlay (the kill switch a cautious tenant wants for, say, `update_order_status` or `purchase_domain`, without revoking the whole key).

- **Storage:** `ai_tool_policies` (tenant-scoped, FORCE RLS) — one row per overridden tool: `{ tool_name, enabled }`. **Absence of a row = exposed** (the default-on behavior, so a tenant that never touches this surface sees no change). A row with `enabled = false` disables the tool.
- **Enforcement (`services/api-mcp`):** the per-request server factory loads the tenant's disabled set once (`loadDisabledTools`, under the tenant GUC) and **does not register** disabled tools. They are therefore absent from `tools/list`, and the MCP SDK rejects any direct `tools/call` for an unregistered name — registration-skip IS the enforcement. The policy load fails **open** (all tools exposed) on a read error, so a transient DB blip never silently strips the assistant.
- **Management:** `GET /v1/ai/tool-policies` returns the full catalog with each tool's effective exposure; `PUT /v1/ai/tool-policies/:tool` (`{enabled}`) flips one; `DELETE /v1/ai/tool-policies/:tool` resets one to default; `POST /v1/ai/tool-policies/reset` clears every override. Reads are viewer; writes are **admin** (a security control, same bar as issuing an API key). Surfaced in the dashboard at **/ai/tools**.

---

## 10. AI Prompt-Template Library

A tenant-scoped library of reusable, named AI prompts — a support-assistant **persona** plus authoring prompts for product copy, lifecycle email, support replies, SEO, social, and review responses.

- **Storage:** `ai_prompt_templates` (tenant-scoped, FORCE RLS): `{ key, name, description, category, body, variables, model, enabled, metadata }`. `key` is a per-tenant unique slug (the idempotency handle); `body` may carry `{{variable}}` placeholders the consuming flow fills; `category ∈ persona | support | email | product | seo | social | crm | general`; `model` is an optional per-prompt model override.
- **Seeded via the real provisioning paths:** the **`ai` module preset** (`ai-prompt-library-core`) installs the platform default library (ensure-by-key, idempotent — never overwrites a tenant's edited copy), and every **industry starter** references it, so picking a vertical with AI active seeds the prompts too. Sample data adds demo prompts (cleared by "Clear sample data").
- **Consumed (not a CRUD island):** the live-chat first-responder (`services/api-rest/src/lib/chat/ai-handler.ts`) reads the tenant's active enabled **`persona`** template to ground its system prompt and pick its model — falling back to the platform default voice. The functional tool contract (the `respond` tool + confidence + escalation) is always appended and is never overridable by a persona.
- **Management:** `GET/POST /v1/ai/prompt-templates`, `GET/PATCH/DELETE /v1/ai/prompt-templates/:id`, and `POST /v1/ai/prompt-templates/install-defaults`. Reads are viewer, writes are editor, the bulk default-install is admin. Surfaced in the dashboard at **/ai/prompts**.
