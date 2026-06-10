// Live Chat — quick replies (canned responses) service (docs/56, docs/69 A-1).
//
// Tenant-authored snippets the staff inbox inserts via a "/" autocomplete.
// Tenant-scoped through withTenant; throws @sparx/api-core ApiError.

import { withTenant } from '@sparx/db';
import type { TenantContext } from '@sparx/db';
import { conflict, notFound } from '@sparx/api-core/errors';

import type { CreateQuickReplyInputT } from './types.js';

export interface QuickReplyDto {
  id: string;
  title: string;
  body: string;
  shortcut: string | null;
  createdAt: string;
  updatedAt: string;
}

function toDto(r: {
  id: string;
  title: string;
  body: string;
  shortcut: string | null;
  createdAt: Date;
  updatedAt: Date;
}): QuickReplyDto {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    shortcut: r.shortcut,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function list(ctx: TenantContext): Promise<QuickReplyDto[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.chatQuickReply.findMany({ orderBy: { title: 'asc' } });
    return rows.map(toDto);
  });
}

export async function create(
  ctx: TenantContext,
  input: CreateQuickReplyInputT
): Promise<QuickReplyDto> {
  return withTenant(ctx, async (tx) => {
    if (input.shortcut) {
      const clash = await tx.chatQuickReply.findFirst({
        where: { shortcut: input.shortcut },
        select: { id: true },
      });
      if (clash)
        throw conflict(`Shortcut "${input.shortcut}" is already in use.`, { field: 'shortcut' });
    }
    const created = await tx.chatQuickReply.create({
      data: {
        tenantId: ctx.tenantId,
        title: input.title,
        body: input.body,
        shortcut: input.shortcut ?? null,
      },
    });
    return toDto(created);
  });
}

export async function remove(ctx: TenantContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.chatQuickReply.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw notFound('QuickReply', id);
    await tx.chatQuickReply.delete({ where: { id } });
  });
}
