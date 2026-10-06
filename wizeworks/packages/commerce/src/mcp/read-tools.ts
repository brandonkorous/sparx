// Read-only MCP tools. Each is a thin wrapper over a service-layer
// function — a bug fixed in the service fixes the MCP tool at the same
// time. Per locked decision #7 from the CRM architecture, mirrored here.

import { z } from 'zod';

import { MarkupScope } from '@wizeworks/commerce-schemas';

import {
  productService,
  reportingService,
  reviewService,
  subscriptionService,
  cartService,
  fitmentService,
  providerService,
  returnService,
  coreService,
  coreChoiceService,
  markupService,
} from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

const DateRange = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

/**
 * The site CEILING on a report, honored (docs/131 §3.2).
 *
 * `restrictToPropertyId` is set when the CREDENTIAL is site-scoped — currently an
 * `sk_live_` key issued for one business. Builder and sitebuilder already enforce
 * it in their MCP contexts; the commerce reports did not, so a key issued for the
 * donut shop answered "what was our revenue" with the machine shop's numbers in
 * the total. RLS never caught it because both sites belong to the same tenant.
 *
 * Undefined (an unrestricted caller) stays tenant-wide, exactly as before.
 */
function siteCeiling(ctx: { restrictToPropertyId?: string | null }): string | undefined {
  return ctx.restrictToPropertyId ?? undefined;
}

const getProducts: McpToolDefinition = {
  name: 'get_products',
  description: 'List products with optional filters (status, category, vendor, tag, search).',
  scope: 'read:commerce',
  confirmation: false,
  input: z.object({
    status: z.enum(['draft', 'active', 'archived']).optional(),
    categoryId: z.string().uuid().optional(),
    vendor: z.string().max(127).optional(),
    tag: z.string().max(63).optional(),
    q: z.string().max(255).optional(),
    take: z.number().int().min(1).max(100).default(25),
  }),
  run: (ctx, input) => productService.list(ctx, input as Record<string, unknown>),
};

const getProduct: McpToolDefinition = {
  name: 'get_product',
  description: 'Fetch a single product with its variants, fitment, and media.',
  scope: 'read:commerce',
  confirmation: false,
  input: z.object({ productId: z.string().uuid() }),
  run: (ctx, input) => productService.get(ctx, (input as { productId: string }).productId),
};

const getRevenueSummary: McpToolDefinition = {
  name: 'get_revenue_summary',
  description: 'Gross + net revenue, order count, AOV for a date range.',
  scope: 'read:commerce',
  confirmation: false,
  input: DateRange,
  run: (ctx, input) =>
    reportingService.revenueSummary(ctx, input as { from: string; to: string }, siteCeiling(ctx)),
};

const getTopProducts: McpToolDefinition = {
  name: 'get_top_products',
  description: 'Top products by revenue or units for a date range.',
  scope: 'read:commerce',
  confirmation: false,
  input: z.object({
    range: DateRange,
    limit: z.number().int().min(1).max(100).default(10),
  }),
  run: (ctx, input) => {
    const propertyId = siteCeiling(ctx);
    return reportingService.topProducts(ctx, {
      ...(input as { range: { from: string; to: string }; limit: number }),
      ...(propertyId ? { propertyId } : {}),
    });
  },
};

const getTopCustomers: McpToolDefinition = {
  // Distinct from CRM's `get_top_customers` (lifetime spend): this is the
  // commerce sales-report variant, ranked by revenue within a date range. MCP
  // tool names are GLOBAL across modules, so the two cannot share a name — a
  // collision makes the SDK throw at registration and the server can't boot.
  name: 'get_top_customers_by_revenue',
  description: 'Top customers by revenue within a date range (commerce sales report).',
  scope: 'read:commerce',
  confirmation: false,
  input: z.object({
    range: DateRange,
    limit: z.number().int().min(1).max(100).default(10),
  }),
  run: (ctx, input) => {
    const propertyId = siteCeiling(ctx);
    return reportingService.topCustomers(ctx, {
      ...(input as { range: { from: string; to: string }; limit: number }),
      ...(propertyId ? { propertyId } : {}),
    });
  },
};

const getConversionFunnel: McpToolDefinition = {
  name: 'get_conversion_funnel',
  description: 'Sessions → carts → checkouts → orders funnel for a date range.',
  scope: 'read:commerce',
  confirmation: false,
  input: DateRange,
  run: (ctx, input) =>
    reportingService.conversionFunnel(ctx, input as { from: string; to: string }, siteCeiling(ctx)),
};

const getAbandonedCarts: McpToolDefinition = {
  name: 'get_abandoned_carts',
  description: 'Cart abandonment + recovery metrics for a date range.',
  scope: 'read:commerce',
  confirmation: false,
  input: DateRange,
  run: (ctx, input) =>
    reportingService.abandonedCarts(ctx, input as { from: string; to: string }, siteCeiling(ctx)),
};

