// Mutating MCP tools. Each requires confirmation per docs/07 §5; the
// MCP server surfaces a confirmation prompt before invoking.

import { z } from 'zod';

import {
  ApproveReturnInput,
  BulkUpdateProductStatusInput,
  CancelSubscriptionInput,
  CreateSurchargeRuleInput,
  GrantAccountCreditInput,
  IssueGiftCardInput,
  MarkupScope,
  ModerateReviewInput,
  PauseSubscriptionInput,
  ResumeSubscriptionInput,
} from '@sparx/commerce-schemas';

import {
  discountService,
  markupService,
  productService,
  returnService,
  reviewService,
  subscriptionService,
  surchargeService,
  variantService,
} from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

/** What an agent means by "create a product": a listing with a PRICE.
 *
 *  `productService.create` deliberately mints no variant — options/variants belong to
 *  `variantService` — but a product with no variant has no price, a null
 *  `defaultVariantId`, and a storefront add-to-cart that refuses to fire. Exposing the
 *  bare create over MCP would hand agents a tool that reliably produces unsellable
 *  products, so this input carries the default variant's price and the tool composes both
 *  services. Multi-variant lattices (sizes, colours) stay with the dedicated variant
 *  surface; this is the one-price common case that unblocks catalog setup. */
const CreateProductWithPriceInput = z.object({
  title: z.string().min(1).max(255),
  /** The default variant's price, in cents. 0 is legal (a free/quote-only listing). */
  priceCents: z.number().int().min(0),
  /** Unique per tenant; derived from the resolved handle when omitted so an agent is
   *  never forced to invent one. */
  sku: z.string().min(1).max(64).optional(),
  description: z.string().max(50_000).optional(),
  status: z.enum(['draft', 'active']).default('draft'),
  handle: z.string().max(255).optional(),
  productType: z.string().max(127).optional(),
  vendor: z.string().max(127).optional(),
  tags: z.array(z.string().min(1).max(63)).max(50).default([]),
  compareAtPriceCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).default('USD'),
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().max(512).optional(),
  categoryIds: z.array(z.string().uuid()).max(20).default([]),
  collectionIds: z.array(z.string().uuid()).max(50).default([]),
  propertyIds: z.array(z.string().uuid()).max(50).default([]),
});

const createProduct: McpToolDefinition = {
  name: 'create_product',
  description:
    'Create a product AND its default (priced) variant in one call — the sellable listing an agent means by "add a product". Requires `title` and `priceCents`; `sku` is derived from the handle when omitted. Defaults to status `draft` — pass `active`, or call publish_product after, to put it on the storefront. Multi-variant products (sizes/colours) are set up through the variant surface after this call.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateProductWithPriceInput,
  run: async (ctx, raw) => {
    const input = CreateProductWithPriceInput.parse(raw);
    const product = await productService.create(ctx, {
      title: input.title,
      status: input.status,
      tags: input.tags,
      categoryIds: input.categoryIds,
      collectionIds: input.collectionIds,
      propertyIds: input.propertyIds,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.handle !== undefined ? { handle: input.handle } : {}),
      ...(input.productType !== undefined ? { productType: input.productType } : {}),
      ...(input.vendor !== undefined ? { vendor: input.vendor } : {}),
      ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle } : {}),
      ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription } : {}),
    });
    // Uppercased handle is a stable, readable, tenant-unique seed; the variant service
    // still rejects a genuine collision so two products can't share a SKU.
    const sku = input.sku ?? product.handle.toUpperCase().slice(0, 48);
    const variant = await variantService.create(ctx, product.id, {
      sku,
      priceCents: input.priceCents,
      currency: input.currency,
      isDefault: true,
      ...(input.compareAtPriceCents !== undefined
        ? { compareAtPriceCents: input.compareAtPriceCents }
        : {}),
    });
    return { id: product.id, handle: product.handle, variantId: variant.id, sku: variant.sku };
  },
};

const publishProduct: McpToolDefinition = {
  name: 'publish_product',
  description: 'Move a product to active status (visible in storefront).',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ productId: z.string().uuid() }),
  run: (ctx, input) => productService.publish(ctx, (input as { productId: string }).productId),
};

