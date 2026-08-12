// Picking + packing MCP tools (docs/146 Phase 4).
//
// The warehouse floor's work, reachable from whatever assistant the tenant
// already uses. Two things worth noting about the shape of this surface:
//
//   • The SHORT PICK is here, and it is the most valuable tool in the file. "I
//     cannot find these" is the moment a wrong stock number becomes knowable,
//     and making it one sentence to an assistant rather than four taps on a
//     screen is how it actually gets recorded.
//   • Handing a box to shipping is NOT here. It buys a carrier label and spends
//     money, and it needs `@sparx/crm` to write the fulfillment — a dependency
//     inventory does not and should not have. It lives in commerce's tool set,
//     next to the rest of the outbound shipping path.
//
// Per the platform's BYOK/MCP-only rule, sparx runs no model here.

import { z } from 'zod';

import {
  AllocationStrategy,
  GeneratePickListInput,
  PickListKind,
  PickListStatus,
  ShortPickReason,
} from '@sparx/commerce-schemas';

import { inventoryService } from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

const Uuid = z.string().uuid();

// ─── Read ──────────────────────────────────────────────────────────────────────

const listWalks: McpToolDefinition = {
  name: 'list_pick_lists',
  description:
    'The walks on the floor: what is waiting to be picked, who has it, how far through they are, and how many lines came up short. Filter by status, by picker, by location, or by a specific order to answer "has anyone started on this order yet".',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    status: PickListStatus.optional(),
    kind: PickListKind.optional(),
    warehouseId: Uuid.optional(),
    assignedTo: z.string().max(127).optional(),
    orderId: Uuid.optional(),
    search: z.string().max(120).optional(),
    take: z.number().int().min(1).max(200).default(25),
  }),
  run: (ctx, input) => inventoryService.listPickLists(ctx, input),
};

const getWalk: McpToolDefinition = {
  name: 'get_pick_list',
  description:
    'One walk in full: every instruction in walk order with its shelf, batch and quantity, what has been picked, what came up short and why, and which orders it covers. This is what a picker sees.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({ pickListId: Uuid }),
  run: (ctx, input) =>
    inventoryService.getPickList(ctx, (input as { pickListId: string }).pickListId),
};

const listBoxes: McpToolDefinition = {
  name: 'list_packages',
  description:
    'Boxes: open ones still being filled, sealed ones waiting to be handed to shipping, and what is in each. Filter by order to answer "how many parcels is this order going out in".',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    orderId: Uuid.optional(),
    pickListId: Uuid.optional(),
    status: z.enum(['open', 'packed', 'cancelled']).optional(),
    take: z.number().int().min(1).max(200).default(25),
  }),
  run: (ctx, input) => inventoryService.listPackages(ctx, input),
};

const getBox: McpToolDefinition = {
  name: 'get_package',
  description:
    'One box: what is in it, how much of that was confirmed by a scan rather than typed, what the order still owes a box, and the weight and dimensions a carrier will quote against.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({ packageId: Uuid }),
  run: (ctx, input) => inventoryService.getPackage(ctx, (input as { packageId: string }).packageId),
};

const throughput: McpToolDefinition = {
  name: 'get_pick_throughput',
  description:
    'How the floor is running: units per hour measured against time actually spent picking, the share of lines confirmed by a scan, the short-pick rate, and — the useful one — which shelves keep coming up empty and what reason the pickers gave. Defaults to the last 30 days.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    warehouseId: Uuid.optional(),
    pickedBy: z.string().max(127).optional(),
  }),
  run: (ctx, input) => inventoryService.pickThroughput(ctx, input),
};

export const pickReadTools: AnyMcpTool[] = [listWalks, getWalk, listBoxes, getBox, throughput];

// ─── Write ─────────────────────────────────────────────────────────────────────

