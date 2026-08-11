// Barcode + scanning MCP tools (docs/146 Phase 3).
//
// The questions and actions a scanner answers, made available to whatever
// assistant the tenant already uses — including, and this is the point, the
// phone in someone's hand that has a camera but no barcode app: read the code,
// pass the digits here, get the item.
//
// Per the platform's BYOK/MCP-only rule, sparx runs no model here — the tenant
// brings their own client.

import { z } from 'zod';

import { CreateVariantBarcodeInput, GenerateVariantBarcodesInput } from '@sparx/commerce-schemas';

import { inventoryService } from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

const Uuid = z.string().uuid();

const SCAN_KINDS = [
  'variant',
  'bin',
  'purchase_order',
  'goods_receipt',
  'transfer',
  'count',
  'lot',
  'serial',
] as const;

const lookUpScan: McpToolDefinition = {
  name: 'resolve_scan',
  description:
    'What a scanned or typed code IS. Tries every reading of the same physical code — a UPC-A that a scanner reported as EAN-13, a zero-suppressed UPC-E, a SKU printed as a Code 128 — and returns everything it matched: products (with how many units one scan of that code means), shelves, purchase orders, transfers, counts, lots and serial numbers. Returns several matches rather than guessing when a value is honestly ambiguous. Narrow it with `expect` when you already know what kind of thing you are looking at.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    value: z.string().min(1).max(256),
    expect: z.array(z.enum(SCAN_KINDS)).optional(),
    warehouseId: Uuid.optional(),
  }),
  run: (ctx, input) => {
    const i = input as {
      value: string;
      expect?: (typeof SCAN_KINDS)[number][];
      warehouseId?: string;
    };
    return inventoryService.resolveScan(ctx, i.value, {
      ...(i.expect ? { expect: i.expect } : {}),
      ...(i.warehouseId ? { warehouseId: i.warehouseId } : {}),
    });
  },
};

const listCodes: McpToolDefinition = {
  name: 'list_barcodes',
  description:
    "Every barcode registered against an item, or a search across all of them. Each carries its format, how many units one scan represents (a case code means twelve), whether it is the item's main code, which supplier's packaging it came from, and when it was last scanned — which is what decides whether an old label can be retired.",
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    variantId: Uuid.optional(),
    supplierId: Uuid.optional(),
    q: z.string().max(64).optional(),
    includeInactive: z.boolean().default(false),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  run: (ctx, input) => {
    const i = input as Record<string, unknown>;
    return inventoryService.listBarcodes(ctx, {
      ...(i.variantId ? { variantId: i.variantId as string } : {}),
      ...(i.supplierId ? { supplierId: i.supplierId as string } : {}),
      ...(i.q ? { search: i.q as string } : {}),
      includeInactive: (i.includeInactive as boolean) ?? false,
      limit: (i.limit as number) ?? 50,
      offset: 0,
    });
  },
};

const conflicts: McpToolDefinition = {
  name: 'list_barcode_conflicts',
  description:
    'Items whose barcode two things claim at once. A barcode has to resolve to exactly one product or a scan is a coin toss, so these are refused entry to the scan registry and listed here instead, naming both claimants. Resolve each by removing the code from the wrong item.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({}),
  run: (ctx) => inventoryService.listBarcodeConflicts(ctx),
};

const scanHistory: McpToolDefinition = {
  name: 'list_scan_events',
  description:
    'Every trigger pull: what was scanned, what it resolved to, whether it was applied or refused and why, which handheld it came from, and how long it sat in an offline queue before reaching us. Use it to answer "I scanned that and nothing happened" and to audit a disputed count or delivery.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    contextType: z.enum(['count', 'receipt', 'transfer', 'put_away', 'pick', 'lookup']).optional(),
    contextId: Uuid.optional(),
    variantId: Uuid.optional(),
    outcome: z.enum(['applied', 'duplicate', 'not_found', 'rejected']).optional(),
    take: z.number().int().min(1).max(500).default(100),
  }),
  run: (ctx, input) => inventoryService.listScanEvents(ctx, input as Record<string, never>),
};

const receivingState: McpToolDefinition = {
  name: 'get_receiving_session',
  description:
    'How a delivery is going: for each ordered line, how many were ordered, already booked on earlier receipts, scanned so far in this session and still outstanding — plus any scans that resolved to nothing. The session lives on the server, so it is the same for everyone working the delivery.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({ purchaseOrderId: Uuid }),
  run: (ctx, input) =>
    inventoryService.receivingSession(ctx, (input as { purchaseOrderId: string }).purchaseOrderId),
};

export const scanReadTools: AnyMcpTool[] = [
  lookUpScan,
  listCodes,
  conflicts,
  scanHistory,
  receivingState,
];

// ─── Writes ────────────────────────────────────────────────────────────────────

