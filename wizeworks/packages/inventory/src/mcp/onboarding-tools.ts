// Onboarding MCP tools (docs/146 Phase 11, D10 + D11).
//
// Two groups of questions, and one deliberate absence.
//
// The SETUP tools answer "where am I up to" and "what would this file do".
// Reading a spreadsheet and reporting what it would change is the single most
// useful thing an assistant can do during setup: a person can paste their file
// and ask "does this look right?" before anything at all is written.
//
// The CUSTOM FIELD tools exist because 11.8 asks for the tenant's own columns to
// be present in the API and in MCP as well as on screen. Reading them is
// obvious. Writing a VALUE is ordinary work — "put the aisle number on this
// item" is exactly the sort of tidying an agent should do.
//
// What is NOT here: applying an import, and creating or removing a field
// DEFINITION. Applying posts hundreds of movements from a file the agent read
// and the person did not, which is the largest single write in the module;
// removing a definition hides data on every record at once. Both stay on the
// screens where a person can see what they are about to do.
//
// Per the platform's BYOK/MCP-only rule, sparx runs no model here — the tenant
// brings their own client and these tools serve it.

import { CustomFieldEntity } from '@wizeworks/commerce-schemas';
import { z } from 'zod';

import { inventoryService } from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

const Uuid = z.string().uuid();

// ─── Reads ───────────────────────────────────────────────────────────────────

const getInventorySetup: McpToolDefinition = {
  name: 'get_inventory_setup',
  description:
    "Where inventory setup has got to, and how long it has taken. Returns each step (locations, import, column mapping, opening count, alerts) with whether it is done, skipped or outstanding — plus what is actually TRUE in the account, which can disagree with what was ticked. Timing comes back as hands-on minutes and how many sittings it took, and is null rather than zero when nothing has been measured yet. Use it to answer 'what's left to set up' or 'why is my stock report empty'.",
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({}),
  run: (ctx) => inventoryService.getSetupProgress(ctx),
};

const previewStockImport: McpToolDefinition = {
  name: 'preview_stock_import',
  description:
    "Read a stock spreadsheet and say what it WOULD do — writes nothing at all. Returns the file's headings matched against what the importer needs, with a confidence on every guess, the headings nothing wanted, which required fields are still unanswered, three sample rows, and how the file writes its numbers. Use this whenever somebody asks whether their file will import, or to explain which column is missing.",
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    csv: z.string().min(1).max(5_000_000).describe('The file contents, as text'),
    filename: z.string().max(255).optional(),
    recipeKey: z
      .string()
      .max(60)
      .optional()
      .describe('A migration recipe to widen the column vocabulary — see list_import_recipes'),
    profileId: Uuid.optional().describe('A saved column mapping to apply instead of guessing'),
  }),
  run: (ctx, input) => {
    const i = input as {
      csv: string;
      filename?: string;
      recipeKey?: string;
      profileId?: string;
    };
    return inventoryService.previewImport(ctx, {
      csv: i.csv,
      filename: i.filename ?? null,
      recipeKey: i.recipeKey ?? null,
      profileId: i.profileId ?? null,
    });
  },
};

const listImportRecipes: McpToolDefinition = {
  name: 'list_import_recipes',
  description:
    'The kinds of stock file sparx knows how to read — a hand-kept spreadsheet, an item list from accounts software, a marketplace listing report, a till export, or a stock-take sheet sparx itself produced. Each says how to recognise it. Use it to pick the right recipe before previewing an import.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({}),
  // Static data from the source, not a query — recipes ship in the code.
  run: () => Promise.resolve({ recipes: inventoryService.listMigrationRecipes() }),
};

const getOpeningBalance: McpToolDefinition = {
  name: 'get_opening_balance',
  description:
    'Whether this business ever counted what it started with. Returns any opening count in progress, the posted ones with their dates, and — the useful part — the locations holding stock that have NO opening count, whose figures therefore rest on an assumption rather than on anybody having looked.',
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({}),
  run: (ctx) => inventoryService.openingBalanceStatus(ctx),
};