const generateWalk: McpToolDefinition = {
  name: 'generate_pick_list',
  description:
    'Turn orders into a walk. One order makes a single list; several make a batch (one tote each) or a wave (merged by shelf, sorted at the pack bench). Shelves are not chosen here — they were chosen when the order was placed — so the list is bin-sequenced into the shortest sensible route through the building. Refuses orders filled from more than one location rather than silently splitting them.',
  scope: 'write:inventory',
  confirmation: true,
  input: GeneratePickListInput,
  run: (ctx, input) => inventoryService.generatePickList(ctx, input),
};

const assignWalk: McpToolDefinition = {
  name: 'assign_pick_list',
  description:
    'Put a name on a walk, or hand it back to the pool with null. A walk already in progress stays in progress — the clock the throughput report measures does not restart.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ pickListId: Uuid, assignedTo: z.string().max(127).nullable() }),
  run: (ctx, input) => {
    const i = input as { pickListId: string; assignedTo: string | null };
    return inventoryService.assignPickList(ctx, i.pickListId, { assignedTo: i.assignedTo });
  },
};

const confirmLine: McpToolDefinition = {
  name: 'confirm_pick',
  description:
    'Confirm that units came off a shelf. Omit the quantity to confirm the whole line. Name a shelf only if it was NOT the one on the instruction — saying so is what keeps the shelf records describing the building, and it is the single most useful correction anyone on the floor can make.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({
    pickListId: Uuid,
    lineId: Uuid,
    quantity: z.number().int().min(1).max(1_000_000).optional(),
    binId: Uuid.optional(),
  }),
  run: (ctx, input) => {
    const i = input as Record<string, unknown>;
    return inventoryService.confirmPick(ctx, i.pickListId as string, i);
  },
};

const recordShort: McpToolDefinition = {
  name: 'short_pick',
  description:
    'Record that the units were not there. The ones that could not be found go back into stock and are held for the order that still wants them — so nobody else can buy something we have just admitted we cannot find — and the shelf is put on a blind count so a person settles what is actually on it. Give the quantity ONLY if some were found; leave it off when the shelf was empty.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({
    pickListId: Uuid,
    lineId: Uuid,
    quantity: z.number().int().min(0).max(1_000_000).optional(),
    reason: ShortPickReason,
    note: z.string().max(1000).optional(),
    raiseCount: z.boolean().optional(),
  }),
  run: (ctx, input) => {
    const i = input as Record<string, unknown>;
    return inventoryService.shortPick(ctx, i.pickListId as string, i);
  },
};

const skipLine: McpToolDefinition = {
  name: 'skip_pick',
  description:
    'Leave a line for later without deciding it is missing. The walk will not finish while any remain — a skip is "coming back to it", not "done".',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ pickListId: Uuid, lineId: Uuid }),
  run: (ctx, input) => {
    const i = input as { pickListId: string; lineId: string };
    return inventoryService.skipPick(ctx, i.pickListId, { lineId: i.lineId });
  },
};

const scanPick: McpToolDefinition = {
  name: 'scan_to_pick',
  description:
    'One trigger pull against a walk: pass the barcode and the right instruction is found and confirmed. Scanning something the walk does not want, or standing at the wrong shelf, is refused and told why — that refusal is the whole reason to scan rather than tap. `idempotencyKey` must be a stable value you REUSE on retry; the same key twice applies once.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({
    pickListId: Uuid,
    value: z.string().min(1).max(256),
    idempotencyKey: z
      .string()
      .min(8)
      .max(127)
      .describe('Reuse the SAME key when retrying a scan, so a retry cannot pick twice.'),
    quantity: z.number().int().min(1).max(1_000_000).optional(),
    binId: Uuid.optional(),
    deviceId: z.string().max(64).optional(),
  }),
  run: (ctx, input) => {
    const i = input as Record<string, unknown>;
    return inventoryService.scanToPick(ctx, i.pickListId as string, i);
  },
};

