// MCP tools for the object registry (docs/144 §3).
//
// These are the tools that let an AI client SHAPE a business's CRM rather than
// just fill it in: read what a record type looks like, add the extra details
// this business tracks, invent a whole new kind of record, and read/write its
// rows. Nothing else in the platform can do that, and it is the reason a sparx
// tenant can be set up by describing the business out loud.
//
// The read tools carry no confirmation (they change nothing). Every write does,
// and the two SCHEMA-shaping tools are the most consequential writes in the CRM:
// changing a record type reshapes every list, form, segment and report built on
// it, so the client must surface what is about to change.

import { z } from 'zod';

import {
  CreateObjectDefInput,
  CreateCrmRecordInput,
  UpdateObjectDefInput,
  UpdateCrmRecordInput,
} from '@wizeworks/crm-schemas';

import { crmRecordService, objectDefService } from '../services';

import type { McpToolDefinition } from './registry';

/* ── Reads ──────────────────────────────────────────────────────────────── */

export const listObjectTypes: McpToolDefinition = {
  name: 'list_crm_object_types',
  description:
    'List every kind of record this business keeps — the four built-in ones (customer, company, deal, request) plus any they invented — with the extra details declared on each. Call this BEFORE writing a customer, deal or company if you intend to set any field beyond the standard ones: it is the only way to learn what this particular business tracks.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({
    kind: z
      .enum(['builtin', 'custom'])
      .optional()
      .describe(
        'Limit to the records this software ships (builtin) or the ones this business invented.'
      ),
    includeArchived: z.boolean().optional(),
  }),
  run: (ctx, input) =>
    objectDefService.list(ctx, input as { kind?: 'builtin' | 'custom'; includeArchived?: boolean }),
};

export const getObjectType: McpToolDefinition = {
  name: 'get_crm_object_type',
  description:
    "Read one record type in full, including its property schema — the typed list of extra details this business tracks on it. The schema's field keys are exactly the keys to send in `customProperties` (on a customer / deal / company) or `values` (on a custom record).",
  scope: 'read:crm',
  confirmation: false,
  input: z.object({
    objectKey: z
      .string()
      .describe('contact | company | deal | ticket, or the key of a custom record type.'),
  }),
  run: (ctx, input) => objectDefService.get(ctx, (input as { objectKey: string }).objectKey),
};

export const listRecords: McpToolDefinition = {
  name: 'list_crm_records',
  description:
    'List the rows of a record type this business invented (not customers, deals or companies — those have their own tools). Returns each row with its `values` bag.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({
    objectKey: z.string(),
    q: z.string().max(200).optional().describe('Match against the record title.'),
    ownerId: z.string().uuid().optional(),
    take: z.number().int().min(1).max(250).optional(),
    skip: z.number().int().min(0).optional(),
  }),
  run: (ctx, input) => crmRecordService.list(ctx, input),
};

export const getRecord: McpToolDefinition = {
  name: 'get_crm_record',
  description: 'Read one row of a business-defined record type.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({ recordId: z.string().uuid() }),
  run: (ctx, input) => crmRecordService.get(ctx, (input as { recordId: string }).recordId),
};

/* ── Shaping the CRM ────────────────────────────────────────────────────── */

export const createObjectType: McpToolDefinition = {
  name: 'create_crm_object_type',
  description:
    'Invent a new kind of record for this business — a service contract, a property listing, a piece of equipment. Supply `propertySchema.fields` as a list of typed fields (see get_crm_object_type for the vocabulary: text, long_text, number, currency, boolean, date, datetime, enum, url, email, user, reference, asset, calculated, object, repeater). Set `primaryFieldKey` to the field that names the record. This creates a whole new list, detail view, search and automation trigger — confirm what is being added before calling.',
  scope: 'write:crm',
  confirmation: true,
  input: CreateObjectDefInput,
  run: (ctx, input) => objectDefService.create(ctx, input),
};

export const updateObjectType: McpToolDefinition = {
  name: 'update_crm_object_type',
  description:
    'Change a record type: rename it, or change the extra details tracked on it. Works on the built-in customer / company / deal / request too — that is how you add "warranty expires" to every customer. WARNING: `propertySchema` REPLACES the whole field list, so read the current one with get_crm_object_type and send it back with your additions, never just the new field. Removing a field hides it but does not erase what was stored, so re-adding it brings the values back.',
  scope: 'write:crm',
  confirmation: true,
  input: UpdateObjectDefInput.extend({ objectKey: z.string() }),
  run: (ctx, input) => {
    const { objectKey, ...patch } = input as { objectKey: string } & Record<string, unknown>;
    return objectDefService.update(ctx, objectKey, patch);
  },
};

export const archiveObjectType: McpToolDefinition = {
  name: 'archive_crm_object_type',
  description:
    'Put away a record type this business invented. Its rows are kept and come back if it is restored. The four built-in record types cannot be archived.',
  scope: 'write:crm',
  confirmation: true,
  input: z.object({ objectKey: z.string() }),
  run: (ctx, input) => objectDefService.archive(ctx, (input as { objectKey: string }).objectKey),
};

/* ── Rows ───────────────────────────────────────────────────────────────── */

export const createRecord: McpToolDefinition = {
  name: 'create_crm_record',
  description:
    'Add a row of a business-defined record type. `values` keys must match the field keys on that type — call get_crm_object_type first. Fields marked `calculated` are worked out by the server and anything sent for them is ignored.',
  scope: 'write:crm',
  confirmation: true,
  input: CreateCrmRecordInput,
  run: (ctx, input) => crmRecordService.create(ctx, input),
};

export const updateRecord: McpToolDefinition = {
  name: 'update_crm_record',
  description:
    'Change a row of a business-defined record type. `values` is MERGED onto what is stored, so sending one field changes only that field.',
  scope: 'write:crm',
  confirmation: true,
  input: UpdateCrmRecordInput.extend({ recordId: z.string().uuid() }),
  run: (ctx, input) => {
    const { recordId, ...patch } = input as { recordId: string } & Record<string, unknown>;
    return crmRecordService.update(ctx, recordId, patch);
  },
};

export const deleteRecord: McpToolDefinition = {
  name: 'delete_crm_record',
  description:
    'Remove a row of a business-defined record type. It is kept for the record and drops out of every list.',
  scope: 'write:crm',
  confirmation: true,
  input: z.object({ recordId: z.string().uuid() }),
  run: async (ctx, input) => {
    await crmRecordService.remove(ctx, (input as { recordId: string }).recordId);
    return { deleted: true };
  },
};

export const OBJECT_TOOLS: McpToolDefinition[] = [
  listObjectTypes,
  getObjectType,
  listRecords,
  getRecord,
  createObjectType,
  updateObjectType,
  archiveObjectType,
  createRecord,
  updateRecord,
  deleteRecord,
];
