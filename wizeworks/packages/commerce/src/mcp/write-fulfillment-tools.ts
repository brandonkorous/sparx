// Fulfillment MCP tools — how orders ship and get taxed, and how returns are
// processed: shipping zones / profiles / rates, tax zones / rates / exemptions,
// and the return-request lifecycle past approval. Thin wrappers over the
// service layer (locked decision #7). approve_return lives in ./write-tools.ts.

import { z } from 'zod';

import {
  AssignProductsToProfileInput,
  CreateShippingProfileInput,
  CreateShippingRateInput,
  CreateShippingZoneInput,
  CreateTaxExemptionInput,
  CreateTaxRateInput,
  CreateTaxZoneInput,
  DenyReturnInput,
  IssueReturnRefundInput,
  RecordReturnInspectionInput,
  UpdateShippingProfileInput,
  UpdateShippingZoneInput,
  UpdateTaxZoneInput,
} from '@wizeworks/commerce-schemas';

import { closeAndFulfillPackage, fulfillPackedShipment } from '../services/pack-fulfillment';
import { returnService, shippingService, taxService } from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

const uuid = () => z.string().uuid();

// ─── Shipping zones / profiles / rates ────────────────────────────────────

const createShippingZone: McpToolDefinition = {
  name: 'create_shipping_zone',
  description:
    'Create a shipping zone — a geographic target (countries/regions) that shipping rates attach to. Add rates with create_shipping_rate.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateShippingZoneInput,
  run: (ctx, input) => shippingService.createZone(ctx, input),
};

const updateShippingZone: McpToolDefinition = {
  name: 'update_shipping_zone',
  description:
    'Edit a shipping zone — name, priority, or geographic targeting. Send only the fields to change.',
  scope: 'write:commerce',
  confirmation: true,
  input: UpdateShippingZoneInput.extend({ zoneId: uuid() }),
  run: (ctx, input) => {
    const { zoneId, ...patch } = input as { zoneId: string } & Record<string, unknown>;
    return shippingService.updateZone(ctx, zoneId, patch);
  },
};

const deleteShippingZone: McpToolDefinition = {
  name: 'delete_shipping_zone',
  description: 'Delete a shipping zone and its rates.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ zoneId: uuid() }),
  run: (ctx, input) => shippingService.deleteZone(ctx, (input as { zoneId: string }).zoneId),
};

const createShippingProfile: McpToolDefinition = {
  name: 'create_shipping_profile',
  description:
    'Create a shipping profile — a rate-group products are assigned to (e.g. "Standard", "Oversized/Freight"). Assign products with assign_products_to_shipping_profile.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateShippingProfileInput,
  run: (ctx, input) => shippingService.createProfile(ctx, input),
};

const updateShippingProfile: McpToolDefinition = {
  name: 'update_shipping_profile',
  description:
    'Edit a shipping profile — name, description, or allowed carrier services. Send only the fields to change.',
  scope: 'write:commerce',
  confirmation: true,
  input: UpdateShippingProfileInput.extend({ profileId: uuid() }),
  run: (ctx, input) => {
    const { profileId, ...patch } = input as { profileId: string } & Record<string, unknown>;
    return shippingService.updateProfile(ctx, profileId, patch);
  },
};

const deleteShippingProfile: McpToolDefinition = {
  name: 'delete_shipping_profile',
  description: 'Delete a shipping profile. Products on it revert to the default profile.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ profileId: uuid() }),
  run: (ctx, input) =>
    shippingService.deleteProfile(ctx, (input as { profileId: string }).profileId),
};

const assignProductsToShippingProfile: McpToolDefinition = {
  name: 'assign_products_to_shipping_profile',
  description: 'Assign a set of products to a shipping profile so they use that profile’s rates.',
  scope: 'write:commerce',
  confirmation: true,
  input: AssignProductsToProfileInput,
  run: (ctx, input) => shippingService.assignProductsToProfile(ctx, input),
};

const createShippingRate: McpToolDefinition = {
  name: 'create_shipping_rate',
  description:
    'Create a shipping rate within a zone — flat, weight-based, or price-based — that shoppers see at checkout for that zone.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateShippingRateInput,
  run: (ctx, input) => shippingService.createRate(ctx, input),
};

const deleteShippingRate: McpToolDefinition = {
  name: 'delete_shipping_rate',
  description: 'Delete a shipping rate.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ rateId: uuid() }),
  run: (ctx, input) => shippingService.deleteRate(ctx, (input as { rateId: string }).rateId),
};

// ─── Tax zones / rates / exemptions ───────────────────────────────────────

const createTaxZone: McpToolDefinition = {
  name: 'create_tax_zone',
  description:
    'Create a tax zone — a jurisdiction (country/region) with a nexus type that tax rates attach to. Add rates with create_tax_rate.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateTaxZoneInput,
  run: (ctx, input) => taxService.createZone(ctx, input),
};

const updateTaxZone: McpToolDefinition = {
  name: 'update_tax_zone',
  description:
    'Edit a tax zone — country, region, nexus type, or registration number. Send only the fields to change.',
  scope: 'write:commerce',
  confirmation: true,
  input: UpdateTaxZoneInput.extend({ zoneId: uuid() }),
  run: (ctx, input) => {
    const { zoneId, ...patch } = input as { zoneId: string } & Record<string, unknown>;
    return taxService.updateZone(ctx, zoneId, patch);
  },
};

