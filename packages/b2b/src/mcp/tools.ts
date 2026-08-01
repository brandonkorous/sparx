// B2B MCP tools (docs/10) — run the wholesale trade surface from an agent: pricing
// tiers + overrides, account trade config + fleet, purchase-approval rules + queue,
// and net-terms AR invoices. Thin wrappers over @sparx/b2b's service layer, the
// same functions the REST routes drive (one service, many transports).
//
// Event emission mirrors the api-mcp domain/search-admin tool registries: a
// createPublisher from @sparx/events (api-mcp does not configure the api-core
// publisher, so the service returns the events to publish and we emit them here
// against a real Pub/Sub client — `order.placed` on approval MUST reach the
// fulfillment consumers).
//
// Not here: CSV import/export (a file surface), the read-only reporting rollups,
// and account-record CRUD (companyName / contacts / assigned rep) — that lives on
// the CRM registry's create_b2b_account / update_b2b_account / add_b2b_account_contact.

import { z } from 'zod';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';
import { inventoryService } from '@sparx/inventory';

import {
  pricingTierService,
  accountService,
  approvalService,
  invoiceService,
  resolvePrimaryPropertyId,
  type PendingEvent,
} from '../service.js';
import type { B2bMcpCtx, McpToolDefinition } from './registry.js';

const pubLogger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};
// api-mcp reads GCP_PROJECT_ID from its env; unset in dev → a stdout-logging stub
// (the same dev parity the REST publisher + api-core stub give).
const publisher = createPublisher({ logger: pubLogger });

async function emit(ctx: B2bMcpCtx, events: PendingEvent[]): Promise<void> {
  for (const e of events) {
    await publishEvent(publisher, e.type, ctx.tenantId, ctx.userId ?? null, e.payload, pubLogger);
  }
}

const uuid = () => z.string().uuid();

// Override body shared by tier + account overrides (a plain object; the service
// re-validates the "exactly one target / exactly one price rule" refinement).
const overrideFields = {
  variantId: uuid().optional(),
  collectionId: uuid().optional(),
  priceCents: z.number().int().min(0).optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
} as const;

// ── Reads ────────────────────────────────────────────────────────────────────

const listPricingTiers: McpToolDefinition = {
  name: 'list_b2b_pricing_tiers',
  description:
    'List B2B pricing tiers — the named trade discounts (percentage or fixed) assigned to wholesale accounts. Optionally filter by name/description text.',
  scope: 'read:b2b',
  confirmation: false,
  input: z.object({
    q: z.string().trim().min(1).max(200).optional(),
    take: z.number().int().min(1).max(250).optional(),
    skip: z.number().int().min(0).optional(),
  }),
  run: (ctx, input) =>
    pricingTierService.listTiers(ctx, input as pricingTierService.ListTiersInput),
};

const getPricingTier: McpToolDefinition = {
  name: 'get_b2b_pricing_tier',
  description: 'Fetch one B2B pricing tier by id, with its assigned-account count.',
  scope: 'read:b2b',
  confirmation: false,
  input: z.object({ tierId: uuid() }),
  run: (ctx, input) => pricingTierService.getTier(ctx, (input as { tierId: string }).tierId),
};

const listTierOverrides: McpToolDefinition = {
  name: 'list_b2b_tier_overrides',
  description:
    'List the per-variant / per-collection price overrides on one pricing tier (pins a product to a price or a deeper discount for accounts on that tier).',
  scope: 'read:b2b',
  confirmation: false,
  input: z.object({ tierId: uuid() }),
  run: (ctx, input) =>
    pricingTierService.listTierOverrides(ctx, (input as { tierId: string }).tierId),
};

const getAccount: McpToolDefinition = {
  name: 'get_b2b_account',
  description:
    'Fetch one B2B account with its trade enrichment: assigned pricing tier, credit limit / used / remaining, payment terms, status, fleet vehicles, and override count. (Use the CRM get_b2b_accounts tool to browse the roster.)',
  scope: 'read:b2b',
  confirmation: false,
  input: z.object({ accountId: uuid() }),
  run: (ctx, input) => accountService.getAccount(ctx, (input as { accountId: string }).accountId),
};

