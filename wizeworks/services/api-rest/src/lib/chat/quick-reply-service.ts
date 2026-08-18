// Live Chat — quick replies (canned responses) service (docs/56, docs/69 A-1).
//
// Tenant-authored snippets the staff inbox inserts via a "/" autocomplete.
// Tenant-scoped through withTenant; throws @wizeworks/api-core ApiError.

import { withTenant } from '@wizeworks/db';
import type { TenantContext } from '@wizeworks/db';
import { conflict, notFound } from '@wizeworks/api-core/errors';

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

/**
 * Quick replies offered on one site: that site's own, plus the tenant-wide ones
 * (docs/131 §3.7).
 *
 * BOTH tiers, not most-specific-wins — unlike the persona resolver. These are a
 * PALETTE an agent picks from rather than a single answer to one question, so a
 * site-specific reply adds to the generic ones instead of replacing them. What
 * this removes is the reverse leak: a reply about fresh-baked donuts appearing
 * in a machine-shop thread.
 */
export async function list(
  ctx: TenantContext,
  propertyId: string | null
): Promise<QuickReplyDto[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.chatQuickReply.findMany({
      // `OR` rather than `in: [id, null]` — Prisma's `in` rejects null even on a
      // nullable column.
      where: propertyId ? { OR: [{ propertyId }, { propertyId: null }] } : { propertyId: null },
      orderBy: { title: 'asc' },
    });
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
        // null = offered on every site. The route decides which, so an author on
        // one business's inbox writes a reply for that business by default.
        propertyId: input.propertyId ?? null,
        title: input.title,
        body: input.body,
        shortcut: input.shortcut ?? null,
      },
    });
    return toDto(created);
  });
}

// ─── Activation default (docs/104 L2) ─────────────────────────────────
//
// On `module.activated(chat)`, seed a small bank of canned responses so the
// staff inbox's "/" autocomplete is useful on day one instead of empty. Generic,
// industry-agnostic copy the tenant edits or replaces. Find-or-create per title
// (and skip a shortcut that already exists) so a re-activation or a tenant that
// already wrote their own replies is never disturbed (docs/104 R1–R4). `tenantId`
// is scoped explicitly (not just RLS) since the local superuser bypasses RLS.
const DEFAULT_QUICK_REPLIES: { title: string; body: string; shortcut: string }[] = [
  {
    title: 'Greeting',
    body: 'Hi there! 👋 Thanks for reaching out — how can we help you today?',
    shortcut: 'hi',
  },
  {
    title: 'One moment',
    body: 'Thanks for your patience — let me look into that for you right now.',
    shortcut: 'wait',
  },
  {
    title: 'Order status',
    body: 'Happy to check on your order! Could you share your order number so I can pull it up?',
    shortcut: 'order',
  },
  {
    title: 'Shipping times',
    body: "Most orders ship within 1–2 business days, and you'll get a tracking link by email as soon as yours is on its way.",
    shortcut: 'shipping',
  },
  {
    title: 'Returns',
    body: "No problem — eligible items can be returned within 30 days of delivery. I can start a return for you whenever you're ready.",
    shortcut: 'returns',
  },
  {
    title: 'Business hours',
    body: "Our team is here Monday–Friday, 9am–5pm. If we miss you, leave your email and we'll follow up as soon as we're back.",
    shortcut: 'hours',
  },
  {
    title: 'Anything else',
    body: 'Glad I could help! Is there anything else I can do for you today?',
    shortcut: 'else',
  },
];

export async function bootstrapDefaults(ctx: TenantContext): Promise<{ created: number }> {
  return withTenant(ctx, async (tx) => {
    let created = 0;
    for (const qr of DEFAULT_QUICK_REPLIES) {
      const existingByTitle = await tx.chatQuickReply.findFirst({
        where: { tenantId: ctx.tenantId, title: qr.title },
        select: { id: true },
      });
      if (existingByTitle) continue;
      const shortcutClash = await tx.chatQuickReply.findFirst({
        where: { tenantId: ctx.tenantId, shortcut: qr.shortcut },
        select: { id: true },
      });
      await tx.chatQuickReply.create({
        data: {
          tenantId: ctx.tenantId,
          title: qr.title,
          body: qr.body,
          shortcut: shortcutClash ? null : qr.shortcut,
        },
      });
      created += 1;
    }
    return { created };
  });
}

export async function remove(ctx: TenantContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.chatQuickReply.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw notFound('QuickReply', id);
    await tx.chatQuickReply.delete({ where: { id } });
  });
}