const listCustomFields: McpToolDefinition = {
  name: 'list_inventory_custom_fields',
  description:
    "The extra columns this business keeps on its items, stock positions, suppliers and purchase orders — the ones no standard schema anticipated. Returns each field's key, label, type and choices. Read this FIRST before setting a custom field value, because the key and the allowed choices are what a write has to use.",
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    entity: CustomFieldEntity.optional().describe(
      'variant (an item), level (stock at one location), supplier, or purchase_order'
    ),
  }),
  run: (ctx, input) => {
    const i = input as { entity?: z.infer<typeof CustomFieldEntity> };
    return inventoryService.listCustomFields(ctx, i.entity ? { entity: i.entity } : {});
  },
};

const getCustomFieldValues: McpToolDefinition = {
  name: 'get_inventory_custom_field_values',
  description:
    "The extra columns held on one record. Identify a stock position as '<item id>:<location id>'; everything else by its own id.",
  scope: 'read:inventory',
  confirmation: false,
  input: z.object({
    entity: CustomFieldEntity,
    recordId: z.string().min(1).max(100),
  }),
  run: (ctx, input) => {
    const i = input as { entity: z.infer<typeof CustomFieldEntity>; recordId: string };
    return inventoryService.getCustomFieldValues(ctx, i.entity, targetFor(i.entity, i.recordId));
  },
};

// ─── Writes ──────────────────────────────────────────────────────────────────

const setCustomFieldValues: McpToolDefinition = {
  name: 'set_inventory_custom_field_values',
  description:
    "Fill in the business's own columns on one record — the aisle in their old numbering, the certification a supplier holds, the project a purchase order belongs to. Send only the fields you are changing; the rest are left alone. Values are checked against the field's type and choices and REFUSED if they do not fit, rather than being stored as text. Call list_inventory_custom_fields first to learn the keys.",
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({
    entity: CustomFieldEntity,
    recordId: z
      .string()
      .min(1)
      .max(100)
      .describe("The record's id; for a stock position, '<item id>:<location id>'"),
    values: z.record(z.string(), z.unknown()).describe('Field key → value'),
  }),
  run: (ctx, input) => {
    const i = input as {
      entity: z.infer<typeof CustomFieldEntity>;
      recordId: string;
      values: Record<string, unknown>;
    };
    return inventoryService.setCustomFieldValues(
      ctx,
      i.entity,
      targetFor(i.entity, i.recordId),
      i.values
    );
  },
};

const startOpeningBalance: McpToolDefinition = {
  name: 'start_opening_balance',
  description:
    'Open the count that establishes what a business starts with, at one location. Creates a blind counting session covering every item — it does NOT change any quantity; somebody still enters what they find and posts it. Use when a business is setting up and wants day one to rest on a real count rather than on whatever their spreadsheet said.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({
    warehouseId: Uuid,
    isBlind: z
      .boolean()
      .default(true)
      .describe('Hide the expected figure from whoever counts. Leave on unless asked.'),
    note: z.string().max(500).optional(),
  }),
  run: (ctx, input) => {
    const i = input as { warehouseId: string; isBlind: boolean; note?: string };
    return inventoryService.startOpeningBalance(ctx, {
      warehouseId: i.warehouseId,
      isBlind: i.isBlind,
      note: i.note ?? null,
    });
  },
};

/** A stock position takes two ids; everything else takes one. */
function targetFor(
  entity: z.infer<typeof CustomFieldEntity>,
  recordId: string
): { id: string } | { variantId: string; warehouseId: string } {
  if (entity !== 'level') return { id: recordId };
  const [variantId, warehouseId] = recordId.split(':');
  if (!variantId || !warehouseId) {
    throw new Error("A stock position is identified as '<item id>:<location id>'");
  }
  return { variantId, warehouseId };
}

export const onboardingReadTools: AnyMcpTool[] = [
  getInventorySetup,
  previewStockImport,
  listImportRecipes,
  getOpeningBalance,
  listCustomFields,
  getCustomFieldValues,
];

export const onboardingWriteTools: AnyMcpTool[] = [setCustomFieldValues, startOpeningBalance];
