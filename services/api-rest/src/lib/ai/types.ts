// AI module — shared DTO shapes + zod validators for the prompt-template library
// and the MCP tool-policy overlay (docs/07 §9). The REST routes parse with these;
// the services + dashboard import the inferred types.

import { z } from 'zod';

// What a prompt is for — drives grouping + which flow consumes it. `persona` is the
// one the live-chat AI reads to ground its system prompt (ai-handler.ts).
export const PROMPT_CATEGORIES = [
  'persona',
  'support',
  'email',
  'product',
  'seo',
  'social',
  'crm',
  'general',
] as const;
export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

/** A declared `{{variable}}` the editor surfaces as a hint chip. Advisory only. */
export const PromptVariableSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-zA-Z0-9_.]+$/, 'letters, numbers, dot, underscore only'),
  label: z.string().min(1).max(120),
  example: z.string().max(240).optional(),
});
export type PromptVariable = z.infer<typeof PromptVariableSchema>;

export const PromptTemplateCreateSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase kebab-case slug'),
  name: z.string().min(1).max(160),
  description: z.string().max(2000).nullish(),
  category: z.enum(PROMPT_CATEGORIES),
  body: z.string().min(1).max(20000),
  variables: z.array(PromptVariableSchema).max(40).default([]),
  model: z.string().max(64).nullish(),
  enabled: z.boolean().default(true),
  // Which site this prompt belongs to (docs/131 §3.5). Explicit null = shared
  // across every site. Matters most for `category: 'persona'`, the live-chat
  // AI's voice: a tenant-wide persona means both businesses answer as one.
  propertyId: z.string().uuid().nullable().optional(),
});
export type PromptTemplateCreate = z.infer<typeof PromptTemplateCreateSchema>;

// Update is the create shape minus the immutable key, all-optional (PATCH semantics).
export const PromptTemplateUpdateSchema = PromptTemplateCreateSchema.omit({ key: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'at least one field must be provided');
export type PromptTemplateUpdate = z.infer<typeof PromptTemplateUpdateSchema>;

export interface PromptTemplateDto {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: PromptCategory;
  body: string;
  variables: PromptVariable[];
  model: string | null;
  enabled: boolean;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Tool policy ──────────────────────────────────────────────────────────────

export const ToolPolicySetSchema = z.object({
  enabled: z.boolean(),
});
export type ToolPolicySet = z.infer<typeof ToolPolicySetSchema>;

/** One MCP tool as the policy UI sees it: catalog metadata + the tenant's current
 *  exposure (default-on unless a row disables it). */
export interface ToolPolicyDto {
  name: string;
  description: string;
  scope: string;
  /** The module a tool's scope maps to (gated separately), or null for platform tools. */
  module: string | null;
  write: boolean;
  /** Effective exposure for this tenant — false ⇒ hidden + refused by the MCP server. */
  enabled: boolean;
  /** True when the tenant has an explicit policy row (vs. the implicit default). */
  explicit: boolean;
}
