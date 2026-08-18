// Pricing + discounts MCP tools — the money-rules surface: site
// discounts, gift-card adjustments, B2B pricing (price lists, bulk-quantity
// tiers, per-account contract prices), and dropship markup / surcharge rules.
// Thin wrappers over the service layer (locked decision #7). Issuing gift cards
// and granting account credit live in ./write-tools.ts, as do apply_markup and
// set_surcharge (the create-surcharge tool) — the rest of markup/surcharge rule
// management is here.

import { z } from 'zod';

import {
  AdjustGiftCardInput,
  BulkSetPriceListEntriesInput,
  CreateBulkPriceTierInput,
  CreateContractPriceInput,
  CreateDiscountInput,
  CreateMarkupRuleInput,
  CreatePriceListInput,
  PriceListEntryInput,
  UpdateDiscountInput,
  UpdateMarkupRuleInput,
  UpdatePriceListInput,
  UpdateSurchargeRuleInput,
} from '@wizeworks/commerce-schemas';

import { discountService, markupService, pricingService, surchargeService } from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

const uuid = () => z.string().uuid();

// ─── Discounts ─────────────────────────────────────────────────────────────

const createDiscount: McpToolDefinition = {
  name: 'create_discount',
  description:
    'Create a discount — a code or automatic promotion (percentage / fixed amount / free shipping) with its conditions and limits. New discounts start inactive unless the input says otherwise; activate_discount puts it live.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateDiscountInput,
  run: (ctx, input) => discountService.createDiscount(ctx, input),
};

const updateDiscount: McpToolDefinition = {
  name: 'update_discount',
  description:
    'Edit a discount — value, conditions, limits, schedule, or code. Send only the fields to change.',
  scope: 'write:commerce',
  confirmation: true,
  input: UpdateDiscountInput.extend({ discountId: uuid() }),
  run: (ctx, input) => {
    const { discountId, ...patch } = input as { discountId: string } & Record<string, unknown>;
    return discountService.updateDiscount(ctx, discountId, patch);
  },
};

const activateDiscount: McpToolDefinition = {
  name: 'activate_discount',
  description: 'Make a discount live so it can be applied at checkout.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ discountId: uuid() }),
  run: (ctx, input) =>
    discountService.activateDiscount(ctx, (input as { discountId: string }).discountId),
};

const archiveDiscount: McpToolDefinition = {
  name: 'archive_discount',
  description: 'Archive a discount so it can no longer be applied. History is preserved.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ discountId: uuid() }),
  run: (ctx, input) =>
    discountService.archiveDiscount(ctx, (input as { discountId: string }).discountId),
};

const adjustGiftCard: McpToolDefinition = {
  name: 'adjust_gift_card',
  description:
    'Adjust a gift card’s balance — add funds or deduct (e.g. a goodwill top-up or a correction). To create a new gift card use issue_gift_card.',
  scope: 'write:commerce',
  confirmation: true,
  input: AdjustGiftCardInput,
  run: (ctx, input) => discountService.adjustGiftCard(ctx, input),
};

// ─── Price lists (B2B / wholesale pricing) ────────────────────────────────

const createPriceList: McpToolDefinition = {
  name: 'create_price_list',
  description:
    'Create a price list — a named set of per-variant prices used for wholesale/tiered pricing, assigned to accounts or customer groups. Add prices with set_price_list_entry or set_price_list_entries.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreatePriceListInput,
  run: (ctx, input) => pricingService.createPriceList(ctx, input),
};

const updatePriceList: McpToolDefinition = {
  name: 'update_price_list',
  description:
    'Edit a price list — name, currency, assignment, or scheduling. Send only the fields to change. Entry prices are managed with the entry tools.',
  scope: 'write:commerce',
  confirmation: true,
  input: UpdatePriceListInput.extend({ priceListId: uuid() }),
  run: (ctx, input) => {
    const { priceListId, ...patch } = input as { priceListId: string } & Record<string, unknown>;
    return pricingService.updatePriceList(ctx, priceListId, patch);
  },
};

const archivePriceList: McpToolDefinition = {
  name: 'archive_price_list',
  description: 'Archive a price list so it stops applying. Its entries are preserved.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ priceListId: uuid() }),
  run: (ctx, input) =>
    pricingService.archivePriceList(ctx, (input as { priceListId: string }).priceListId),
};

const setPriceListEntry: McpToolDefinition = {
  name: 'set_price_list_entry',
  description:
    'Set (create or replace) one variant’s price within a price list. For many entries at once use set_price_list_entries.',
  scope: 'write:commerce',
  confirmation: true,
  input: PriceListEntryInput,
  run: (ctx, input) => pricingService.setPriceListEntry(ctx, input),
};

const setPriceListEntries: McpToolDefinition = {
  name: 'set_price_list_entries',
  description: 'Bulk-set many variant prices in a price list in one call.',
  scope: 'write:commerce_bulk',
  confirmation: true,
  input: BulkSetPriceListEntriesInput,
  run: (ctx, input) => pricingService.bulkSetEntries(ctx, input),
};

