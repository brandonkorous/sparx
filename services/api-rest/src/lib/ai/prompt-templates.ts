// AI prompt-template library — service layer (docs/07 §9).
//
// Tenant-scoped CRUD over `ai_prompt_templates`, plus two seam helpers: the `ai`
// module preset calls `ensureDefaultPromptTemplates` (ensure-by-key, idempotent),
// and the live-chat first-responder calls `getActivePersona` to ground its system
// prompt. Every write runs inside withTenant (RLS) and audit-logs.

import type { Prisma } from '@sparx/db';
import { withTenant, type AiPromptTemplate, type TenantContext } from '@sparx/db';
import { conflict, notFound } from '@sparx/api-core/errors';

import { DEFAULT_PROMPT_TEMPLATES } from './default-prompts.js';
import {
  type PromptCategory,
  type PromptTemplateCreate,
  type PromptTemplateDto,
  type PromptTemplateUpdate,
  type PromptVariable,
} from './types.js';

function coerceVariables(raw: Prisma.JsonValue | null): PromptVariable[] {
  if (!Array.isArray(raw)) return [];
  const out: PromptVariable[] = [];
  for (const v of raw) {
    if (v && typeof v === 'object' && 'key' in v && 'label' in v) {
      const r = v as Record<string, unknown>;
      if (typeof r.key === 'string' && typeof r.label === 'string') {
        out.push({
          key: r.key,
          label: r.label,
          ...(typeof r.example === 'string' ? { example: r.example } : {}),
        });
      }
    }
  }
  return out;
}

function isSampleRow(metadata: Prisma.JsonValue | null): boolean {
  return (
    !!metadata &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata) &&
    (metadata as Record<string, unknown>).sample === true
  );
}

export function toPromptTemplateDto(row: AiPromptTemplate): PromptTemplateDto {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    category: row.category as PromptCategory,
    body: row.body,
    variables: coerceVariables(row.variables),
    model: row.model,
    enabled: row.enabled,
    isSample: isSampleRow(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPromptTemplates(
  ctx: TenantContext,
  filter: { category?: PromptCategory } = {}
): Promise<PromptTemplateDto[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.aiPromptTemplate.findMany({
      where: filter.category ? { category: filter.category } : {},
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toPromptTemplateDto);
  });
}

export async function getPromptTemplate(
  ctx: TenantContext,
  id: string
): Promise<PromptTemplateDto> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.aiPromptTemplate.findUnique({ where: { id } });
    if (row?.tenantId !== ctx.tenantId) throw notFound('AiPromptTemplate', id);
    return toPromptTemplateDto(row);
  });
}

export async function createPromptTemplate(
  ctx: TenantContext,
  input: PromptTemplateCreate
): Promise<PromptTemplateDto> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.aiPromptTemplate.findUnique({
      where: { tenantId_key: { tenantId: ctx.tenantId, key: input.key } },
      select: { id: true },
    });
    if (existing) throw conflict(`A prompt with key "${input.key}" already exists`);

    const row = await tx.aiPromptTemplate.create({
      data: {
        tenantId: ctx.tenantId,
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        category: input.category,
        body: input.body,
        variables: input.variables,
        model: input.model ?? null,
        enabled: input.enabled,
        createdByUserId: ctx.userId ?? null,
      },
    });
    await writeAiAudit(tx, ctx, 'ai.prompt_template.created', row.id, { key: row.key });
    return toPromptTemplateDto(row);
  });
}

export async function updatePromptTemplate(
  ctx: TenantContext,
  id: string,
  patch: PromptTemplateUpdate
): Promise<PromptTemplateDto> {
  return withTenant(ctx, async (tx) => {
    const current = await tx.aiPromptTemplate.findUnique({
      where: { id },
      select: { tenantId: true },
    });
    if (current?.tenantId !== ctx.tenantId) throw notFound('AiPromptTemplate', id);

    const row = await tx.aiPromptTemplate.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description ?? null } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.body !== undefined ? { body: patch.body } : {}),
        ...(patch.variables !== undefined ? { variables: patch.variables } : {}),
        ...(patch.model !== undefined ? { model: patch.model ?? null } : {}),
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      },
    });
    await writeAiAudit(tx, ctx, 'ai.prompt_template.updated', row.id, { key: row.key });
    return toPromptTemplateDto(row);
  });
}

export async function deletePromptTemplate(ctx: TenantContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const current = await tx.aiPromptTemplate.findUnique({
      where: { id },
      select: { tenantId: true, key: true },
    });
    if (current?.tenantId !== ctx.tenantId) throw notFound('AiPromptTemplate', id);
    await tx.aiPromptTemplate.delete({ where: { id } });
    await writeAiAudit(tx, ctx, 'ai.prompt_template.deleted', id, { key: current.key });
  });
}

/** Ensure every platform-default prompt exists for the tenant (by key). Idempotent —
 *  installs only the missing ones, never overwrites a tenant's edited copy. Runs on
 *  the supplied tx (composes into a preset/starter install). Returns the count added. */
export async function ensureDefaultPromptTemplates(sx: TenantContext): Promise<number> {
  const tx = sx.tx;
  if (!tx) {
    return withTenant(sx, (scopedTx) => ensureDefaultPromptTemplates({ ...sx, tx: scopedTx }));
  }
  const present = await tx.aiPromptTemplate.findMany({
    where: { key: { in: DEFAULT_PROMPT_TEMPLATES.map((t) => t.key) } },
    select: { key: true },
  });
  const have = new Set(present.map((p) => p.key));
  let added = 0;
  for (const seed of DEFAULT_PROMPT_TEMPLATES) {
    if (have.has(seed.key)) continue;
    await tx.aiPromptTemplate.create({
      data: {
        tenantId: sx.tenantId,
        key: seed.key,
        name: seed.name,
        description: seed.description,
        category: seed.category,
        body: seed.body,
        variables: seed.variables,
        model: seed.model ?? null,
        createdByUserId: sx.userId ?? null,
      },
    });
    added += 1;
  }
  return added;
}

/** The active chat persona (most-recently-updated enabled `persona` template), or
 *  null. The live-chat first-responder grounds its system prompt with this. */
export async function getActivePersona(
  tenantId: string
): Promise<{ body: string; model: string | null } | null> {
  return withTenant({ tenantId }, async (tx) => {
    const row = await tx.aiPromptTemplate.findFirst({
      where: { category: 'persona', enabled: true },
      orderBy: { updatedAt: 'desc' },
      select: { body: true, model: true },
    });
    return row ? { body: row.body, model: row.model } : null;
  });
}

async function writeAiAudit(
  tx: Prisma.TransactionClient,
  ctx: TenantContext,
  action: string,
  entityId: string,
  after: Record<string, unknown>
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action,
      entityType: 'AiPromptTemplate',
      entityId,
      diff: { after } as Prisma.InputJsonValue,
    },
  });
}
