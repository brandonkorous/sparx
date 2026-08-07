// MCP tools for the relationship graph (docs/144 §6).
//
// The tools that let an AI client answer the question a single foreign key
// cannot: "who else is involved in this?" A deal is sold to the person who signs
// it, the person who will use it and the person in accounts who pays — and until
// an assistant can read and write that, it can only ever describe one of them.
//
// Reads are open; every write is confirmation-gated. `make_primary` is the most
// consequential of them, because it rewrites the foreign-key column the reports
// and the live site read — the description says so, so a client can tell the
// person what is about to change.

import { z } from 'zod';

import { CreateAssociationInput, CreateAssociationLabelInput } from '@sparx/crm-schemas';

import { associationService } from '../services';

import type { McpToolDefinition } from './registry';

/* ── Reads ──────────────────────────────────────────────────────────────── */

export const listAssociations: McpToolDefinition = {
  name: 'list_crm_associations',
  description:
    'List everything related to one record — the people on a deal, the deals a person is involved in, the companies under a parent group — with what each relationship is called from this record\'s point of view. Works from either end of a link. Call this before answering "who else is involved", or before emailing everyone connected to a deal.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({
    objectKey: z
      .string()
      .describe('contact | company | deal | ticket, or the key of a custom record type.'),
    recordId: z.string().uuid(),
    toType: z.string().optional().describe('Only relationships pointing at this kind of record.'),
    labelKey: z.string().optional().describe('Only one kind of relationship.'),
  }),
  run: (ctx, input) =>
    associationService.listFor(
      ctx,
      input as { objectKey: string; recordId: string; toType?: string; labelKey?: string }
    ),
};

export const listAssociationLabels: McpToolDefinition = {
  name: 'list_crm_relationship_types',
  description:
    'List the kinds of relationship this business records between records — "Signs it off", "Works there", "Introduced by" — and what each is called from both ends. Call this before relating two records, so the link carries the right name instead of being left unlabelled.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({
    fromType: z.string().optional(),
    toType: z.string().optional(),
  }),
  run: (ctx, input) =>
    associationService.listLabels(ctx, input as { fromType?: string; toType?: string }),
};

/* ── Writes ─────────────────────────────────────────────────────────────── */

export const relateRecords: McpToolDefinition = {
  name: 'relate_crm_records',
  description:
    'Relate two records and say how they are related — add a second contact to a deal as the person who signs it off, record which company someone works at, note who introduced whom. Use `list_crm_relationship_types` first to find the right labelKey; leaving it out records the link without naming it, which is fine when you genuinely do not know.',
  scope: 'write:crm',
  confirmation: true,
  input: CreateAssociationInput,
  run: (ctx, input) => associationService.create(ctx, input),
};

export const updateAssociation: McpToolDefinition = {
  name: 'update_crm_association',
  description:
    'Change what an existing relationship is called, or the note on it. To point a relationship at a different record, remove it and make a new one.',
  scope: 'write:crm',
  confirmation: true,
  input: z.object({
    associationId: z.string().uuid(),
    labelKey: z.string().nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
  }),
  run: (ctx, input) => {
    const { associationId, ...patch } = input as { associationId: string } & Record<
      string,
      unknown
    >;
    return associationService.update(ctx, associationId, patch);
  },
};

export const makeAssociationPrimary: McpToolDefinition = {
  name: 'make_crm_association_primary',
  description:
    "Make this the MAIN relationship of its kind — the deal's main customer, the company someone mainly works for. This changes what shows on lists, invoices and reports, because the main relationship is the one the rest of the system reads. There can only be one at a time; whichever held it before steps down.",
  scope: 'write:crm',
  confirmation: true,
  input: z.object({ associationId: z.string().uuid() }),
  run: (ctx, input) =>
    associationService.makePrimary(ctx, (input as { associationId: string }).associationId),
};

export const unrelateRecords: McpToolDefinition = {
  name: 'unrelate_crm_records',
  description:
    'Remove a relationship between two records. Neither record is deleted — only the link between them. If it was the main relationship of its kind, another one of the same kind takes over where there is one.',
  scope: 'write:crm',
  confirmation: true,
  input: z.object({ associationId: z.string().uuid() }),
  run: async (ctx, input) => {
    await associationService.remove(ctx, (input as { associationId: string }).associationId);
    return { deleted: true };
  },
};

export const createAssociationLabel: McpToolDefinition = {
  name: 'create_crm_relationship_type',
  description:
    'Invent a new kind of relationship this business records — "Referred by", "Installed at", "Reports to". Needs BOTH wordings: how it reads from the first record ("Signs it off") and from the second ("Deals they sign off"), because a panel on either side shows one of them. This reshapes what every relationship panel offers, so confirm the wording with the person first.',
  scope: 'write:crm',
  confirmation: true,
  input: CreateAssociationLabelInput,
  run: (ctx, input) => associationService.createLabel(ctx, input),
};

export const ASSOCIATION_TOOLS: McpToolDefinition[] = [
  listAssociations,
  listAssociationLabels,
  relateRecords,
  updateAssociation,
  makeAssociationPrimary,
  unrelateRecords,
  createAssociationLabel,
];
