// emailService — the Email Builder catalog and draft/publish lifecycle (docs/52).
//
// One row per email (BuilderEmail); the editor edits the DRAFT tree, publishing
// snapshots it. An email is ONE self-contained body tree — no site/page split,
// no Outlet, no layout tier. Two document fields the page model lacks: `subject`
// and `preheader`. Trees are validated against @sparx/builder-schemas on every
// write so every transport stores the same shape. Tenant-scoped via withTenant()
// — a callsite that forgets it sees nothing (FORCE RLS).
//
// One service, many transports: REST mounts these today; MCP + Server Actions
// reuse them unchanged. Mirrors pageService (docs/41).

import {
  CreateEmailInput,
  ReorderEmailsInput,
  STARTER_EMAILS,
  UpdateEmailInput,
  blankEmailTree,
  type BuilderEmailDto,
  type BuilderNode,
  type PublishedEmailDto,
} from '@sparx/builder-schemas';
import type { BuilderEmail, Prisma } from '@sparx/db';
import { withTenant } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishBuilderEvent } from '../events';
import type { ServiceContext } from '../errors';
import { BuilderNotFoundError } from '../errors';

function toDto(row: BuilderEmail): BuilderEmailDto {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    preheader: row.preheader,
    // Stored validated on write; the editor depends on a well-formed tree.
    tree: row.draftTree as unknown as BuilderNode,
    published: row.publishedTree != null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const asJson = (tree: BuilderNode): Prisma.InputJsonValue =>
  tree as unknown as Prisma.InputJsonValue;

// Preheader stores null (not '') when blank, so a cleared field is genuinely
// absent rather than an empty preview line.
const emptyToNull = (v: string | null | undefined): string | null =>
  v != null && v.length > 0 ? v : null;

/** List the tenant's emails. On first use (zero rows) seed the curated starter
 *  set — the lazy-materialization idiom (cf. pageService.listOrSeed). Idempotent:
 *  only seeds when empty. */
export function listOrSeed(ctx: ServiceContext): Promise<BuilderEmailDto[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderEmail.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    if (rows.length > 0) return rows.map(toDto);

    await tx.builderEmail.createMany({
      data: STARTER_EMAILS.map((s, i) => ({
        tenantId: ctx.tenantId,
        name: s.name,
        subject: s.subject,
        preheader: s.preheader ?? null,
        draftTree: asJson(s.tree),
        position: i,
      })),
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.emails.seeded',
      entityType: 'BuilderEmail',
      entityId: null,
      diff: { after: { count: STARTER_EMAILS.length } },
    });
    const seeded = await tx.builderEmail.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return seeded.map(toDto);
  });
}

export function get(ctx: ServiceContext, id: string): Promise<BuilderEmailDto> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderEmail.findUnique({ where: { id } });
    if (!row) throw new BuilderNotFoundError('BuilderEmail', id);
    return toDto(row);
  });
}

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<BuilderEmailDto> {
  const input = CreateEmailInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const last = await tx.builderEmail.findFirst({
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = last ? last.position + 1 : 0;
    const created = await tx.builderEmail.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        subject: input.subject ?? '',
        preheader: emptyToNull(input.preheader),
        draftTree: asJson(input.tree ?? blankEmailTree()),
        position,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.email.created',
      entityType: 'BuilderEmail',
      entityId: created.id,
      diff: { before: null, after: { name: created.name } },
    });
    return toDto(created);
  });
}

/** Rename, set subject/preheader, and/or save the draft tree. Draft-tree saves
 *  are the high-frequency autosave path — deliberately NOT audited. */
export async function update(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<BuilderEmailDto> {
  const input = UpdateEmailInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const existing = await tx.builderEmail.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new BuilderNotFoundError('BuilderEmail', id);

    const data: Prisma.BuilderEmailUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.subject !== undefined) data.subject = input.subject;
    if (input.preheader !== undefined) data.preheader = emptyToNull(input.preheader);
    if (input.tree !== undefined) data.draftTree = asJson(input.tree);

    const updated = await tx.builderEmail.update({ where: { id }, data });
    return toDto(updated);
  });
}

export async function remove(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.builderEmail.findUnique({ where: { id } });
    if (!existing) throw new BuilderNotFoundError('BuilderEmail', id);
    await tx.builderEmail.delete({ where: { id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.email.deleted',
      entityType: 'BuilderEmail',
      entityId: id,
      diff: { before: { name: existing.name }, after: null },
    });
  });
}

/** Reorder the catalog. `orderedIds` must be exactly the tenant's email ids. */
export async function reorder(ctx: ServiceContext, rawInput: unknown): Promise<BuilderEmailDto[]> {
  const input = ReorderEmailsInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const owned = await tx.builderEmail.findMany({
      where: { id: { in: input.orderedIds } },
      select: { id: true },
    });
    if (owned.length !== input.orderedIds.length) {
      throw new BuilderNotFoundError('BuilderEmail', 'one or more emails');
    }
    for (let i = 0; i < input.orderedIds.length; i += 1) {
      await tx.builderEmail.update({ where: { id: input.orderedIds[i] }, data: { position: i } });
    }
    const rows = await tx.builderEmail.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toDto);
  });
}

/** Snapshot the draft tree into the published tree. A broadcast/authored template
 *  that references this email renders its published snapshot (docs/52 §6). Emits
 *  builder.email.published. */
export async function publish(ctx: ServiceContext, id: string): Promise<BuilderEmailDto> {
  const dto = await withTenant(ctx, async (tx) => {
    const existing = await tx.builderEmail.findUnique({ where: { id } });
    if (!existing) throw new BuilderNotFoundError('BuilderEmail', id);
    const updated = await tx.builderEmail.update({
      where: { id },
      data: {
        publishedTree: existing.draftTree as Prisma.InputJsonValue,
        publishedAt: new Date(),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.email.published',
      entityType: 'BuilderEmail',
      entityId: id,
      diff: { after: { name: updated.name } },
    });
    return toDto(updated);
  });
  await publishBuilderEvent({
    tenantId: ctx.tenantId,
    topic: 'builder.email.published',
    payload: { emailId: dto.id, name: dto.name },
  });
  return dto;
}

/** The send/preview read (docs/52 §6): the PUBLISHED tree of an email by id, or
 *  null when it hasn't been published. Used by the broadcast render path. The
 *  DRAFT counterpart (for the editor's live preview) is `getDraftById`. */
export function getPublishedById(
  ctx: ServiceContext,
  id: string
): Promise<PublishedEmailDto | null> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderEmail.findUnique({ where: { id } });
    if (row?.publishedTree == null) return null;
    return {
      name: row.name,
      subject: row.subject,
      preheader: row.preheader,
      tree: row.publishedTree as unknown as BuilderNode,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  });
}

/** The DRAFT read for the editor's true-HTML preview (docs/52 §9 Phase 2): the
 *  email's unsaved DRAFT tree by id, or null when it doesn't exist. Mirrors
 *  getPublishedById with no published gate. */
export function getDraftById(ctx: ServiceContext, id: string): Promise<PublishedEmailDto | null> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderEmail.findUnique({ where: { id } });
    if (!row) return null;
    return {
      name: row.name,
      subject: row.subject,
      preheader: row.preheader,
      tree: row.draftTree as unknown as BuilderNode,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  });
}
