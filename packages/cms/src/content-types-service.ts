// Content type service — the shared write + read path for content types
// (docs/12). The REST routes and the MCP tools both drive type create/update
// through these functions so the collision + fork rules live in one place. The
// specialized fork-on-edit schema authoring (PUT :key/schema) and delete stay in
// the REST route — they're not on the MCP surface, so there's no second path to
// keep in sync.

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