const listAccountOverrides: McpToolDefinition = {
  name: 'list_b2b_account_overrides',
  description:
    'List the per-variant / per-collection price overrides pinned to ONE B2B account (the deepest, account-specific layer of the trade-price waterfall).',
  scope: 'read:b2b',
  confirmation: false,
  input: z.object({ accountId: uuid() }),
  run: (ctx, input) =>
    accountService.listAccountOverrides(ctx, (input as { accountId: string }).accountId),
};

const resolveB2bPrice: McpToolDefinition = {
  name: 'resolve_b2b_price',
  description:
    'Resolve the effective price ONE account pays for ONE variant, running the full trade waterfall (account override → contract price → tier override → tier blanket discount → list). Returns effectivePriceCents (null = list price applies).',
  scope: 'read:b2b',
  confirmation: false,
  input: z.object({ variantId: uuid(), accountId: uuid() }),
  run: (ctx, input) =>
    pricingTierService.resolveB2bPrice(ctx, input as { variantId: string; accountId: string }),
};

const getProductPricing: McpToolDefinition = {
  name: 'get_b2b_product_pricing',
  description:
    'Every trade-pricing RULE that touches one product — its variants, all tiers, tier overrides, account overrides, and contract prices — joined in one call for a pricing panel.',
  scope: 'read:b2b',
  confirmation: false,
  input: z.object({ productId: uuid() }),
  run: (ctx, input) =>
    pricingTierService.getProductPricing(ctx, (input as { productId: string }).productId),
};

const listApprovalRules: McpToolDefinition = {
  name: 'list_b2b_approval_rules',
  description:
    'List purchase-approval rules — the spending thresholds (per account and/or per site) above which a B2B order parks for staff approval before it can place.',
  scope: 'read:b2b',
  confirmation: false,
  input: z.object({}),
  run: (ctx) => approvalService.listRules(ctx),
};

const listApprovalQueue: McpToolDefinition = {
  name: 'list_b2b_approval_queue',
  description:
    'List B2B orders parked in pending_approval, awaiting an approve/reject decision. Optionally filter by account or search by order number / customer / company.',
  scope: 'read:b2b',
  confirmation: false,
  input: z.object({
    q: z.string().trim().min(1).max(200).optional(),
    account_id: uuid().optional(),
    take: z.number().int().min(1).max(250).optional(),
    skip: z.number().int().min(0).optional(),
  }),
  run: (ctx, input) =>
    approvalService.listQueue(ctx, {
      take: 50,
      skip: 0,
      ...(input as Partial<approvalService.ApprovalQueueInput>),
    }),
};

const listInvoices: McpToolDefinition = {
  name: 'list_b2b_invoices',
  description:
    'List B2B net-terms AR invoices (receivables). Optionally filter by account or status (unpaid / partial / paid / overdue / void).',
  scope: 'read:b2b',
  confirmation: false,
  input: z.object({
    account_id: uuid().optional(),
    status: z.enum(['unpaid', 'partial', 'paid', 'overdue', 'void']).optional(),
    take: z.number().int().min(1).max(250).optional(),
    skip: z.number().int().min(0).optional(),
  }),
  run: (ctx, input) =>
    invoiceService.listInvoices(ctx, {
      take: 50,
      skip: 0,
      ...(input as Partial<invoiceService.InvoiceListInput>),
    }),
};

const getInvoice: McpToolDefinition = {
  name: 'get_b2b_invoice',
  description: 'Fetch one B2B net-terms AR invoice by id, with its payment history.',
  scope: 'read:b2b',
  confirmation: false,
  input: z.object({ invoiceId: uuid() }),
  run: (ctx, input) => invoiceService.getInvoice(ctx, (input as { invoiceId: string }).invoiceId),
};

// ── Pricing tiers (write) ────────────────────────────────────────────────────

const createPricingTier: McpToolDefinition = {
  name: 'create_b2b_pricing_tier',
  description:
    'Create a B2B pricing tier: a named trade discount. `discountType` percentage|fixed with `discountValue`; `productScope` all|collections|products; `minOrderCents` optional floor. Assign it to accounts via update_b2b_account_trade_config.',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({
    name: z.string().min(1).max(127),
    description: z.string().max(2000).optional(),
    discountType: z.enum(['percentage', 'fixed']),
    discountValue: z.number().min(0),
    productScope: z.enum(['all', 'collections', 'products']).optional(),
    minOrderCents: z.number().int().min(0).optional(),
  }),
  run: (ctx, input) => pricingTierService.createTier(ctx, input),
};