const archiveProduct: McpToolDefinition = {
  name: 'archive_product',
  description: 'Archive a product (removes from storefront, preserves history).',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ productId: z.string().uuid() }),
  run: (ctx, input) => productService.archive(ctx, (input as { productId: string }).productId),
};

const bulkUpdateProductStatus: McpToolDefinition = {
  name: 'bulk_update_product_status',
  description: 'Set the status of up to 1000 products in a single call.',
  scope: 'write:commerce_bulk',
  confirmation: true,
  input: BulkUpdateProductStatusInput,
  run: (ctx, input) => productService.bulkUpdateStatus(ctx, input),
};

const issueGiftCard: McpToolDefinition = {
  name: 'issue_gift_card',
  description: 'Issue a gift card with an initial balance.',
  scope: 'write:commerce',
  confirmation: true,
  input: IssueGiftCardInput,
  run: (ctx, input) => discountService.issueGiftCard(ctx, input),
};

const grantAccountCredit: McpToolDefinition = {
  name: 'grant_account_credit',
  description: "Add to a customer's account credit balance.",
  scope: 'write:commerce',
  confirmation: true,
  input: GrantAccountCreditInput,
  run: (ctx, input) => discountService.grantAccountCredit(ctx, input),
};

const pauseSubscription: McpToolDefinition = {
  name: 'pause_subscription',
  description: 'Pause a subscription (no charges until resumed).',
  scope: 'write:commerce',
  confirmation: true,
  input: PauseSubscriptionInput,
  run: (ctx, input) => subscriptionService.pause(ctx, input),
};

const resumeSubscription: McpToolDefinition = {
  name: 'resume_subscription',
  description: 'Resume a paused subscription.',
  scope: 'write:commerce',
  confirmation: true,
  input: ResumeSubscriptionInput,
  run: (ctx, input) => subscriptionService.resume(ctx, input),
};

const cancelSubscription: McpToolDefinition = {
  name: 'cancel_subscription',
  description: 'Cancel a subscription (at period end or immediately).',
  scope: 'write:commerce',
  confirmation: true,
  input: CancelSubscriptionInput,
  run: (ctx, input) => subscriptionService.cancel(ctx, input),
};

const approveReturn: McpToolDefinition = {
  name: 'approve_return',
  description: 'Approve a return request, optionally generating a label.',
  scope: 'write:commerce',
  confirmation: true,
  input: ApproveReturnInput,
  run: (ctx, input) => returnService.approve(ctx, input),
};

const moderateReview: McpToolDefinition = {
  name: 'moderate_review',
  description: 'Approve, reject, or flag a product review.',
  scope: 'write:commerce',
  confirmation: true,
  input: ModerateReviewInput,
  run: (ctx, input) => reviewService.moderate(ctx, input),
};

const applyMarkup: McpToolDefinition = {
  name: 'apply_markup',
  description:
    'Apply a markup rule across its scope (or an override scope): recompute and write the derived price for every priceable variant, stamping a reproducible snapshot. Preview first with preview_markup.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ ruleId: z.string().uuid(), scope: MarkupScope.optional() }),
  run: (ctx, input) => {
    const { ruleId, scope } = input as { ruleId: string; scope?: unknown };
    return markupService.applyRule(ctx, ruleId, scope);
  },
};

const setSurcharge: McpToolDefinition = {
  name: 'set_surcharge',
  description:
    'Create a surcharge rule (e.g. a credit-card processing fee) — type (percentage/flat), value, payment methods, and label. Surcharging laws vary by jurisdiction; confirm the merchant intends this.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateSurchargeRuleInput,
  run: (ctx, input) => surchargeService.createRule(ctx, input),
};

export const writeTools: AnyMcpTool[] = [
  createProduct,
  publishProduct,
  archiveProduct,
  bulkUpdateProductStatus,
  issueGiftCard,
  grantAccountCredit,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  approveReturn,
  moderateReview,
  applyMarkup,
  setSurcharge,
];
