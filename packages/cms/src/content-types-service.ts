// Content type service — the shared write + read path for content types
// (docs/12). The REST routes and the MCP tools both drive type create/update/
// delete + the fork-on-edit schema authoring (PUT :key/schema) through these
// functions so the collision + fork + in-use rules live in one place.

import type { ContentType, Prisma, TxClient } from '@sparx/db';
import { withTenant } from '@sparx/db';
import type { ContentTypeSchema as ContentTypeSchemaT } from '@sparx/cms-schemas';
import { conflict, notFound } from '@sparx/api-core/errors';
import { serializeContentType, type WireContentType } from './content-types.js';
import type { CmsWriteContext, CmsEmittedEvent } from './service-support.js';

type Json = Prisma.InputJsonValue;

export interface CreateContentTypeInput {
  key: string;
  name: string;
  pluralName: string;
  description?: string | null;
  icon?: string | null;
  urlPattern?: string | null;
  isSingleton?: boolean;
  schema: ContentTypeSchemaT;
}

export interface UpdateContentTypeInput {
  name?: string;
  pluralName?: string;
  description?: string | null;
  icon?: string | null;
  urlPattern?: string | null;
  isSingleton?: boolean;
  schema?: ContentTypeSchemaT;
}

export interface ContentTypeWriteResult {
  contentType: ContentType;
  events: CmsEmittedEvent[];
}

// Read-path dedup: a tenant fork (is_built_in=false) shadows the platform
// built-in of the same key. Callers order built-ins last so the fork wins.
function dedupeByKey<T extends { key: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.key)) continue;
    seen.add(row.key);
    out.push(row);
  }
  return out;
}

// ── CREATE / UPDATE ──────────────────────────────────────────────────────────

export async function createContentTypeTx(
  tx: TxClient,
  ctx: CmsWriteContext,
  input: CreateContentTypeInput
): Promise<ContentTypeWriteResult> {
  // Collide against any row with the same key in the tenant scope OR a built-in
  // (RLS surfaces platform built-ins on read).
  const collision = await tx.contentType.findFirst({ where: { key: input.key } });
  if (collision) throw conflict(`A content type with key "${input.key}" already exists.`);

  const row = await tx.contentType.create({
    data: {
      tenantId: ctx.tenantId,
      key: input.key,
      name: input.name,
      pluralName: input.pluralName,
      description: input.description ?? null,
      icon: input.icon ?? null,
      urlPattern: input.urlPattern ?? null,
      isSingleton: input.isSingleton ?? false,
      isBuiltIn: false,
      schemaJson: input.schema,
    },
  });

  return {
    contentType: row,
    events: [{ type: 'content_type.upserted', data: { typeKey: row.key } }],
  };
}

export async function createContentType(
  ctx: CmsWriteContext,
  input: CreateContentTypeInput
): Promise<{ contentType: WireContentType; events: CmsEmittedEvent[] }> {
  const { contentType, events } = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    createContentTypeTx(tx, ctx, input)
  );
  return { contentType: serializeContentType(contentType), events };
}

export async function updateContentTypeTx(
  tx: TxClient,
  ctx: CmsWriteContext,
  key: string,
  input: UpdateContentTypeInput
): Promise<ContentTypeWriteResult> {
  // Only a tenant-owned (non-built-in) type is editable; a built-in is forked
  // through the dedicated schema-authoring route, never mutated here.
  const existing = await tx.contentType.findFirst({ where: { key, isBuiltIn: false } });
  if (!existing) throw notFound('Custom content type', key);

  const row = await tx.contentType.update({
    where: { id: existing.id },
    data: {
      name: input.name ?? existing.name,
      pluralName: input.pluralName ?? existing.pluralName,
      description: input.description === undefined ? existing.description : input.description,
      icon: input.icon === undefined ? existing.icon : input.icon,
      urlPattern: input.urlPattern === undefined ? existing.urlPattern : input.urlPattern,
      isSingleton: input.isSingleton ?? existing.isSingleton,
      schemaJson:
        input.schema === undefined
          ? (existing.schemaJson as Json)
          : (input.schema as unknown as Json),
    },
  });

  return {
    contentType: row,
    events: [{ type: 'content_type.upserted', data: { typeKey: row.key } }],
  };
}

export async function updateContentType(
  ctx: CmsWriteContext,
  key: string,
  input: UpdateContentTypeInput
): Promise<{ contentType: WireContentType; events: CmsEmittedEvent[] }> {
  const { contentType, events } = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    updateContentTypeTx(tx, ctx, key, input)
  );
  return { contentType: serializeContentType(contentType), events };
}