const updatePricingTier: McpToolDefinition = {
  name: 'update_b2b_pricing_tier',
  description: 'Update a B2B pricing tier (name, description, discount, product scope, min order).',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({
    tierId: uuid(),
    name: z.string().min(1).max(127).optional(),
    description: z.string().max(2000).optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    discountValue: z.number().min(0).optional(),
    productScope: z.enum(['all', 'collections', 'products']).optional(),
    minOrderCents: z.number().int().min(0).optional(),
  }),
  run: (ctx, input) => {
    const { tierId, ...patch } = input as { tierId: string } & Record<string, unknown>;
    return pricingTierService.updateTier(ctx, tierId, patch);
  },
};

const deletePricingTier: McpToolDefinition = {
  name: 'delete_b2b_pricing_tier',
  description:
    'Soft-delete a B2B pricing tier. Accounts keep the FK but resolve to list price; the tier is hidden from the list.',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({ tierId: uuid() }),
  run: (ctx, input) => pricingTierService.deleteTier(ctx, (input as { tierId: string }).tierId),
};

const addTierOverride: McpToolDefinition = {
  name: 'add_b2b_tier_override',
  description:
    'Add a per-product override to a pricing tier: pin exactly one of variantId | collectionId to exactly one of priceCents | discountPercentage.',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({ tierId: uuid(), ...overrideFields }),
  run: (ctx, input) => {
    const { tierId, ...body } = input as { tierId: string } & Record<string, unknown>;
    return pricingTierService.addTierOverride(ctx, tierId, body);
  },
};

const updateTierOverride: McpToolDefinition = {
  name: 'update_b2b_tier_override',
  description: 'Update a tier price override.',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({ tierId: uuid(), overrideId: uuid(), ...overrideFields }),
  run: (ctx, input) => {
    const { tierId, overrideId, ...body } = input as {
      tierId: string;
      overrideId: string;
    } & Record<string, unknown>;
    return pricingTierService.updateTierOverride(ctx, tierId, overrideId, body);
  },
};

const removeTierOverride: McpToolDefinition = {
  name: 'remove_b2b_tier_override',
  description: 'Remove a tier price override.',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({ tierId: uuid(), overrideId: uuid() }),
  run: (ctx, input) => {
    const { tierId, overrideId } = input as { tierId: string; overrideId: string };
    return pricingTierService.removeTierOverride(ctx, tierId, overrideId);
  },
};

// ── Account trade config (write) ──────────────────────────────────────────────

const updateAccountTradeConfig: McpToolDefinition = {
  name: 'update_b2b_account_trade_config',
  description:
    'Update a B2B account’s trade config: assign a validated pricing tier (pricingTierId, or null to clear), credit limit (cents), payment terms, blanket discount, status (active / credit_hold / suspended / inactive), internal notes, fleet size. This is the B2B-module editor; the CRM update_b2b_account tool owns the account record itself (company, contacts, rep).',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({
    accountId: uuid(),
    pricingTierId: uuid().nullable().optional(),
    creditLimitCents: z.number().int().min(0).optional(),
    paymentTerms: z.enum(['prepay', 'net30', 'net60', 'net90']).nullable().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    status: z.enum(['active', 'credit_hold', 'suspended', 'inactive']).optional(),
    internalNotes: z.string().max(5000).nullable().optional(),
    fleetSize: z.number().int().min(0).nullable().optional(),
  }),
  run: (ctx, input) => {
    const { accountId, ...patch } = input as { accountId: string } & Record<string, unknown>;
    return accountService.updateTradeConfig(ctx, accountId, patch);
  },
};

const setAccountFleet: McpToolDefinition = {
  name: 'set_b2b_account_fleet',
  description:
    'Replace a B2B account’s fleet. Each vehicle is a generalized fitment selection: a fitment domainId, an optional deepest nodeId, optional rangeValues (per-dimension numbers, e.g. a year), plus label / vin / mileage / count. Drives the account’s compatible-products view. Every domain + node is validated against this tenant’s fitment tree.',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({
    accountId: uuid(),
    vehicles: z
      .array(
        z.object({
          label: z.string().min(1).max(127),
          vin: z.string().length(17).optional(),
          domainId: uuid(),
          nodeId: uuid().nullish(),
          rangeValues: z
            .array(z.object({ dimensionKey: z.string().min(1), value: z.number() }))
            .max(16)
            .optional(),
          mileage: z.number().int().nonnegative().optional(),
          notes: z.string().max(2000).optional(),
          count: z.number().int().min(1).optional(),
        })
      )
      .max(100),
    fleetSize: z.number().int().min(0).optional(),
  }),
  run: (ctx, input) => {
    const { accountId, ...body } = input as { accountId: string } & Record<string, unknown>;
    return accountService.setFleet(ctx, accountId, body);
  },
};

