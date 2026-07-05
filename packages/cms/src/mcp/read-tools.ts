// Read-only CMS MCP tools. Scope: 'read:cms'. No confirmation — the agent may
// call these freely to discover content types and inspect entries before
// proposing a change. Thin wrappers over the @sparx/cms read service.

import { z } from 'zod';
import { notFound } from '@sparx/api-core/errors';

import { listContentTypes, getContentType } from '../content-types-service.js';
import { listEntries, getEntry } from '../entries-service.js';

import type { McpToolDefinition } from './registry.js';

export const listContentTypesTool: McpToolDefinition = {
  name: 'list_content_types',
  description:
    "List the tenant's content types (blog post, doc, component, …) with their key, name, and whether they are routable. Call this first to find the `typeKey` and to learn what content shapes exist before creating an entry.",
  scope: 'read:cms',
  confirmation: false,
  input: z.object({}),
  run: (ctx) => listContentTypes(ctx.tenantId),
};

export const getContentTypeTool: McpToolDefinition = {
  name: 'get_content_type',
  description:
    'Fetch one content type by key, including its full field schema (the fields an entry `body` must provide). Use this to learn the exact body shape before create_content_entry / update_content_entry.',
  scope: 'read:cms',
  confirmation: false,
  input: z.object({ key: z.string().min(1).max(63) }),
  run: async (ctx, input) => {
    const { key } = input as { key: string };
    const type = await getContentType(ctx.tenantId, key);
    if (!type) throw notFound('Content type', key);
    return type;
  },
};

export const listContentEntriesTool: McpToolDefinition = {
  name: 'list_content_entries',
  description:
    'List content entries, filtered by type, status, slug, author, locale, or a title/slug search. Returns a page of entries plus the total count.',
  scope: 'read:cms',
  confirmation: false,
  input: z.object({
    typeKey: z.string().max(63).optional(),
    status: z.enum(['draft', 'scheduled', 'published', 'archived']).optional(),
    slug: z.string().max(255).optional(),
    q: z.string().max(255).optional(),
    authorId: z.string().uuid().optional(),
    localeCode: z.string().max(10).optional(),
    take: z.number().int().min(1).max(250).optional(),
    skip: z.number().int().min(0).optional(),
  }),
  run: (ctx, input) => listEntries(ctx.tenantId, input as Parameters<typeof listEntries>[1]),
};

export const getContentEntryTool: McpToolDefinition = {
  name: 'get_content_entry',
  description:
    'Fetch one content entry by id — its full body, SEO, status, and the sites it is scoped to. Use before update_content_entry / publish_content_entry.',
  scope: 'read:cms',
  confirmation: false,
  input: z.object({ id: z.string().uuid() }),
  run: async (ctx, input) => {
    const { id } = input as { id: string };
    const entry = await getEntry(ctx.tenantId, id);
    if (!entry) throw notFound('Entry', id);
    return entry;
  },
};

export const readTools: McpToolDefinition[] = [
  listContentTypesTool,
  getContentTypeTool,
  listContentEntriesTool,
  getContentEntryTool,
];
