// salesTemplateService — the emails a rep sends over and over (docs/144 §5.4).
//
// Two shapes, one file, because they are the same idea at two sizes: a TEMPLATE
// is a whole message (subject + body), a SNIPPET is a paragraph you drop into
// one mid-sentence.
//
// THE COUNTERS ARE THE POINT. Templating on its own only saves typing. Counting
// sends, opens and replies is what lets a business notice that one follow-up
// gets answered and another never does — and stop sending the second one. That
// is the difference between a text expander and a sales tool.
//
// PRIVATE BY DEFAULT for templates, SHARED by default for snippets. A half-
// written template appearing in a colleague's picker is a nuisance; a snippet is
// almost always a fact about the business ("our hours", "our returns policy")
// that everyone should have.

import {
  CreateSnippetInput,
  CreateTemplateInput,
  UpdateSnippetInput,
  UpdateTemplateInput,
} from '@wizeworks/crm-schemas';
import { withTenant } from '@wizeworks/db';
import type { SalesSnippet, SalesTemplate } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { CrmConflictError, CrmNotFoundError } from '../errors';

/* ── Templates ──────────────────────────────────────────────────────────── */

/**
 * The templates this person may use: theirs, plus everything shared.
 *
 * The visibility rule lives here so no surface has to re-derive it — a picker
 * that filtered client-side would have already fetched the private drafts it was
 * hiding.
 */
export async function listTemplates(
  ctx: ServiceContext,
  args: { userId?: string; folder?: string; includeArchived?: boolean } = {}
): Promise<SalesTemplate[]> {
  return withTenant(ctx, (tx) =>
    tx.salesTemplate.findMany({
      where: {
        ...(args.includeArchived ? {} : { archivedAt: null }),
        ...(args.folder ? { folder: args.folder } : {}),
        ...(args.userId ? { OR: [{ isShared: true }, { ownerUserId: args.userId }] } : {}),
      },
      // Most-used first: the one someone reaches for daily should not be the one
      // they scroll to.
      orderBy: [{ sendCount: 'desc' }, { name: 'asc' }],
    })
  );
}

export async function getTemplate(ctx: ServiceContext, templateId: string): Promise<SalesTemplate> {
  const row = await withTenant(ctx, (tx) =>
    tx.salesTemplate.findUnique({ where: { id: templateId } })
  );
  if (!row) throw new CrmNotFoundError('SalesTemplate', templateId);
  return row;
}

export async function createTemplate(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<SalesTemplate> {
  const input = CreateTemplateInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const clash = await tx.salesTemplate.findFirst({ where: { name: input.name } });
    if (clash) {
      // Named separately when the clash is with one that has been put away —
      // otherwise the message points at a template they cannot see anywhere,
      // and the only move that looks available is inventing a worse name.
      throw new CrmConflictError(
        clash.archivedAt
          ? `You have a template called "${input.name}" put away. Bring that one back, or use a different name.`
          : `You already have a template called "${input.name}".`,
        'name'
      );
    }

    const row = await tx.salesTemplate.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: input.propertyId ?? null,
        name: input.name,
        folder: input.folder ?? null,
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        ownerUserId: ctx.userId ?? null,
        isShared: input.isShared ?? false,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.sales_template.created',
      entityType: 'SalesTemplate',
      entityId: row.id,
      diff: { after: { name: row.name } },
    });
    return row;
  });
}

export async function updateTemplate(
  ctx: ServiceContext,
  templateId: string,
  rawInput: unknown
): Promise<SalesTemplate> {
  const input = UpdateTemplateInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const before = await tx.salesTemplate.findUnique({ where: { id: templateId } });
    if (!before) throw new CrmNotFoundError('SalesTemplate', templateId);

    if (input.name !== undefined && input.name !== before.name) {
      const clash = await tx.salesTemplate.findFirst({
        where: { name: input.name, id: { not: templateId } },
      });
      if (clash) {
        throw new CrmConflictError(`You already have a template called "${input.name}".`, 'name');
      }
    }

    return tx.salesTemplate.update({
      where: { id: templateId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.folder !== undefined ? { folder: input.folder } : {}),
        ...(input.subject !== undefined ? { subject: input.subject } : {}),
        ...(input.bodyHtml !== undefined ? { bodyHtml: input.bodyHtml } : {}),
        ...(input.isShared !== undefined ? { isShared: input.isShared } : {}),
      },
    });
  });
}

/**
 * Put a template away. Its history stays.
 *
 * Archive rather than delete, because the send/open/reply counters are the only
 * record of what a business learned about their own messaging — and deleting a
 * template that was sent four hundred times deletes that.
 */