const deleteTaxZone: McpToolDefinition = {
  name: 'delete_tax_zone',
  description: 'Delete a tax zone and its rates.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ zoneId: uuid() }),
  run: (ctx, input) => taxService.deleteZone(ctx, (input as { zoneId: string }).zoneId),
};

const createTaxRate: McpToolDefinition = {
  name: 'create_tax_rate',
  description:
    'Create a tax rate within a tax zone (percentage, optionally by product tax category).',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateTaxRateInput,
  run: (ctx, input) => taxService.createRate(ctx, input),
};

const deleteTaxRate: McpToolDefinition = {
  name: 'delete_tax_rate',
  description: 'Delete a tax rate.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ rateId: uuid() }),
  run: (ctx, input) => taxService.deleteRate(ctx, (input as { rateId: string }).rateId),
};

const createTaxExemption: McpToolDefinition = {
  name: 'create_tax_exemption',
  description:
    'Create a tax exemption for a customer or B2B account (e.g. a resale certificate) so eligible orders are not taxed.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateTaxExemptionInput,
  run: (ctx, input) => taxService.createExemption(ctx, input),
};

const deleteTaxExemption: McpToolDefinition = {
  name: 'delete_tax_exemption',
  description: 'Remove a tax exemption.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ exemptionId: uuid() }),
  run: (ctx, input) =>
    taxService.deleteExemption(ctx, (input as { exemptionId: string }).exemptionId),
};

// ─── Returns / RMA lifecycle ──────────────────────────────────────────────

const denyReturn: McpToolDefinition = {
  name: 'deny_return',
  description: 'Deny a return request, with a reason. The opposite of approve_return.',
  scope: 'write:commerce',
  confirmation: true,
  input: DenyReturnInput,
  run: (ctx, input) => returnService.deny(ctx, input),
};

const markReturnReceived: McpToolDefinition = {
  name: 'mark_return_received',
  description: 'Mark an approved return’s items as physically received back at the warehouse.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ returnId: uuid() }),
  run: (ctx, input) => returnService.markReceived(ctx, (input as { returnId: string }).returnId),
};

const recordReturnInspection: McpToolDefinition = {
  name: 'record_return_inspection',
  description:
    'Record the inspection outcome for a received return (per-line condition/disposition — restock, damaged, etc.) before refunding.',
  scope: 'write:commerce',
  confirmation: true,
  input: RecordReturnInspectionInput,
  run: (ctx, input) => returnService.recordInspection(ctx, input),
};

const issueReturnRefund: McpToolDefinition = {
  name: 'issue_return_refund',
  description:
    'Issue the refund for a return — amount and method — closing out the RMA. Money movement; the server confirms first.',
  scope: 'write:commerce',
  confirmation: true,
  input: IssueReturnRefundInput,
  run: (ctx, input) => returnService.issueRefund(ctx, input),
};

// ── Warehouse hand-off (docs/146 Phase 4.6) ──────────────────────────────────
//
// Lives HERE rather than in @wizeworks/inventory's tool set because it writes an
// OrderFulfillment, and inventory must not depend on @wizeworks/crm — the dependency
// rule points consumers at inventory, never the reverse. Commerce sees both, and
// this sits next to the rate quoting and label purchase it feeds.

const fulfillPackage: McpToolDefinition = {
  name: 'fulfill_package',
  description:
    'Hand a sealed box to shipping: creates the shipping record for exactly what is in that box, so a three-box order gets three tracking numbers rather than one. Set `close` to seal an open box first — the one button a pack bench needs — and `allowPartial` when the box deliberately does not complete the order. Idempotent: a box that already has a shipping record returns it rather than making a second one.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({
    packageId: uuid(),
    carrier: z.string().max(63).optional(),
    service: z.string().max(63).optional(),
    trackingNumber: z.string().max(127).optional(),
    trackingUrl: z.string().url().max(2048).optional(),
    markShipped: z
      .boolean()
      .optional()
      .describe('Mark it shipped now, for a shop that hands boxes to a driver and buys no label.'),
    notes: z.string().max(10_000).optional(),
    close: z.boolean().optional(),
    allowPartial: z.boolean().optional(),
  }),
  run: (ctx, input) => {
    const i = input as { close?: boolean } & Parameters<typeof fulfillPackedShipment>[1];
    return i.close ? closeAndFulfillPackage(ctx, i) : fulfillPackedShipment(ctx, i);
  },
};

export const fulfillmentWriteTools: AnyMcpTool[] = [
  createShippingZone,
  updateShippingZone,
  deleteShippingZone,
  createShippingProfile,
  updateShippingProfile,
  deleteShippingProfile,
  assignProductsToShippingProfile,
  createShippingRate,
  deleteShippingRate,
  createTaxZone,
  updateTaxZone,
  deleteTaxZone,
  createTaxRate,
  deleteTaxRate,
  createTaxExemption,
  deleteTaxExemption,
  denyReturn,
  markReturnReceived,
  recordReturnInspection,
  issueReturnRefund,
  fulfillPackage,
];