const getSubscriptionStats: McpToolDefinition = {
  name: 'get_subscription_stats',
  description: 'Active subscriptions, MRR, new + churned counts.',
  scope: 'read:commerce',
  confirmation: false,
  input: DateRange,
  run: (ctx, input) =>
    reportingService.subscriptionMetrics(ctx, input as { from: string; to: string }),
};

const getReviewsPendingModeration: McpToolDefinition = {
  name: 'get_reviews_pending_moderation',
  description: 'Reviews awaiting moderator action.',
  scope: 'read:commerce',
  confirmation: false,
  input: z.object({}),
  run: (ctx) => reviewService.listPendingModeration(ctx),
};

const getSubscriptionsForCustomer: McpToolDefinition = {
  name: 'get_subscriptions_for_customer',
  description: 'List active and paused subscriptions for one customer.',
  scope: 'read:commerce',
  confirmation: false,
  input: z.object({ customerId: z.string().uuid() }),
  run: (ctx, input) =>
    subscriptionService.listForCustomer(ctx, (input as { customerId: string }).customerId),
};

const searchFitment: McpToolDefinition = {
  name: 'search_fitment',
  description: 'Find products that fit a vehicle (make/model/engine/year).',
  scope: 'read:commerce',
  confirmation: false,
  input: z.object({
    makeId: z.string().uuid().optional(),
    modelId: z.string().uuid().optional(),
    engineId: z.string().uuid().optional(),
    year: z.number().int().min(1900).max(2100).optional(),
  }),
  run: (ctx, input) => fitmentService.lookup(ctx, input),
};

const getProviderHealth: McpToolDefinition = {
  name: 'get_provider_health',
  description: 'List installed providers and their health status.',
  scope: 'read:commerce',
  confirmation: false,
  input: z.object({}),
  run: (ctx) => providerService.listInstallations(ctx),
};

const getReturns: McpToolDefinition = {
  name: 'get_returns',
  description: 'List return requests filtered by status.',
  scope: 'read:commerce',
  confirmation: false,
  input: z.object({
    status: z
      .enum([
        'requested',
        'approved',
        'denied',
        'awaiting_shipment',
        'in_transit',
        'received',
        'inspecting',
        'inspected',
        'refunded',
        'exchanged',
        'cancelled',
      ])
      .optional(),
    take: z.number().int().min(1).max(100).default(25),
  }),
  run: (ctx, input) => returnService.list(ctx, input as Record<string, unknown>),
};

const listCoresOwed: McpToolDefinition = {
  name: 'list_cores_owed',
  description:
    'List the cores still owed back: rebuilt parts sold with a refundable core deposit, or bought by sending the old part first, whose old part (the "core") has not come back yet. Each row names the order, customer, part, how many cores are owed, the deposit each, the total that would go back, how many days since the order, and for a send-first line (`coreFirst`) how many units are waiting for their old part before they can go out (`waitingToShip`). Filter by customer, company, order, or how old.',
  scope: 'read:commerce',
  confirmation: false,
  input: z.object({
    customerId: z.string().uuid().optional(),
    companyId: z.string().uuid().optional(),
    orderId: z.string().uuid().optional(),
    olderThanDays: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(500).default(200),
  }),
  run: (ctx, input) => coreService.listOwed(ctx, input),
};

const listCoreChoices: McpToolDefinition = {
  name: 'list_core_choices',
  description:
    'List products whose core charge is sold as a CHOICE rather than a real deposit (typical of a catalog moved in from a store that had no core deposit): "Accept Core Charge (+$150)" beside "Defer Core Charge", or "Ship now add $200 core charge" beside "Ship when core received". Each row gives today’s price on each side, the suggested part price (the old-part-first price) and deposit (the amount the words name, never the price difference), the version that would stay, and a `problem` when the product cannot be changed as it stands. Feed the rows to `convert_core_choices`.',
  scope: 'read:commerce',
  confirmation: false,
  input: z.object({}),
  run: (ctx) => coreChoiceService.listCandidates(ctx),
};

const getCart: McpToolDefinition = {
  name: 'get_cart',
  description: 'Fetch a cart by ID with its priced lines and totals.',
  scope: 'read:commerce',
  confirmation: false,
  input: z.object({ cartId: z.string().uuid() }),
  run: (ctx, input) => cartService.get(ctx, (input as { cartId: string }).cartId),
};

const getDropshipMarginReport: McpToolDefinition = {
  name: 'get_dropship_margin_report',
  description:
    'Profitability report for dropship orders: total and per-supplier revenue, cost, profit, and margin. Optionally filter to a date range; omit both dates for all-time.',
  scope: 'read:commerce',
  confirmation: false,
  input: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }),
  run: (ctx, input) => {
    const { from, to } = input as { from?: string; to?: string };
    return reportingService.dropshipMarginReport(ctx, from && to ? { from, to } : undefined);
  },
};

