// Write Builder MCP tools (the docs/61 node-tree page builder). Authoring a page
// is a non-destructive DRAFT save; publish + delete are confirmation-gated. Scope:
// 'write:builder'.
//
// An agent authors with a "document": the portable page envelope OR a bare node
// tree (JSON string or inline object). `parsePageImport` validates it, auto-fills
// missing node ids, dedupes ids, and pulls page meta from the envelope — the same
// validation the editor's Import and the REST transport use (one parser, every
// transport). Classes are validated downstream by the per-tenant compile allowlist
// at publish; describe_builder_styling teaches the safe vocabulary up front.

import { z } from 'zod';
import { parsePageImport } from '@sparx/builder-schemas';

import * as pageService from '../services/page-service';
import { BuilderValidationError } from '../errors';
import { toPropertyContext } from './context';
import type { McpToolDefinition } from './registry';

const documentArg = z
  .union([z.string(), z.record(z.string(), z.unknown())])
  .describe(
    'A Builder page document — { format:"sparx.builder/v1", type:"page", name, kind, slug?, recordType?, tree } — ' +
      'OR a bare node tree. JSON string or inline object. Missing node ids are auto-filled. See describe_builder_styling. ' +
      'The tree MUST be responsive (mobile-first; layout adapts to width) — see the guide’s `responsive` section.'
  );

const propertyIdArg = z
  .string()
  .uuid()
  .optional()
  .describe('Target site (web property) id; omit for the tenant’s primary site.');

export const createBuilderPage: McpToolDefinition = {
  name: 'create_builder_page',
  description:
    'Create a new Builder page from a document (or bare node tree). Lands as a DRAFT — call publish_builder_page to take it ' +
    'live. A full document carries its own name/kind/slug; pass `name` when you supply only a bare tree.',
  scope: 'write:builder',
  confirmation: false,
  input: z.object({
    document: documentArg,
    name: z
      .string()
      .min(1)
      .max(255)
      .optional()
      .describe('Page name — used when `document` is a bare tree.'),
    propertyId: propertyIdArg,
  }),
  run: async (ctx, input) => {
    const { document, name, propertyId } = input as {
      document: unknown;
      name?: string;
      propertyId?: string;
    };
    const parsed = parsePageImport(document);
    if (!parsed.ok) throw new BuilderValidationError(parsed.error);
    const pctx = await toPropertyContext(ctx, propertyId);
    return pageService.create(pctx, {
      name: parsed.meta.name ?? name,
      kind: parsed.meta.kind,
      slug: parsed.meta.slug,
      recordType: parsed.meta.recordType,
      tree: parsed.tree,
    });
  },
};

export const updateBuilderPage: McpToolDefinition = {
  name: 'update_builder_page',
  description:
    'Replace a Builder page’s draft tree (and its name / slug / recordType when the document envelope carries them). Saves to ' +
    'DRAFT — call publish_builder_page to take the change live.',
  scope: 'write:builder',
  confirmation: false,
  input: z.object({
    pageId: z.string().uuid(),
    document: documentArg,
    propertyId: propertyIdArg,
  }),
  run: async (ctx, input) => {
    const { pageId, document, propertyId } = input as {
      pageId: string;
      document: unknown;
      propertyId?: string;
    };
    const parsed = parsePageImport(document);
    if (!parsed.ok) throw new BuilderValidationError(parsed.error);
    const pctx = await toPropertyContext(ctx, propertyId);
    const patch: Record<string, unknown> = { tree: parsed.tree };
    if (parsed.meta.name !== undefined) patch.name = parsed.meta.name;
    if (parsed.meta.slug !== undefined) patch.slug = parsed.meta.slug;
    if (parsed.meta.recordType !== undefined) patch.recordType = parsed.meta.recordType;
    return pageService.update(pctx, pageId, patch);
  },
};

export const publishBuilderPage: McpToolDefinition = {
  name: 'publish_builder_page',
  description:
    'Publish a Builder page live to the site — snapshots the draft tree (expanding any tenant components to primitives). ' +
    'Confirmation-gated.',
  scope: 'write:builder',
  confirmation: true,
  input: z.object({ pageId: z.string().uuid(), propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const { pageId, propertyId } = input as { pageId: string; propertyId?: string };
    const pctx = await toPropertyContext(ctx, propertyId);
    return pageService.publish(pctx, pageId);
  },
};

export const deleteBuilderPage: McpToolDefinition = {
  name: 'delete_builder_page',
  description: 'Delete a Builder page permanently. Confirmation-gated.',
  scope: 'write:builder',
  confirmation: true,
  input: z.object({ pageId: z.string().uuid(), propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const { pageId, propertyId } = input as { pageId: string; propertyId?: string };
    const pctx = await toPropertyContext(ctx, propertyId);
    await pageService.remove(pctx, pageId);
    return { deleted: pageId };
  },
};

export const writeTools = [
  createBuilderPage,
  updateBuilderPage,
  publishBuilderPage,
  deleteBuilderPage,
];
