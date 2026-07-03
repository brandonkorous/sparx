// Read-only Builder MCP tools. Scope: 'read:builder'. No confirmation — an agent
// calls these freely to learn the styling vocabulary and inspect the page catalog.

import { z } from 'zod';

import * as pageService from '../services/page-service';
import { toPropertyContext } from './context';
import { BUILDER_STYLE_GUIDE } from './vocabulary';
import type { McpToolDefinition } from './registry';

const propertyIdArg = z
  .string()
  .uuid()
  .optional()
  .describe(
    'Target site (web property) id. Omit to target the tenant’s PRIMARY site. A tenant can have ' +
      'MULTIPLE sites — call list_sites first to get each site’s id, then pass it here to target ' +
      'that specific site.'
  );

export const describeBuilderStyling: McpToolDefinition = {
  name: 'describe_builder_styling',
  description:
    'The Builder authoring guide: the node model, the catalog of node types (containers, leaves, data-aware, chrome), ' +
    'the Tailwind-native class vocabulary (tokenized colors / type / shape / effects / spacing / layout / motion that compile ' +
    'to the tenant theme), the container-query responsive rules, the data-binding model, the safety allowlist, and worked ' +
    'examples. Call this BEFORE authoring a page so the classes you write resolve to the tenant theme and pass the allowlist.',
  scope: 'read:builder',
  confirmation: false,
  input: z.object({}),
  run: () => Promise.resolve(BUILDER_STYLE_GUIDE),
};

export const listBuilderPages: McpToolDefinition = {
  name: 'list_builder_pages',
  description:
    'List a site’s Builder pages (the page catalog): id, name, slug, kind (singleton | collection), recordType, position, ' +
    'and whether each is published. Trees are omitted — call get_builder_page for one. Seeds the curated starter set on first use.',
  scope: 'read:builder',
  confirmation: false,
  input: z.object({ propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const pctx = await toPropertyContext(ctx, (input as { propertyId?: string }).propertyId);
    const pages = await pageService.listOrSeed(pctx);
    // Strip the full draft tree from the list — keep it compact; get_builder_page returns it.
    return pages.map(({ tree: _tree, ...meta }) => meta);
  },
};

export const getBuilderPage: McpToolDefinition = {
  name: 'get_builder_page',
  description:
    'Fetch one Builder page by id, including its full DRAFT node tree (what the editor edits). Use list_builder_pages to find the id.',
  scope: 'read:builder',
  confirmation: false,
  input: z.object({ pageId: z.string().uuid(), propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const { pageId, propertyId } = input as { pageId: string; propertyId?: string };
    const pctx = await toPropertyContext(ctx, propertyId);
    return pageService.get(pctx, pageId);
  },
};

export const readTools = [describeBuilderStyling, listBuilderPages, getBuilderPage];
