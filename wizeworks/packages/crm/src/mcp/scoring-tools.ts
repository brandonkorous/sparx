// MCP tools for scoring and hand-picked lists (docs/144 §10).
//
// THE READ THAT MATTERS IS "WHY". A score an assistant can report but not explain
// is worse than no score: it sounds authoritative and cannot be checked. So
// `explain_crm_score` comes first and returns the reasons, not the number — the
// number is already on the record.
//
// Nothing here is confirmation-gated except adjusting a score by hand and putting
// somebody on a list, and for the same reason in both cases: they change what the
// business will DO next. A recompute is gated too, but for a different reason —
// it is the only operation here that can touch several hundred records at once.

import { z } from 'zod';

import { scoringService, segmentService } from '../services';
import { CONTACT_SCORING_FIELDS, DEAL_SCORING_FIELDS } from '../services/scoring-fields';

import type { McpToolDefinition } from './registry';

/* ── Reads ──────────────────────────────────────────────────────────────── */

export const explainScore: McpToolDefinition = {
  name: 'explain_crm_score',
  description:
    'Why a customer or a sales deal has the score it has. Returns the changes that produced it, most recent first, each with what moved it and by how much — so the number can be checked rather than taken on trust. Use this before repeating a score to anybody: a score with no reasons behind it is a number, not an answer.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({
    objectKey: z.enum(['contact', 'deal']),
    recordId: z.string().uuid(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  run: (ctx, input) =>
    scoringService.history(ctx, input as { objectKey: string; recordId: string; limit?: number }),
};

export const listScoringModels: McpToolDefinition = {
  name: 'list_crm_scoring_models',
  description:
    'The rules this business uses to score its customers and sales deals — what earns points, what loses them, and whether points bleed away when somebody goes quiet. Read this before explaining or changing anybody’s score.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({ objectKey: z.enum(['contact', 'deal']).optional() }),
  run: (ctx, input) => scoringService.listModels(ctx, input as { objectKey?: string }),
};

export const listScoringFields: McpToolDefinition = {
  name: 'list_crm_scoring_fields',
  description:
    'What a scoring rule is allowed to ask about — the full list, for customers and for sales deals. Use it before writing a rule: anything not on this list cannot be scored on, and a rule that references it would simply never match.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({}),
  run: () =>
    Promise.resolve({
      contact: CONTACT_SCORING_FIELDS,
      deal: DEAL_SCORING_FIELDS,
    }),
};

export const previewScore: McpToolDefinition = {
  name: 'preview_crm_score',
  description:
    'What a set of scoring rules WOULD give one real record, without saving anything or changing the record. The way to check a rule before it goes live — pass `rules` to try an unsaved set, or leave it out to see what the current rules make of somebody.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({
    objectKey: z.enum(['contact', 'deal']),
    recordId: z.string().uuid(),
    rules: z
      .array(
        z.object({
          condition: z.unknown(),
          points: z.number().int().min(-1000).max(1000),
          label: z.string().min(1).max(160),
        })
      )
      .max(40)
      .optional(),
    decayPerDay: z.number().min(0).max(100).nullable().optional(),
    maxScore: z.number().int().min(1).max(1000).optional(),
  }),
  run: (ctx, input) =>
    scoringService.preview(
      ctx,
      input as { objectKey: string; recordId: string; rules?: unknown; maxScore?: number }
    ),
};

export const listMembershipHistory: McpToolDefinition = {
  name: 'get_crm_list_history',
  description:
    "Who joined or left a list, and when. Answers the question a current membership list cannot — 'who dropped out of at-risk this month' — because leaving a list removes the membership but not the record of it. Filter with `kind` for just the joins or just the departures.",
  scope: 'read:crm',
  confirmation: false,
  input: z.object({
    segmentId: z.string().uuid(),
    kind: z.enum(['entered', 'exited']).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }),
  run: (ctx, input) => {
    const { segmentId, ...rest } = input as {
      segmentId: string;
      kind?: 'entered' | 'exited';
      limit?: number;
    };
    return segmentService.membershipHistory(ctx, segmentId, rest);
  },
};

/* ── Writes ─────────────────────────────────────────────────────────────── */