const addAccountOverride: McpToolDefinition = {
  name: 'add_b2b_account_override',
  description:
    'Pin a per-product price override to ONE B2B account (the deepest layer of the trade waterfall): exactly one of variantId | collectionId to exactly one of priceCents | discountPercentage.',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({ accountId: uuid(), ...overrideFields }),
  run: (ctx, input) => {
    const { accountId, ...body } = input as { accountId: string } & Record<string, unknown>;
    return accountService.addAccountOverride(ctx, accountId, body);
  },
};

const updateAccountOverride: McpToolDefinition = {
  name: 'update_b2b_account_override',
  description: 'Update an account price override.',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({ accountId: uuid(), overrideId: uuid(), ...overrideFields }),
  run: (ctx, input) => {
    const { accountId, overrideId, ...body } = input as {
      accountId: string;
      overrideId: string;
    } & Record<string, unknown>;
    return accountService.updateAccountOverride(ctx, accountId, overrideId, body);
  },
};

const removeAccountOverride: McpToolDefinition = {
  name: 'remove_b2b_account_override',
  description: 'Remove an account price override.',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({ accountId: uuid(), overrideId: uuid() }),
  run: (ctx, input) => {
    const { accountId, overrideId } = input as { accountId: string; overrideId: string };
    return accountService.removeAccountOverride(ctx, accountId, overrideId);
  },
};

// ── Purchase-approval rules (write) ───────────────────────────────────────────

const createApprovalRule: McpToolDefinition = {
  name: 'create_b2b_approval_rule',
  description:
    'Create a purchase-approval rule: orders at/above minAmountCents park for staff approval. Scope with accountId (null = every account) and propertyId (explicit null = every site; omit to use the tenant’s primary site). Optional requiredApproverUserId names who must sign off.',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({
    accountId: uuid().nullable().optional(),
    propertyId: uuid().nullable().optional(),
    minAmountCents: z.number().int().min(0),
    requiredApproverUserId: uuid().nullable().optional(),
    isActive: z.boolean().optional(),
  }),
  run: async (ctx, input) => {
    const defaultPropertyId = await resolvePrimaryPropertyId(ctx);
    return approvalService.createRule(ctx, input, defaultPropertyId);
  },
};

const updateApprovalRule: McpToolDefinition = {
  name: 'update_b2b_approval_rule',
  description: 'Update a purchase-approval rule (threshold, required approver, active flag).',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({
    ruleId: uuid(),
    minAmountCents: z.number().int().min(0).optional(),
    requiredApproverUserId: uuid().nullable().optional(),
    isActive: z.boolean().optional(),
  }),
  run: (ctx, input) => {
    const { ruleId, ...patch } = input as { ruleId: string } & Record<string, unknown>;
    return approvalService.updateRule(ctx, ruleId, patch);
  },
};

const deleteApprovalRule: McpToolDefinition = {
  name: 'delete_b2b_approval_rule',
  description: 'Deactivate a purchase-approval rule (soft — preserves its history).',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({ ruleId: uuid() }),
  run: (ctx, input) => approvalService.deleteRule(ctx, (input as { ruleId: string }).ruleId),
};

// ── Approval queue (write) ────────────────────────────────────────────────────

const approveOrder: McpToolDefinition = {
  name: 'approve_b2b_order',
  description:
    'Approve a pending B2B order. This PLACES a real order: it commits stock, issues the net-terms AR invoice (if the order requested terms), and announces order.placed to fulfillment. Confirm before running.',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({ orderId: uuid(), reason: z.string().max(1000).optional() }),
  run: async (ctx, input) => {
    const { orderId, reason } = input as { orderId: string; reason?: string };
    const result = await approvalService.approveOrder(ctx, orderId, { reason });
    // Inventory threshold events for the sales just committed, then the domain
    // events (b2b.order.approved, b2b.invoice.created?, order.placed).
    if (result.committedSales.length > 0) {
      await inventoryService.emitSaleEvents(ctx, result.committedSales);
    }
    await emit(ctx, result.events);
    return result.order;
  },
};