const deletePriceListEntry: McpToolDefinition = {
  name: 'delete_price_list_entry',
  description:
    'Remove one variant’s price from a price list (the variant falls back to its default price).',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ entryId: uuid() }),
  run: (ctx, input) =>
    pricingService.deletePriceListEntry(ctx, (input as { entryId: string }).entryId),
};

// ─── Bulk-quantity tiers ──────────────────────────────────────────────────

const createBulkPriceTier: McpToolDefinition = {
  name: 'create_bulk_price_tier',
  description:
    'Create a bulk (quantity-break) price tier — "buy 10+, price drops to X" — for a variant or across a scope.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateBulkPriceTierInput,
  run: (ctx, input) => pricingService.createBulkTier(ctx, input),
};

const deleteBulkPriceTier: McpToolDefinition = {
  name: 'delete_bulk_price_tier',
  description: 'Remove a bulk-quantity price tier.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ tierId: uuid() }),
  run: (ctx, input) => pricingService.deleteBulkTier(ctx, (input as { tierId: string }).tierId),
};

// ─── Contract prices (per-account negotiated pricing) ─────────────────────

const createContractPrice: McpToolDefinition = {
  name: 'create_contract_price',
  description:
    'Create a contract price — a negotiated price for a specific variant tied to a specific B2B account, overriding list/price-list pricing for that account.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateContractPriceInput,
  run: (ctx, input) => pricingService.createContractPrice(ctx, input),
};

const deleteContractPrice: McpToolDefinition = {
  name: 'delete_contract_price',
  description: 'Remove a per-account contract price (the account reverts to its normal pricing).',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ contractPriceId: uuid() }),
  run: (ctx, input) =>
    pricingService.deleteContractPrice(ctx, (input as { contractPriceId: string }).contractPriceId),
};

// ─── Dropship markup rules ────────────────────────────────────────────────

const createMarkupRule: McpToolDefinition = {
  name: 'create_markup_rule',
  description:
    'Create a markup rule — how a dropship/supplier cost is marked up to a sell price across a scope (percentage or flat, with rounding). Preview the effect with preview_markup, then push prices with apply_markup.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateMarkupRuleInput,
  run: (ctx, input) => markupService.createRule(ctx, input),
};

const updateMarkupRule: McpToolDefinition = {
  name: 'update_markup_rule',
  description:
    'Edit a markup rule — its formula, rounding, or scope. Send only the fields to change. Re-apply with apply_markup to push the new prices.',
  scope: 'write:commerce',
  confirmation: true,
  // UpdateMarkupRuleInput is a refined (ZodEffects) schema, so it can't be
  // .extend()ed — intersect the id in. The service re-parses and strips ruleId.
  input: z.object({ ruleId: uuid() }).and(UpdateMarkupRuleInput),
  run: (ctx, input) => {
    const { ruleId } = input as { ruleId: string };
    return markupService.updateRule(ctx, ruleId, input);
  },
};

const deleteMarkupRule: McpToolDefinition = {
  name: 'delete_markup_rule',
  description:
    'Delete a markup rule. Prices it already wrote stay as-is until recomputed by another rule.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ ruleId: uuid() }),
  run: (ctx, input) => markupService.deleteRule(ctx, (input as { ruleId: string }).ruleId),
};

// ─── Surcharge rules ──────────────────────────────────────────────────────
// set_surcharge (create) lives in ./write-tools.ts.

const updateSurchargeRule: McpToolDefinition = {
  name: 'update_surcharge_rule',
  description:
    'Edit a surcharge rule — type, value, applicable payment methods, or label. Send only the fields to change.',
  scope: 'write:commerce',
  confirmation: true,
  // Refined (ZodEffects) schema — intersect the id in, service strips it.
  input: z.object({ ruleId: uuid() }).and(UpdateSurchargeRuleInput),
  run: (ctx, input) => {
    const { ruleId } = input as { ruleId: string };
    return surchargeService.updateRule(ctx, ruleId, input);
  },
};

const deleteSurchargeRule: McpToolDefinition = {
  name: 'delete_surcharge_rule',
  description: 'Delete a surcharge rule so the fee stops applying at checkout.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ ruleId: uuid() }),
  run: (ctx, input) => surchargeService.deleteRule(ctx, (input as { ruleId: string }).ruleId),
};

export const pricingWriteTools: AnyMcpTool[] = [
  createDiscount,
  updateDiscount,
  activateDiscount,
  archiveDiscount,
  adjustGiftCard,
  createPriceList,
  updatePriceList,
  archivePriceList,
  setPriceListEntry,
  setPriceListEntries,
  deletePriceListEntry,
  createBulkPriceTier,
  deleteBulkPriceTier,
  createContractPrice,
  deleteContractPrice,
  createMarkupRule,
  updateMarkupRule,
  deleteMarkupRule,
  updateSurchargeRule,
  deleteSurchargeRule,
];