export const createScoringModel: McpToolDefinition = {
  name: 'create_crm_scoring_model',
  description:
    'Set up how this business scores its customers or its sales deals. Each rule is a question plus what it is worth; every rule that matches adds its points, so rules can be read one at a time and in any order. Points can be negative — "unsubscribed: −40" is what stops a list of hot leads filling up with people who cannot be contacted. Only one model can be active per object, so creating an active one retires the previous one.',
  scope: 'write:crm',
  confirmation: true,
  input: z.object({
    name: z.string().min(1).max(160),
    description: z.string().max(2000).nullish(),
    objectKey: z.enum(['contact', 'deal']),
    rules: z
      .array(
        z.object({
          condition: z.unknown(),
          points: z.number().int().min(-1000).max(1000),
          label: z.string().min(1).max(160),
        })
      )
      .max(40),
    decayPerDay: z.number().min(0).max(100).nullish(),
    maxScore: z.number().int().min(1).max(1000).optional(),
    isActive: z.boolean().optional(),
  }),
  run: (ctx, input) => scoringService.createModel(ctx, input),
};

export const updateScoringModel: McpToolDefinition = {
  name: 'update_crm_scoring_model',
  description:
    'Change a scoring model. Editing the rules does NOT re-score anybody on its own — existing scores stay as they are until records are re-scored, which is deliberate: a rule change that silently rewrote every number would make the history unreadable.',
  scope: 'write:crm',
  confirmation: true,
  input: z.object({
    modelId: z.string().uuid(),
    name: z.string().min(1).max(160).optional(),
    description: z.string().max(2000).nullish(),
    rules: z
      .array(
        z.object({
          condition: z.unknown(),
          points: z.number().int().min(-1000).max(1000),
          label: z.string().min(1).max(160),
        })
      )
      .max(40)
      .optional(),
    decayPerDay: z.number().min(0).max(100).nullish(),
    maxScore: z.number().int().min(1).max(1000).optional(),
    isActive: z.boolean().optional(),
  }),
  run: (ctx, input) => {
    const { modelId, ...patch } = input as { modelId: string } & Record<string, unknown>;
    return scoringService.updateModel(ctx, modelId, patch);
  },
};

export const adjustScore: McpToolDefinition = {
  name: 'adjust_crm_score',
  description:
    "Move one record's score by hand, with a reason — for when somebody is worth talking to whatever the rules say. Recorded as a manual change against whoever made it, so it never looks like the rules did it. The next re-score puts the number back to what the rules produce, so this is a nudge, not a permanent override.",
  scope: 'write:crm',
  confirmation: true,
  input: z.object({
    objectKey: z.enum(['contact', 'deal']),
    recordId: z.string().uuid(),
    delta: z.number().int().min(-1000).max(1000),
    reason: z.string().min(1).max(255),
  }),
  run: (ctx, input) => scoringService.adjust(ctx, input),
};

export const recomputeScores: McpToolDefinition = {
  name: 'recompute_crm_scores',
  description:
    'Re-score records against the current rules. Works in pages — the reply carries a `nextCursor`; call again with it until it comes back empty. Only records whose score actually changes are written, so running this twice in a row is harmless.',
  scope: 'write:crm_bulk',
  confirmation: true,
  input: z.object({
    objectKey: z.enum(['contact', 'deal']),
    recordIds: z.array(z.string().uuid()).max(500).optional(),
    cursor: z.string().uuid().nullish(),
    limit: z.number().int().min(1).max(500).optional(),
  }),
  run: (ctx, input) => scoringService.recompute(ctx, input),
};

export const addToList: McpToolDefinition = {
  name: 'add_to_crm_list',
  description:
    'Put people on a hand-picked list. Only works on lists whose membership is chosen by hand — a list that works its members out from rules will refuse, because anything added there would be removed again the next time the rules ran.',
  scope: 'write:crm',
  confirmation: true,
  input: z.object({
    segmentId: z.string().uuid(),
    customerIds: z.array(z.string().uuid()).min(1).max(1000),
  }),
  run: (ctx, input) => {
    const { segmentId, customerIds } = input as { segmentId: string; customerIds: string[] };
    return segmentService.addMembers(ctx, segmentId, { customerIds }, 'automation');
  },
};

export const removeFromList: McpToolDefinition = {
  name: 'remove_from_crm_list',
  description:
    'Take people off a hand-picked list. Their departure is recorded, so "who came off this list and when" stays answerable afterwards.',
  scope: 'write:crm',
  confirmation: true,
  input: z.object({
    segmentId: z.string().uuid(),
    customerIds: z.array(z.string().uuid()).min(1).max(1000),
  }),
  run: (ctx, input) => {
    const { segmentId, customerIds } = input as { segmentId: string; customerIds: string[] };
    return segmentService.removeMembers(ctx, segmentId, { customerIds }, 'automation');
  },
};

export const SCORING_TOOLS: McpToolDefinition[] = [
  explainScore,
  listScoringModels,
  listScoringFields,
  previewScore,
  listMembershipHistory,
  createScoringModel,
  updateScoringModel,
  adjustScore,
  recomputeScores,
  addToList,
  removeFromList,
];
