// Mutating MCP tools. Each requires confirmation per docs/07 §5; the
// MCP server surfaces a confirmation prompt before invoking.

import { z } from 'zod';

import {
  AdjustInventoryInput,
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
  inventoryService,
  markupService,
  productService,
  returnService,
  reviewService,
  subscriptionService,
  surchargeService,
} from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

const updateInventory: McpToolDefinition = {
  name: 'update_inventory',
  description: 'Adjust on-hand quantity for a variant at a warehouse.',
  scope: 'write:commerce',
  confirmation: true,
  input: AdjustInventoryInput,
  run: (ctx, input) => inventoryService.adjust(ctx, input),
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
  updateInventory,
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