const rejectOrder: McpToolDefinition = {
  name: 'reject_b2b_order',
  description: 'Reject a pending B2B order — cancels it and records the reason on the customer.',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({ orderId: uuid(), reason: z.string().max(1000).optional() }),
  run: async (ctx, input) => {
    const { orderId, reason } = input as { orderId: string; reason?: string };
    const result = await approvalService.rejectOrder(ctx, orderId, { reason });
    await emit(ctx, result.events);
    return result.order;
  },
};

// ── Invoices / AR (write) ─────────────────────────────────────────────────────

const createInvoice: McpToolDefinition = {
  name: 'create_b2b_invoice',
  description:
    'Manually issue a net-terms AR invoice for a B2B account (work billed outside an order). amountCents, a dueAt (ISO-8601), an invoiceNumber, optional orderId + notes. `propertyId` is the issuing site (omit to use the primary). Auto-created order invoices come from checkout / approval instead.',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({
    accountId: uuid(),
    orderId: uuid().optional(),
    invoiceNumber: z.string().min(1).max(63),
    amountCents: z.number().int().min(1),
    dueAt: z.string().datetime(),
    notes: z.string().max(2000).optional(),
    propertyId: uuid().optional(),
  }),
  run: async (ctx, input) => {
    const i = input as { propertyId?: string };
    const propertyId = i.propertyId ?? (await resolvePrimaryPropertyId(ctx));
    const result = await invoiceService.createInvoice(ctx, input, propertyId);
    await emit(ctx, result.events);
    return result.invoice;
  },
};

const updateInvoice: McpToolDefinition = {
  name: 'update_b2b_invoice',
  description: 'Update an open B2B invoice’s due date and/or notes.',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({
    invoiceId: uuid(),
    dueAt: z.string().datetime().optional(),
    notes: z.string().max(2000).optional(),
  }),
  run: (ctx, input) => {
    const { invoiceId, ...patch } = input as { invoiceId: string } & Record<string, unknown>;
    return invoiceService.updateInvoice(ctx, invoiceId, patch);
  },
};

const markInvoicePaid: McpToolDefinition = {
  name: 'mark_b2b_invoice_paid',
  description:
    'Record a B2B invoice as paid in full (paidMethod check | ach | wire | credit_card | other). Records the payment and lifts the account’s credit hold if it now has no open receivables.',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({
    invoiceId: uuid(),
    paidMethod: z.enum(['check', 'ach', 'wire', 'credit_card', 'other']),
    notes: z.string().max(2000).optional(),
  }),
  run: (ctx, input) => {
    const { invoiceId, ...body } = input as { invoiceId: string } & Record<string, unknown>;
    return invoiceService.markInvoicePaid(ctx, invoiceId, body);
  },
};

const writeOffInvoice: McpToolDefinition = {
  name: 'write_off_b2b_invoice',
  description: 'Write off (void) an unpaid B2B receivable.',
  scope: 'write:b2b',
  confirmation: true,
  input: z.object({ invoiceId: uuid(), notes: z.string().max(2000).optional() }),
  run: (ctx, input) => {
    const { invoiceId, ...body } = input as { invoiceId: string } & Record<string, unknown>;
    return invoiceService.writeOffInvoice(ctx, invoiceId, body);
  },
};

export const readTools: McpToolDefinition[] = [
  listPricingTiers,
  getPricingTier,
  listTierOverrides,
  getAccount,
  listAccountOverrides,
  resolveB2bPrice,
  getProductPricing,
  listApprovalRules,
  listApprovalQueue,
  listInvoices,
  getInvoice,
];

export const writeTools: McpToolDefinition[] = [
  createPricingTier,
  updatePricingTier,
  deletePricingTier,
  addTierOverride,
  updateTierOverride,
  removeTierOverride,
  updateAccountTradeConfig,
  setAccountFleet,
  addAccountOverride,
  updateAccountOverride,
  removeAccountOverride,
  createApprovalRule,
  updateApprovalRule,
  deleteApprovalRule,
  approveOrder,
  rejectOrder,
  createInvoice,
  updateInvoice,
  markInvoicePaid,
  writeOffInvoice,
];
