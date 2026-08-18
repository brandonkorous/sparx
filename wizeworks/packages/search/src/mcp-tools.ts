// Search MCP tools. Read-only, scope `read:search`. Thin wrappers over the
// same tenant-scoped query functions the REST transport uses (one service,
// many transports). The MCP server (wizeworks/services/api-mcp) spreads `searchMcpTools`
// into its registry; the tenant comes from the MCP auth context, never the
// tool input — so an agent can only ever search its own tenant.

import { z } from 'zod';

import { palette, searchCustomers, searchOrders, searchProducts } from './search';

// Structural shape the api-mcp registry expects (AnyMcpTool). Kept local so
// @wizeworks/search doesn't depend on the MCP server. `scope` is a plain string;
// api-mcp adds 'read:search' to its scope vocabulary + role defaults.
export interface SearchMcpTool {
  name: string;
  description: string;
  scope: 'read:search';
  input: z.ZodType;
  confirmation: boolean;
  run(ctx: { tenantId: string; userId: string }, input: unknown): Promise<unknown>;
}

const PaginationArgs = {
  page: z.number().int().min(1).optional(),
  perPage: z.number().int().min(1).max(100).optional(),
};

const searchProductsTool: SearchMcpTool = {
  name: 'search_products',
  description:
    'Typo-tolerant product search across title, description, SKU, tags, and vendor. ' +
    'Supports fitment filters (makes/models/engines/year) for vehicle/equipment catalogs. ' +
    'Returns ranked matches with facet counts.',
  scope: 'read:search',
  confirmation: false,
  input: z.object({
    q: z.string().max(255).optional(),
    fitmentMakes: z.array(z.string()).max(20).optional(),
    fitmentModels: z.array(z.string()).max(20).optional(),
    fitmentEngines: z.array(z.string()).max(20).optional(),
    fitmentYear: z.number().int().optional(),
    ...PaginationArgs,
  }),
  run: (ctx, input) => {
    const args = input as {
      q?: string;
      fitmentMakes?: string[];
      fitmentModels?: string[];
      fitmentEngines?: string[];
      fitmentYear?: number;
      page?: number;
      perPage?: number;
    };
    return searchProducts({ tenantId: ctx.tenantId, ...args });
  },
};

const searchCustomersTool: SearchMcpTool = {
  name: 'search_customers',
  description:
    'Typo-tolerant customer search across name, email, company, and phone. ' +
    'Returns ranked matches scoped to your tenant.',
  scope: 'read:search',
  confirmation: false,
  input: z.object({
    q: z.string().min(1).max(255),
    ...PaginationArgs,
  }),
  run: (ctx, input) => {
    const args = input as { q: string; page?: number; perPage?: number };
    return searchCustomers({ tenantId: ctx.tenantId, ...args });
  },
};

const searchOrdersTool: SearchMcpTool = {
  name: 'search_orders',
  description:
    'Typo-tolerant order search across order number, customer name/email, and item titles/SKUs. ' +
    'Useful for "find order WW-1234" or "orders mentioning injector".',
  scope: 'read:search',
  confirmation: false,
  input: z.object({
    q: z.string().min(1).max(255),
    ...PaginationArgs,
  }),
  run: (ctx, input) => {
    const args = input as { q: string; page?: number; perPage?: number };
    return searchOrders({ tenantId: ctx.tenantId, ...args });
  },
};

const searchAllTool: SearchMcpTool = {
  name: 'search_all',
  description:
    'Cross-collection search (products + customers + orders) in one call — the ⌘K palette. ' +
    'Returns the top few matches per collection. Use for a quick "what do we have matching X?".',
  scope: 'read:search',
  confirmation: false,
  input: z.object({
    q: z.string().min(1).max(255),
    limitPerCollection: z.number().int().min(1).max(20).optional(),
  }),
  run: (ctx, input) => {
    const args = input as { q: string; limitPerCollection?: number };
    return palette({ tenantId: ctx.tenantId, ...args });
  },
};

/** The full search tool set the MCP server publishes. */
export const searchMcpTools: SearchMcpTool[] = [
  searchProductsTool,
  searchCustomersTool,
  searchOrdersTool,
  searchAllTool,
];
