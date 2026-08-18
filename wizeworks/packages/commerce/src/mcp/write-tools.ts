// Mutating MCP tools. Each requires confirmation per docs/07 §5; the
// MCP server surfaces a confirmation prompt before invoking.

import { z } from 'zod';

import {
  ApproveReturnInput,
  BulkUpdateProductStatusInput,
  CancelSubscriptionInput,
  ChangeSubscriptionAddressInput,
  ChangeSubscriptionPaymentMethodInput,
  CreateSubscriptionInput,
  CreateSurchargeRuleInput,
  GrantAccountCreditInput,
  IssueGiftCardInput,
  MarkupScope,
  ModerateReviewInput,
  PauseSubscriptionInput,
  ResumeSubscriptionInput,
  SkipNextOccurrenceInput,
  UpdateProductInput,
  UpdateSubscriptionItemsInput,
  UpdateSubscriptionScheduleInput,
  UpdateVariantInput,
} from '@wizeworks/commerce-schemas';

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
 *  `defaultVariantId`, and a site add-to-cart that refuses to fire. Exposing the
 *  bare create over MCP would hand agents a tool that reliably produces unsellable
 *  products, so this input carries the default variant's price and the tool composes both
 *  services. Multi-variant lattices (sizes, colors) stay with the dedicated variant
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
    'Create a product AND its default (priced) variant in one call — the sellable listing an agent means by "add a product". Requires `title` and `priceCents`; `sku` is derived from the handle when omitted. Defaults to status `draft` — pass `active`, or call publish_product after, to put it on the live site. Multi-variant products (sizes/colors) are set up through the variant surface after this call.',
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

/** Edit an existing listing. `create_product` shipped without a partner, which left an
 *  agent able to add a product and retire it but never CORRECT one — a typo in a title
 *  or a wrong price meant archiving the listing and rebuilding it, losing the handle and
 *  burning the SKU (tenant-unique even once soft-deleted). `UpdateProductInput` is a true
 *  partial: omitted fields are left alone, and the nullable ones accept an explicit null
 *  to clear. Price lives on the variant, not the product — see `update_variant`. */
const UpdateProductArgs = z.object({
  productId: z.string().uuid(),
  patch: UpdateProductInput,
});

const updateProduct: McpToolDefinition = {
  name: 'update_product',
  description:
    "Edit an existing product: title, description, status, handle, tags, vendor, product type, SEO, and its category/collection/site links. Send only the fields you want to change — anything you omit is left untouched — inside `patch`. To change the PRICE, use update_variant: price lives on the product's variant. Setting status to `active` publishes it to the live site; `archived` withdraws it.",
  scope: 'write:commerce',
  confirmation: true,
  input: UpdateProductArgs,
  run: async (ctx, raw) => {
    const { productId, patch } = UpdateProductArgs.parse(raw);
    const product = await productService.update(ctx, productId, patch);
    return { id: product.id, handle: product.handle, title: product.title, status: product.status };
  },
};

/** The price/SKU half of "edit a product". Kept separate because that is the real shape
 *  of the data — a product has many variants and each carries its own price, SKU, and
 *  stock policy — not because the agent should have to care which call to make; both
 *  tool descriptions point at each other. */
const UpdateVariantArgs = z.object({
  variantId: z.string().uuid(),
  patch: UpdateVariantInput,
});

const updateVariant: McpToolDefinition = {
  name: 'update_variant',
  description:
    "Edit one variant of a product — its price (`priceCents`), compare-at price, SKU, barcode, cost, weight, and stock policy. This is where a product's PRICE lives: `create_product` returns the `variantId` of the default variant it made, and get_product lists a product's variants. Send only the fields you want to change; pass null to clear a compare-at price, cost, or barcode.",
  scope: 'write:commerce',
  confirmation: true,
  input: UpdateVariantArgs,
  run: async (ctx, raw) => {
    const { variantId, patch } = UpdateVariantArgs.parse(raw);
    await variantService.update(ctx, variantId, patch);
    return { id: variantId, updated: true };
  },
};

/** Give a product a photo. `create_product` / `update_product` cover every field EXCEPT
 *  the one a card on the site is mostly made of — its image — because product images hang
 *  off the VARIANT (`variantImage`, product-level when `variantId` is null), not the
 *  product row. An agent could therefore build a whole catalog that renders as grey
 *  placeholder tiles, with no tool to fix it: the exact "looks half-built" failure the
 *  template work kept hitting. This composes the two service calls the dashboard's image
 *  panel makes — attach the asset, then mark it the hero — so "add a photo to this
 *  product" is one call. Get the `mediaAssetId` from set_image_from_url / upload_image. */
const SetProductImageInput = z.object({
  productId: z.string().uuid(),
  /** A media asset id — the `assetId` returned by set_image_from_url, upload_image, or
   *  create_image_upload. */
  mediaAssetId: z.string().uuid(),
  alt: z.string().max(512).optional(),
  /** Make this the product's hero (the card + PDP lead image). True by default — the
   *  common case is "set the picture"; pass false to add a gallery shot without demoting
   *  the current hero. */
  primary: z.boolean().default(true),
});

