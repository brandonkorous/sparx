// Write CMS MCP tools. Scope: 'write:cms', all confirmation-gated — the MCP
// server surfaces a destructiveHint so the client prompts the user before a
// mutation. Each is a thin wrapper over the @sparx/cms service layer (the same
// functions the REST routes drive), so validation, slug rules, revisions, and
// reference rebuild apply identically to an MCP call.
//
// Domain events: the service returns the events to fire; we emit them here with a
// console logger (the api-mcp service has no Fastify request). The webhook fan-out
// inside `publish` runs its own tenant-scoped tx, so an MCP-published entry
// notifies subscribers exactly like a dashboard publish.

import { z } from 'zod';
import { ContentTypeSchema } from '@sparx/cms-schemas';
import { publish } from '@sparx/api-core/pubsub';

import { createContentType, updateContentType } from '../content-types-service.js';
import { createEntry, updateEntry, publishEntry, unpublishEntry } from '../entries-service.js';
import type { CmsEmittedEvent } from '../service-support.js';

import type { CmsMcpCtx, McpToolDefinition } from './registry.js';

// `publish` wants a FastifyBaseLogger; the MCP service has none, so pass a
// console-backed logger (derived from publish's own signature — no fastify dep).
const mcpLogger = console as unknown as Parameters<typeof publish>[0];

async function emit(ctx: CmsMcpCtx, events: CmsEmittedEvent[]): Promise<void> {
  for (const ev of events) {
    await publish(mcpLogger, ev.type, ctx.tenantId, ctx.userId, ev.data);
  }
}

// ── Content types ────────────────────────────────────────────────────────────

export const createContentTypeTool: McpToolDefinition = {
  name: 'create_content_type',
  description:
    'Define a new content type: a reusable shape (its field schema) for a class of entries — e.g. a `doc` or `component` type for a documentation site. `urlPattern` makes its entries routable (each needs a slug).',
  scope: 'write:cms',
  confirmation: true,
  input: z.object({
    key: z
      .string()
      .min(1)
      .max(63)
      .regex(/^[a-z][a-z0-9_]*$/, 'lowercase letters, numbers, underscores'),
    name: z.string().min(1).max(120),
    pluralName: z.string().min(1).max(120),
    description: z.string().max(2048).optional(),
    icon: z.string().max(60).optional(),
    urlPattern: z.string().max(255).optional(),
    isSingleton: z.boolean().optional(),
    schema: ContentTypeSchema,
  }),
  run: async (ctx, input) => {
    const { contentType, events } = await createContentType(
      { tenantId: ctx.tenantId, actorId: ctx.userId },
      input as Parameters<typeof createContentType>[1]
    );
    await emit(ctx, events);
    return contentType;
  },
};

export const updateContentTypeTool: McpToolDefinition = {
  name: 'update_content_type',
  description:
    "Update a tenant-owned content type's metadata or field schema. Built-in platform types are read-only here (they fork through the dashboard schema editor).",
  scope: 'write:cms',
  confirmation: true,
  input: z.object({
    key: z.string().min(1).max(63),
    name: z.string().min(1).max(120).optional(),
    pluralName: z.string().min(1).max(120).optional(),
    description: z.string().max(2048).nullable().optional(),
    icon: z.string().max(60).nullable().optional(),
    urlPattern: z.string().max(255).nullable().optional(),
    isSingleton: z.boolean().optional(),
    schema: ContentTypeSchema.optional(),
  }),
  run: async (ctx, input) => {
    const { key, ...patch } = input as { key: string } & Parameters<typeof updateContentType>[2];
    const { contentType, events } = await updateContentType(
      { tenantId: ctx.tenantId, actorId: ctx.userId },
      key,
      patch
    );
    await emit(ctx, events);
    return contentType;
  },
};

// ── Entries ──────────────────────────────────────────────────────────────────

const EntryBody = z.object({
  typeKey: z.string().min(1).max(63),
  slug: z.string().min(1).max(255).optional(),
  status: z.enum(['draft', 'scheduled', 'published', 'archived']).optional(),
  body: z.record(z.string(), z.unknown()).optional(),
  seo: z.record(z.string(), z.unknown()).optional(),
  authorId: z.string().uuid().nullable().optional(),
  localeCode: z.string().max(10).nullable().optional(),
  propertyIds: z.array(z.string().uuid()).max(50).optional(),
});

export const createContentEntryTool: McpToolDefinition = {
  name: 'create_content_entry',
  description:
    "Create a content entry (draft by default) for a content type. The `body` must satisfy that type's field schema — call get_content_type first. `propertyIds` scopes the entry to specific sites (omit for all sites).",
  scope: 'write:cms',
  confirmation: true,
  input: EntryBody,
  run: async (ctx, input) => {
    const { entry, events } = await createEntry(
      { tenantId: ctx.tenantId, actorId: ctx.userId },
      input as Parameters<typeof createEntry>[1]
    );
    await emit(ctx, events);
    return entry;
  },
};

export const updateContentEntryTool: McpToolDefinition = {
  name: 'update_content_entry',
  description:
    "Update a content entry's body, SEO, slug, author, locale, or site scope. Only the fields you pass change; `body` is re-validated against the type schema.",
  scope: 'write:cms',
  confirmation: true,
  input: z.object({
    id: z.string().uuid(),
    slug: z.string().min(1).max(255).optional(),
    body: z.record(z.string(), z.unknown()).optional(),
    seo: z.record(z.string(), z.unknown()).optional(),
    authorId: z.string().uuid().nullable().optional(),
    localeCode: z.string().max(10).nullable().optional(),
    propertyIds: z.array(z.string().uuid()).max(50).optional(),
  }),
  run: async (ctx, input) => {
    const { id, ...patch } = input as { id: string } & Parameters<typeof updateEntry>[2];
    const { entry, events } = await updateEntry(
      { tenantId: ctx.tenantId, actorId: ctx.userId },
      id,
      patch
    );
    await emit(ctx, events);
    return entry;
  },
};

export const publishContentEntryTool: McpToolDefinition = {
  name: 'publish_content_entry',
  description:
    'Publish a content entry now, or schedule it by passing a future `scheduledAt` (ISO-8601). Records a revision and notifies subscribers.',
  scope: 'write:cms',
  confirmation: true,
  input: z.object({
    id: z.string().uuid(),
    scheduledAt: z.string().datetime({ offset: true }).optional(),
  }),
  run: async (ctx, input) => {
    const { id, scheduledAt } = input as { id: string; scheduledAt?: string };
    const { entry, events } = await publishEntry(
      { tenantId: ctx.tenantId, actorId: ctx.userId },
      id,
      { scheduledAt: scheduledAt ?? null },
      new Date()
    );
    await emit(ctx, events);
    return entry;
  },
};

export const unpublishContentEntryTool: McpToolDefinition = {
  name: 'unpublish_content_entry',
  description: 'Move a published or scheduled content entry back to draft.',
  scope: 'write:cms',
  confirmation: true,
  input: z.object({ id: z.string().uuid() }),
  run: async (ctx, input) => {
    const { id } = input as { id: string };
    const { entry, events } = await unpublishEntry(
      { tenantId: ctx.tenantId, actorId: ctx.userId },
      id
    );
    await emit(ctx, events);
    return entry;
  },
};

export const writeTools: McpToolDefinition[] = [
  createContentTypeTool,
  updateContentTypeTool,
  createContentEntryTool,
  updateContentEntryTool,
  publishContentEntryTool,
  unpublishContentEntryTool,
];