// ── SCHEMA AUTHORING (fork-on-edit) ──────────────────────────────────────────
// PUT :key/schema owns the field schema (docs/51). Editing a tenant-owned type
// updates schemaJson in place; editing a platform built-in FORKS it into a
// tenant-owned copy of the same key that shadows the built-in everywhere (reads
// dedupe by key, tenant copy wins). `forked` tells the caller which happened.

export interface ReplaceSchemaResult extends ContentTypeWriteResult {
  forked: boolean;
}

export async function replaceSchemaTx(
  tx: TxClient,
  ctx: CmsWriteContext,
  key: string,
  schema: ContentTypeSchemaT
): Promise<ReplaceSchemaResult> {
  // Resolve by key, tenant row preferred (isBuiltIn ASC → a fork wins over the
  // platform built-in of the same key).
  const existing = await tx.contentType.findFirst({
    where: { key },
    orderBy: [{ isBuiltIn: 'asc' }, { updatedAt: 'desc' }],
  });
  if (!existing) throw notFound('Content type', key);

  // Tenant already owns it (custom type or a prior fork) → update in place.
  if (!existing.isBuiltIn) {
    const row = await tx.contentType.update({
      where: { id: existing.id },
      data: { schemaJson: schema },
    });
    return {
      contentType: row,
      forked: false,
      events: [{ type: 'content_type.upserted', data: { typeKey: row.key } }],
    };
  }

  // Platform built-in → FORK into a tenant-owned copy. @@unique([tenantId, key])
  // lets (platform,key) + (tenant,key) coexist; the tenant can only fork into its
  // own scope.
  const row = await tx.contentType.create({
    data: {
      tenantId: ctx.tenantId,
      key: existing.key,
      name: existing.name,
      pluralName: existing.pluralName,
      description: existing.description,
      icon: existing.icon,
      urlPattern: existing.urlPattern,
      isSingleton: existing.isSingleton,
      isBuiltIn: false,
      schemaJson: schema,
    },
  });
  return {
    contentType: row,
    forked: true,
    events: [{ type: 'content_type.upserted', data: { typeKey: row.key } }],
  };
}

export async function replaceSchema(
  ctx: CmsWriteContext,
  key: string,
  schema: ContentTypeSchemaT
): Promise<{ contentType: WireContentType; forked: boolean; events: CmsEmittedEvent[] }> {
  const { contentType, forked, events } = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    replaceSchemaTx(tx, ctx, key, schema)
  );
  return { contentType: serializeContentType(contentType), forked, events };
}

// ── DELETE ──────────────────────────────────────────────────────────────────
// Only a tenant-owned (custom or forked) type is deletable, and only when no live
// entries still reference it — deleting out from under entries would orphan them.

export async function deleteContentTypeTx(
  tx: TxClient,
  _ctx: CmsWriteContext,
  key: string
): Promise<ContentTypeWriteResult> {
  const existing = await tx.contentType.findFirst({ where: { key, isBuiltIn: false } });
  if (!existing) throw notFound('Custom content type', key);

  const inUse = await tx.contentEntry.count({ where: { typeKey: key, deletedAt: null } });
  if (inUse > 0) {
    throw conflict(
      `Cannot delete "${key}" — ${inUse} entr${inUse === 1 ? 'y' : 'ies'} still use it. Archive the entries first.`
    );
  }

  await tx.contentType.delete({ where: { id: existing.id } });
  // The captured (pre-delete) row is returned so the route can audit its identity.
  return { contentType: existing, events: [] };
}

export async function deleteContentType(
  ctx: CmsWriteContext,
  key: string
): Promise<{ contentType: WireContentType; events: CmsEmittedEvent[] }> {
  const { contentType, events } = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    deleteContentTypeTx(tx, ctx, key)
  );
  return { contentType: serializeContentType(contentType), events };
}

// ── READS ──────────────────────────────────────────────────────────────────────

export async function listContentTypes(tenantId: string): Promise<WireContentType[]> {
  const rows = await withTenant({ tenantId }, (tx) =>
    tx.contentType.findMany({ orderBy: [{ isBuiltIn: 'asc' }, { key: 'asc' }] })
  );
  return dedupeByKey(rows).map(serializeContentType);
}

export async function getContentType(
  tenantId: string,
  key: string
): Promise<WireContentType | null> {
  const row = await withTenant({ tenantId }, (tx) =>
    tx.contentType.findFirst({
      where: { key },
      orderBy: [{ isBuiltIn: 'asc' }, { updatedAt: 'desc' }],
    })
  );
  return row ? serializeContentType(row) : null;
}