export async function archiveTemplate(
  ctx: ServiceContext,
  templateId: string
): Promise<SalesTemplate> {
  return withTenant(ctx, async (tx) => {
    const before = await tx.salesTemplate.findUnique({ where: { id: templateId } });
    if (!before) throw new CrmNotFoundError('SalesTemplate', templateId);
    return tx.salesTemplate.update({
      where: { id: templateId },
      data: { archivedAt: new Date() },
    });
  });
}

/**
 * Take one back out again.
 *
 * Archiving is one press and it hides a template from every picker in the
 * business, so it needs a way back — otherwise a mis-click costs the message
 * itself, and the only recovery is retyping it from memory under a new name,
 * which also orphans the counters that made the original worth keeping.
 *
 * No name check is needed on the way back: `[tenantId, name]` is unique whether
 * a template is put away or not, and `createTemplate` refuses a clash by name
 * rather than by row, so an archived template's name was never free to take.
 */
export async function restoreTemplate(
  ctx: ServiceContext,
  templateId: string
): Promise<SalesTemplate> {
  return withTenant(ctx, async (tx) => {
    const before = await tx.salesTemplate.findUnique({ where: { id: templateId } });
    if (!before) throw new CrmNotFoundError('SalesTemplate', templateId);
    if (before.archivedAt === null) return before;
    return tx.salesTemplate.update({ where: { id: templateId }, data: { archivedAt: null } });
  });
}

/** How well a template is doing, as rates rather than raw counts. */
export interface TemplatePerformance {
  id: string;
  name: string;
  sendCount: number;
  openRate: number | null;
  replyRate: number | null;
}

/**
 * The comparison a business actually wants: which of these gets answered.
 *
 * Rates are NULL below a floor rather than a wild percentage — one send and one
 * reply is not a 100% reply rate, and showing it as one would have people
 * standardise on a template that worked once.
 */
export async function templatePerformance(
  ctx: ServiceContext,
  options: { minimumSends?: number } = {}
): Promise<TemplatePerformance[]> {
  const floor = options.minimumSends ?? 5;
  const rows = await listTemplates(ctx, { includeArchived: true });
  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      sendCount: row.sendCount,
      openRate: row.sendCount >= floor ? row.openCount / row.sendCount : null,
      replyRate: row.sendCount >= floor ? row.replyCount / row.sendCount : null,
    }))
    .sort((a, b) => (b.replyRate ?? -1) - (a.replyRate ?? -1));
}

/* ── Snippets ───────────────────────────────────────────────────────────── */

export async function listSnippets(
  ctx: ServiceContext,
  args: { userId?: string } = {}
): Promise<SalesSnippet[]> {
  return withTenant(ctx, (tx) =>
    tx.salesSnippet.findMany({
      where: args.userId ? { OR: [{ isShared: true }, { ownerUserId: args.userId }] } : {},
      orderBy: [{ useCount: 'desc' }, { shortcut: 'asc' }],
    })
  );
}

export async function createSnippet(ctx: ServiceContext, rawInput: unknown): Promise<SalesSnippet> {
  const input = CreateSnippetInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const clash = await tx.salesSnippet.findFirst({ where: { shortcut: input.shortcut } });
    if (clash) {
      throw new CrmConflictError(
        `"${input.shortcut}" is already in use by "${clash.name}".`,
        'shortcut'
      );
    }
    return tx.salesSnippet.create({
      data: {
        tenantId: ctx.tenantId,
        shortcut: input.shortcut,
        name: input.name,
        body: input.body,
        ownerUserId: ctx.userId ?? null,
        isShared: input.isShared ?? true,
      },
    });
  });
}

export async function updateSnippet(
  ctx: ServiceContext,
  snippetId: string,
  rawInput: unknown
): Promise<SalesSnippet> {
  const input = UpdateSnippetInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const before = await tx.salesSnippet.findUnique({ where: { id: snippetId } });
    if (!before) throw new CrmNotFoundError('SalesSnippet', snippetId);
    return tx.salesSnippet.update({
      where: { id: snippetId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.isShared !== undefined ? { isShared: input.isShared } : {}),
      },
    });
  });
}

export async function deleteSnippet(ctx: ServiceContext, snippetId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const before = await tx.salesSnippet.findUnique({ where: { id: snippetId } });
    if (!before) throw new CrmNotFoundError('SalesSnippet', snippetId);
    await tx.salesSnippet.delete({ where: { id: snippetId } });
  });
}

/** Count a use, so the picker can put the ones people reach for at the top. */
export async function noteSnippetUsed(ctx: ServiceContext, snippetId: string): Promise<void> {
  // updateMany, so a snippet deleted between insert and count does not throw —
  // the tally is telemetry, not the point of the interaction.
  await withTenant(ctx, (tx) =>
    tx.salesSnippet.updateMany({ where: { id: snippetId }, data: { useCount: { increment: 1 } } })
  );
}