const getMargin: McpToolDefinition = {
  name: 'get_margin',
  description:
    "Current cost, price, and margin breakdown for one variant: profit, margin % (profit/price) and markup % (profit/cost) as 0–1 fractions, plus the markup rule it's derived from, if any.",
  scope: 'read:commerce',
  confirmation: false,
  input: z.object({ variantId: z.string().uuid() }),
  run: (ctx, input) =>
    markupService.getVariantMargin(ctx, (input as { variantId: string }).variantId),
};

const previewMarkup: McpToolDefinition = {
  name: 'preview_markup',
  description:
    'Dry-run a markup rule across its scope (or an override scope): per-variant before/after price + margin, with no writes. Use before apply_markup to see the impact.',
  scope: 'read:commerce',
  confirmation: false,
  input: z.object({ ruleId: z.string().uuid(), scope: MarkupScope.optional() }),
  run: (ctx, input) => {
    const { ruleId, scope } = input as { ruleId: string; scope?: unknown };
    return markupService.previewRule(ctx, ruleId, scope);
  },
};

// Channel revenue consolidation (docs/27 §8). `channel` is the derived channel
// key: a high-level bucket (site, b2b_portal, admin) OR a marketplace source
// slug (tiktok_shop, etsy, amazon, walmart, ebay, faire, sparx_market). Range is
// optional everywhere and defaults to the last 30 days.
const OptionalDateRange = DateRange.optional();
const ChannelKey = z
  .string()
  .min(1)
  .max(63)
  .describe(
    'Channel key: a bucket (site | b2b_portal | admin) or a marketplace slug (tiktok_shop | etsy | amazon | walmart | ebay | faire | sparx_market).'
  );

const getChannelRevenue: McpToolDefinition = {
  name: 'get_channel_revenue',
  description:
    'Revenue for one sales channel over a date range: gross, refunds, net, marketplace fees, net-after-fees, order count, and AOV. Range defaults to the last 30 days.',
  scope: 'read:commerce',
  confirmation: false,
  input: z.object({ channel: ChannelKey, range: OptionalDateRange }),
  run: (ctx, input) => {
    const propertyId = siteCeiling(ctx);
    return reportingService.channelRevenue(ctx, {
      ...(input as { channel: string; range?: { from: string; to: string } }),
      ...(propertyId ? { propertyId } : {}),
    });
  },
};

const getChannelComparison: McpToolDefinition = {
  name: 'get_channel_comparison',
  description:
    'Revenue compared across every sales channel for a date range. Each native channel and each connected marketplace (TikTok Shop, Etsy, …) as its own line with gross, fees, net, orders, AOV, and share of total. Range defaults to the last 30 days.',
  scope: 'read:commerce',
  confirmation: false,
  input: z.object({ range: OptionalDateRange }),
  run: (ctx, input) =>
    reportingService.channelComparison(
      ctx,
      (input as { range?: { from: string; to: string } }).range,
      siteCeiling(ctx)
    ),
};

const getSalesByTrafficSource: McpToolDefinition = {
  name: 'get_sales_by_traffic_source',
  description:
    "Revenue and order count by the traffic source that produced each sale (search engines, social media, other websites, or direct) over a date range, each with its share of total. Includes an explicit 'unattributed' bucket for sales with no matching same-day web visit (staff, B2B, phone/POS, subscription renewal, or a visit on a different day), plus a count of orders in the window placed before attribution tracking existed. This is the answer to 'which of the things I do actually makes money'. Range defaults to the last 30 days.",
  scope: 'read:commerce',
  confirmation: false,
  input: z.object({ range: OptionalDateRange }),
  run: (ctx, input) =>
    reportingService.attributionBreakdown(
      ctx,
      (input as { range?: { from: string; to: string } }).range,
      siteCeiling(ctx)
    ),
};

const getChannelTopProducts: McpToolDefinition = {
  name: 'get_channel_top_products',
  description:
    'Top products by revenue sold through one channel over a date range (e.g. best sellers on TikTok Shop). Range defaults to the last 30 days.',
  scope: 'read:commerce',
  confirmation: false,
  input: z.object({
    channel: ChannelKey,
    range: OptionalDateRange,
    limit: z.number().int().min(1).max(100).default(10),
  }),
  run: (ctx, input) => {
    const propertyId = siteCeiling(ctx);
    return reportingService.channelTopProducts(ctx, {
      ...(input as { channel: string; range?: { from: string; to: string }; limit: number }),
      ...(propertyId ? { propertyId } : {}),
    });
  },
};

export const readTools: AnyMcpTool[] = [
  getProducts,
  getProduct,
  getRevenueSummary,
  getTopProducts,
  getChannelRevenue,
  getChannelComparison,
  getChannelTopProducts,
  getSalesByTrafficSource,
  getTopCustomers,
  getConversionFunnel,
  getAbandonedCarts,
  getSubscriptionStats,
  getReviewsPendingModeration,
  getSubscriptionsForCustomer,
  searchFitment,
  getProviderHealth,
  getReturns,
  listCoresOwed,
  listCoreChoices,
  getCart,
  getDropshipMarginReport,
  getMargin,
  previewMarkup,
];