const setProductImage: McpToolDefinition = {
  name: 'set_product_image',
  description:
    "Attach an image to a product and, by default, make it the product's main photo — the picture shown on its card on the site and product page. Get the `mediaAssetId` from set_image_from_url (an existing hosted/Unsplash URL) or upload_image first, then pass it here with the product's id. Pass `primary: false` to add an extra gallery shot without changing the main photo. A product with no image renders as a blank placeholder, so this is part of finishing any product an agent creates.",
  scope: 'write:commerce',
  confirmation: true,
  input: SetProductImageInput,
  run: async (ctx, raw) => {
    const input = SetProductImageInput.parse(raw);
    const { id } = await variantService.addImage(ctx, {
      productId: input.productId,
      mediaAssetId: input.mediaAssetId,
      ...(input.alt !== undefined ? { alt: input.alt } : {}),
    });
    if (input.primary) await variantService.setPrimaryImage(ctx, id);
    return { imageId: id, productId: input.productId, primary: input.primary };
  },
};

const publishProduct: McpToolDefinition = {
  name: 'publish_product',
  description: 'Move a product to active status (visible on the site).',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ productId: z.string().uuid() }),
  run: (ctx, input) => productService.publish(ctx, (input as { productId: string }).productId),
};

const archiveProduct: McpToolDefinition = {
  name: 'archive_product',
  description: 'Archive a product (removes from the site, preserves history).',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ productId: z.string().uuid() }),
  run: (ctx, input) => productService.archive(ctx, (input as { productId: string }).productId),
};

const unpublishProduct: McpToolDefinition = {
  name: 'unpublish_product',
  description:
    'Move a product back to draft (removes it from the live site but keeps it editable).',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ productId: z.string().uuid() }),
  run: (ctx, input) => productService.unpublish(ctx, (input as { productId: string }).productId),
};

const restoreProduct: McpToolDefinition = {
  name: 'restore_product',
  description:
    'Restore a previously archived product (back to draft; publish_product to relist it).',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ productId: z.string().uuid() }),
  run: (ctx, input) => productService.restore(ctx, (input as { productId: string }).productId),
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

const createSubscription: McpToolDefinition = {
  name: 'create_subscription',
  description:
    'Create a subscription for a customer — the items, schedule (interval), and delivery details. Normally subscriptions start at checkout; this is the admin-side create for setting one up directly.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateSubscriptionInput,
  run: (ctx, input) => subscriptionService.create(ctx, input),
};

const updateSubscriptionItems: McpToolDefinition = {
  name: 'update_subscription_items',
  description: 'Change the line items (variants + quantities) on an existing subscription.',
  scope: 'write:commerce',
  confirmation: true,
  input: UpdateSubscriptionItemsInput,
  run: (ctx, input) => subscriptionService.updateItems(ctx, input),
};

const updateSubscriptionSchedule: McpToolDefinition = {
  name: 'update_subscription_schedule',
  description: 'Change a subscription’s delivery cadence / schedule (interval, next date).',
  scope: 'write:commerce',
  confirmation: true,
  input: UpdateSubscriptionScheduleInput,
  run: (ctx, input) => subscriptionService.updateSchedule(ctx, input),
};

const changeSubscriptionPaymentMethod: McpToolDefinition = {
  name: 'change_subscription_payment_method',
  description:
    'Point a repeat order at a different saved card, or switch it to being invoiced instead of auto-charged. Use this when a customer’s card expired or was replaced — it also clears a “payment failed” state and retries straight away, so the subscription does not have to be cancelled and set up again.',
  scope: 'write:commerce',
  confirmation: true,
  input: ChangeSubscriptionPaymentMethodInput,
  run: (ctx, input) => subscriptionService.changePaymentMethod(ctx, input),
};

const changeSubscriptionAddress: McpToolDefinition = {
  name: 'change_subscription_address',
  description: 'Change the shipping address a subscription’s recurring orders go to.',
  scope: 'write:commerce',
  confirmation: true,
  input: ChangeSubscriptionAddressInput,
  run: (ctx, input) => subscriptionService.changeAddress(ctx, input),
};

const skipNextSubscriptionOccurrence: McpToolDefinition = {
  name: 'skip_next_subscription_occurrence',
  description:
    'Skip the next scheduled occurrence of a subscription (the one after it proceeds normally).',
  scope: 'write:commerce',
  confirmation: true,
  input: SkipNextOccurrenceInput,
  run: (ctx, input) => subscriptionService.skipNextOccurrence(ctx, input),
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
  updateProduct,
  updateVariant,
  setProductImage,
  publishProduct,
  archiveProduct,
  unpublishProduct,
  restoreProduct,
  bulkUpdateProductStatus,
  issueGiftCard,
  grantAccountCredit,
  createSubscription,
  updateSubscriptionItems,
  updateSubscriptionSchedule,
  changeSubscriptionAddress,
  changeSubscriptionPaymentMethod,
  skipNextSubscriptionOccurrence,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  approveReturn,
  moderateReview,
  applyMarkup,
  setSurcharge,
];