const registerCode: McpToolDefinition = {
  name: 'register_barcode',
  description:
    'Put a barcode on an item so scanning it resolves. The format is worked out from the value, and a UPC or EAN check digit is verified before it is stored — a mis-typed code is caught here rather than on the day somebody scans a carton and the wrong item comes up. Set packSize when the code is on a case: scanning it will then add that many units, not one.',
  scope: 'write:inventory',
  confirmation: false,
  input: CreateVariantBarcodeInput,
  run: (ctx, input) => inventoryService.createBarcode(ctx, input as never),
};

const mintCodes: McpToolDefinition = {
  name: 'generate_barcodes',
  description:
    'Mint barcodes for items that arrived without one. Each is a real UPC-A in the range reserved for in-house use, so it scans on any gun with no setup and can never collide with a manufacturer code. Items that already have a barcode are skipped unless you force it. The numbers only ever go up — a deleted code is never re-issued, because its labels may still be on a shelf.',
  scope: 'write:inventory',
  confirmation: true,
  input: GenerateVariantBarcodesInput,
  run: (ctx, input) => inventoryService.generateBarcodes(ctx, input as never),
};

/**
 * The shared shape of every scan write.
 *
 * `idempotencyKey` is required, and that is worth a sentence in the description
 * of each tool that takes it: a client which reuses a key is telling us "this is
 * the scan I already sent", and one which invents a new key per retry will
 * double-count. Assistants get this right when told; they do not guess it.
 */
const ScanEnvelope = z.object({
  value: z.string().min(1).max(256),
  idempotencyKey: z
    .string()
    .min(8)
    .max(127)
    .describe(
      'A unique id for THIS trigger pull. Send the same one when retrying and the scan applies once; send a new one and it counts twice.'
    ),
  quantity: z.number().int().min(1).max(1_000_000).optional(),
  deviceId: z.string().max(64).optional(),
  scannedAt: z.string().datetime().optional(),
});

const receiveScan: McpToolDefinition = {
  name: 'scan_to_receive',
  description:
    'Book one scan against an open purchase order. A case code adds its pack size, not one. Receiving more than was ordered is refused outright, naming the numbers, because a delivery booked over the order produces a stock figure nobody can reconcile against an invoice. Nothing reaches the stock ledger until the session is posted.',
  scope: 'write:inventory',
  confirmation: false,
  input: ScanEnvelope.extend({
    purchaseOrderId: Uuid,
    damagedQuantity: z.number().int().min(0).max(1_000_000).optional(),
    binId: Uuid.nullish(),
  }),
  run: (ctx, input) => inventoryService.scanToReceive(ctx, input as never),
};

const postReceipt: McpToolDefinition = {
  name: 'post_scanned_receipt',
  description:
    'Turn a finished receiving session into a goods receipt — the irreversible step that adds the stock, records the cost, and advances the purchase order. Damaged units are booked as arrived-and-written-off rather than as sellable stock. Check the session first.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({
    purchaseOrderId: Uuid,
    reference: z.string().max(120).optional(),
    note: z.string().max(2000).optional(),
    binId: Uuid.nullish(),
  }),
  run: (ctx, input) => inventoryService.postScannedReceipt(ctx, input as never),
};

const countScan: McpToolDefinition = {
  name: 'scan_to_count',
  description:
    'Count one item on an open stock count. Scanning ACCUMULATES — ten pulls on the same item is ten, which is what counting a shelf physically is. An item that is not on the count sheet is added to it rather than refused: finding stock the system does not know about is the most valuable thing a count does.',
  scope: 'write:inventory',
  confirmation: false,
  input: ScanEnvelope.extend({
    countId: Uuid,
    accumulate: z
      .boolean()
      .default(true)
      .describe(
        'False replaces the running total instead of adding to it — a typed entry, not a scan.'
      ),
  }),
  run: (ctx, input) => inventoryService.scanToCount(ctx, input as never),
};

const transferScan: McpToolDefinition = {
  name: 'scan_to_transfer',
  description:
    'Add one scan to a draft transfer between locations. Only drafts accept scans: once a transfer is in transit its contents describe a box already on a truck.',
  scope: 'write:inventory',
  confirmation: false,
  input: ScanEnvelope.extend({ transferId: Uuid }),
  run: (ctx, input) => inventoryService.scanToTransfer(ctx, input as never),
};

const putAwayScan: McpToolDefinition = {
  name: 'scan_put_away',
  description:
    'Scan an item, name a shelf, and the stock is recorded on that shelf. Comes off the receiving shelf by default, which is the usual case. Writes the same bin-ledger entries as a typed put-away.',
  scope: 'write:inventory',
  confirmation: false,
  input: ScanEnvelope.extend({
    warehouseId: Uuid,
    toBinId: Uuid,
    fromBinId: Uuid.nullish(),
  }),
  run: (ctx, input) => inventoryService.scanPutAway(ctx, input as never),
};

export const scanWriteTools: AnyMcpTool[] = [
  registerCode,
  mintCodes,
  receiveScan,
  postReceipt,
  countScan,
  transferScan,
  putAwayScan,
];
