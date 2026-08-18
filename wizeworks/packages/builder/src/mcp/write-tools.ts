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
import { PageFrameId, PageSeoShape, parsePageImport } from '@wizeworks/builder-schemas';

import * as pageService from '../services/page-service';
import { BuilderValidationError } from '../errors';
import { toPropertyContext, withSite } from './context';
import type { McpToolDefinition } from './registry';

const documentArg = z
  .union([z.string(), z.record(z.string(), z.unknown())])
  .describe(
    'A Builder page document — { format:"sparx.builder/v1", type:"page", name, kind, slug?, recordType?, ' +
      'seoTitle?, seoDescription?, canonical?, ogImage?, noindex?, tree } — OR a bare node tree. JSON string or inline ' +
      'object. Missing node ids are auto-filled. Include the optional SEO fields to set the page title/description the ' +
      'site renders (omit them on an update to leave existing SEO untouched). See describe_builder_styling. ' +
      'The tree MUST be responsive (mobile-first; layout adapts to width) — see the guide’s `responsive` section.'
  );

const propertyIdArg = z
  .string()
  .uuid()
  .optional()
  .describe(
    'Target site (web property) id. Omit to target the tenant’s PRIMARY site. A tenant can have ' +
      'MULTIPLE sites — call list_sites first to get each site’s id, then pass it here to target ' +
      'that specific site.'
  );

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
    return withSite(
      pctx,
      await pageService.create(pctx, {
        name: parsed.meta.name ?? name,
        kind: parsed.meta.kind,
        slug: parsed.meta.slug,
        recordType: parsed.meta.recordType,
        tree: parsed.tree,
        // SEO the envelope carried inline (undefined → stored as null by the service).
        seoTitle: parsed.meta.seoTitle,
        seoDescription: parsed.meta.seoDescription,
        canonical: parsed.meta.canonical,
        ogImage: parsed.meta.ogImage,
        noindex: parsed.meta.noindex,
      })
    );
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
    // SEO — only patch a field the envelope actually carried, so a tree-only
    // update never wipes an existing title/description (undefined = leave as-is).
    if (parsed.meta.seoTitle !== undefined) patch.seoTitle = parsed.meta.seoTitle;
    if (parsed.meta.seoDescription !== undefined) patch.seoDescription = parsed.meta.seoDescription;
    if (parsed.meta.canonical !== undefined) patch.canonical = parsed.meta.canonical;
    if (parsed.meta.ogImage !== undefined) patch.ogImage = parsed.meta.ogImage;
    if (parsed.meta.noindex !== undefined) patch.noindex = parsed.meta.noindex;
    return withSite(pctx, await pageService.update(pctx, pageId, patch));
  },
};

export const setPageSeo: McpToolDefinition = {
  name: 'set_page_seo',
  description:
    'Set a page’s SEO metadata — seoTitle / seoDescription / canonical / ogImage / noindex — WITHOUT resending its ' +
    'content tree. The shortcut for fixing a title or description: pass pageId plus the fields to change (no need to ' +
    'round-trip the whole page). Omit a field to leave it unchanged; pass an empty string to CLEAR it (the live site ' +
    'then falls back to the page name). Saves to DRAFT — call publish_builder_page to take it live.',
  scope: 'write:builder',
  confirmation: false,
  input: z.object({
    pageId: z.string().uuid(),
    ...PageSeoShape,
    propertyId: propertyIdArg,
  }),
  run: async (ctx, input) => {
    const { pageId, propertyId, ...seo } = input as {
      pageId: string;
      propertyId?: string;
    } & Record<string, unknown>;
    const pctx = await toPropertyContext(ctx, propertyId);
    // pageService.update patches ONLY the fields present — a tree-less SEO patch
    // never touches draftTree (page-service.ts sets draftTree only when tree is
    // supplied). UpdatePageInput's "at least one field" refine rejects an empty
    // patch (pageId alone) with a clear message.
    return withSite(pctx, await pageService.update(pctx, pageId, seo));
  },
};

export const setPageFrame: McpToolDefinition = {
  name: 'set_page_frame',
  description:
    'Choose which header and footer wrap ONE page. Three values, and the two that look empty mean opposite things: ' +
    'omit `frameId` (or pass null) to follow the SITE DEFAULT — the live layout, what almost every page should do; ' +
    'pass "none" for a page with NO header or footer at all — the campaign or landing page built to hold someone’s ' +
    'attention with nothing to click away to; or pass a layout id from list_builder_layouts to pin this page to that ' +
    'specific design even if the site default changes later. Saves to DRAFT — call publish_silica_site (or ' +
    'publish_builder_page) to take it live, exactly like the page body.',
  scope: 'write:builder',
  confirmation: false,
  input: z.object({
    pageId: z.string().uuid(),
    frameId: PageFrameId.nullish(),
    propertyId: propertyIdArg,
  }),
  run: async (ctx, input) => {
    const { pageId, frameId, propertyId } = input as {
      pageId: string;
      frameId?: string | null;
      propertyId?: string;
    };
    const pctx = await toPropertyContext(ctx, propertyId);
    // `null` explicitly — an OMITTED field would trip UpdatePageInput's "at least one
    // field" refine, and "back to the site default" has to be sayable. The service
    // treats null (reset) and undefined (leave alone) as different, which is the whole
    // tri-state; collapsing them here would make the default unreachable over MCP.
    return withSite(pctx, await pageService.update(pctx, pageId, { frameId: frameId ?? null }));
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
    return withSite(pctx, await pageService.publish(pctx, pageId));
  },
};

export const setPageRecordType: McpToolDefinition = {
  name: 'set_page_record_type',
  description:
    'Set a page’s recordType, turning it into a COLLECTION TEMPLATE that renders every record of that type (e.g. ' +
    '"commerce.product", "cms.blog_post") — WITHOUT resending its content tree. Applies equally to a silica-' +
    'materialized page (see describe_silica_authoring’s `metadata` section — a silica page id IS this row’s id). ' +
    'Saves to DRAFT.',
  scope: 'write:builder',
  confirmation: false,
  input: z.object({
    pageId: z.string().uuid(),
    recordType: z.string().min(1).max(63),
    propertyId: propertyIdArg,
  }),
  run: async (ctx, input) => {
    const { pageId, recordType, propertyId } = input as {
      pageId: string;
      recordType: string;
      propertyId?: string;
    };
    const pctx = await toPropertyContext(ctx, propertyId);
    return withSite(pctx, await pageService.update(pctx, pageId, { recordType }));
  },
};

export const setPageDefault: McpToolDefinition = {
  name: 'set_page_default',
  description:
    'Make a collection-template page the DEFAULT for its recordType — the template used when no per-record override ' +
    'exists (e.g. the default product-detail layout). The page must already have a recordType set (via ' +
    'set_page_record_type) and be a collection template. Saves to DRAFT.',
  scope: 'write:builder',
  confirmation: false,
  input: z.object({ pageId: z.string().uuid(), propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const { pageId, propertyId } = input as { pageId: string; propertyId?: string };
    const pctx = await toPropertyContext(ctx, propertyId);
    return withSite(pctx, await pageService.setDefault(pctx, pageId));
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
    return withSite(pctx, { deleted: pageId });
  },
};

export const writeTools = [
  createBuilderPage,
  updateBuilderPage,
  setPageSeo,
  setPageFrame,
  setPageRecordType,
  setPageDefault,
  publishBuilderPage,
  deleteBuilderPage,
];