const cancelWalk: McpToolDefinition = {
  name: 'cancel_pick_list',
  description:
    'Abandon a walk. Lines already picked stay picked — the units are in a tote and cancelling paperwork does not put them back on the shelf.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ pickListId: Uuid, reason: z.string().max(500).optional() }),
  run: (ctx, input) => {
    const i = input as { pickListId: string; reason?: string };
    return inventoryService.cancelPickList(ctx, i.pickListId, {
      ...(i.reason !== undefined ? { reason: i.reason } : {}),
    });
  },
};

const openBox: McpToolDefinition = {
  name: 'create_package',
  description:
    'Start a box for an order. Link it to the walk it came off when there was one. Weight and dimensions can be set now or when it is sealed.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({
    orderId: Uuid,
    pickListId: Uuid.optional(),
    packagingType: z.string().max(32).optional(),
    weightGrams: z.number().int().min(0).max(10_000_000).optional(),
    lengthMm: z.number().int().min(0).max(100_000).optional(),
    widthMm: z.number().int().min(0).max(100_000).optional(),
    heightMm: z.number().int().min(0).max(100_000).optional(),
    note: z.string().max(2000).optional(),
  }),
  run: (ctx, input) => inventoryService.createPackage(ctx, input),
};

const putInBox: McpToolDefinition = {
  name: 'pack_item',
  description:
    'Put units of an order line in a box. The quantity is the TOTAL for that line in that box, not an amount to add — correcting a mistake means typing the right number. Zero takes it back out. More than the order wants, or more than the other boxes have left room for, is refused.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({
    packageId: Uuid,
    orderItemId: Uuid,
    quantity: z.number().int().min(0).max(1_000_000),
  }),
  run: (ctx, input) => {
    const i = input as { packageId: string; orderItemId: string; quantity: number };
    return inventoryService.packItem(ctx, i.packageId, {
      orderItemId: i.orderItemId,
      quantity: i.quantity,
    });
  },
};

const scanPack: McpToolDefinition = {
  name: 'scan_to_pack',
  description:
    'One trigger pull at the pack bench. Scanning something the order does not contain is REFUSED — that is what pack verification is for, and a bench that warns and continues has replaced a control with a notification. `idempotencyKey` must be reused on retry.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({
    packageId: Uuid,
    value: z.string().min(1).max(256),
    idempotencyKey: z
      .string()
      .min(8)
      .max(127)
      .describe('Reuse the SAME key when retrying, so a retry cannot pack twice.'),
    quantity: z.number().int().min(1).max(1_000_000).optional(),
    deviceId: z.string().max(64).optional(),
  }),
  run: (ctx, input) => {
    const i = input as Record<string, unknown>;
    return inventoryService.scanToPack(ctx, i.packageId as string, i);
  },
};

const sealBox: McpToolDefinition = {
  name: 'close_package',
  description:
    'Seal a box and capture its weight and dimensions. A box that does not complete the order is refused unless `allowPartial` says the partial shipment is deliberate — the refusal names exactly what is still to pack. Sealing does not hand it to shipping; that is a separate, deliberate step.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({
    packageId: Uuid,
    weightGrams: z.number().int().min(0).max(10_000_000).optional(),
    lengthMm: z.number().int().min(0).max(100_000).optional(),
    widthMm: z.number().int().min(0).max(100_000).optional(),
    heightMm: z.number().int().min(0).max(100_000).optional(),
    packagingType: z.string().max(32).optional(),
    allowPartial: z.boolean().optional(),
  }),
  run: (ctx, input) => {
    const i = input as Record<string, unknown>;
    return inventoryService.closePackage(ctx, i.packageId as string, i);
  },
};

export const pickWriteTools: AnyMcpTool[] = [
  generateWalk,
  assignWalk,
  confirmLine,
  recordShort,
  skipLine,
  scanPick,
  cancelWalk,
  openBox,
  putInBox,
  scanPack,
  sealBox,
];

/** Re-exported so a caller can enumerate the strategies without importing the
 *  schema package — the workbench's location settings does exactly this. */
export const PICK_STRATEGIES = AllocationStrategy.options;
