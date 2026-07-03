// Builder site-LAYOUT MCP tools (docs/45) — the chrome shell (header · Outlet ·
// footer) every page renders inside. Same document + draft/publish model as pages:
// author a layout tree, save a DRAFT, publish it, and (for a multi-layout catalog)
// flip which published layout is live. Scope: read:builder / write:builder.
//
// A tenant always has at least one layout: the read tools seed the starter shell
// on first use, so an agent fetches the live chrome, edits it, and publishes —
// never starting from a blank canvas that would drop the site's header/footer.
// The page tools (create_builder_page …) author the BODY; these author the CHROME.

import { z } from 'zod';
import { parseLayoutImport } from '@sparx/builder-schemas';

import * as layoutService from '../services/layout-service';
import { BuilderValidationError } from '../errors';
import { toPropertyContext, withSite } from './context';
import type { McpToolDefinition } from './registry';

const propertyIdArg = z
  .string()
  .uuid()
  .optional()
  .describe(
    'Target site (web property) id. Omit to target the tenant’s PRIMARY site. A tenant can have ' +
      'MULTIPLE sites — call list_sites first to get each site’s id, then pass it here to target that specific site.'
  );

const layoutDocumentArg = z
  .union([z.string(), z.record(z.string(), z.unknown())])
  .describe(
    'A Builder LAYOUT document — { format:"sparx.builder/v1", type:"layout", name, tree } — OR a bare node tree. JSON ' +
      'string or inline object. The tree is the chrome shell and MUST contain exactly one Outlet node (where each page ' +
      'renders) plus your header/footer (Wordmark/Logo, NavMenu with props.links, SocialLinks). Missing node ids are ' +
      'auto-filled. It MUST be responsive — see describe_builder_styling `responsive.headerFooter`.'
  );

// ── Reads ────────────────────────────────────────────────────────────────────

export const listBuilderLayouts: McpToolDefinition = {
  name: 'list_builder_layouts',
  description:
    'List a site’s Builder layouts (the chrome catalog): id, name, isActive (the one live layout), whether each is ' +
    'published, and position. Trees are omitted — call get_builder_layout for one. Seeds the starter shell on first use.',
  scope: 'read:builder',
  confirmation: false,
  input: z.object({ propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const pctx = await toPropertyContext(ctx, (input as { propertyId?: string }).propertyId);
    const layouts = await layoutService.listOrSeed(pctx);
    // Strip the full draft tree — keep the catalog compact; get_builder_layout returns it.
    return layouts.map(({ tree: _tree, ...meta }) => meta);
  },
};

export const getBuilderLayout: McpToolDefinition = {
  name: 'get_builder_layout',
  description:
    'Fetch one Builder layout including its full DRAFT chrome tree. Pass `layoutId` for a specific one; omit it to get ' +
    'the site’s ACTIVE (live) layout — the usual starting point for editing the header/footer. Seeds the starter shell ' +
    'if the site has none.',
  scope: 'read:builder',
  confirmation: false,
  input: z.object({ layoutId: z.string().uuid().optional(), propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const { layoutId, propertyId } = input as { layoutId?: string; propertyId?: string };
    const pctx = await toPropertyContext(ctx, propertyId);
    if (layoutId) return layoutService.get(pctx, layoutId);
    const layouts = await layoutService.listOrSeed(pctx);
    return layouts.find((l) => l.isActive) ?? layouts[0] ?? null;
  },
};

// ── Writes ───────────────────────────────────────────────────────────────────

export const createBuilderLayout: McpToolDefinition = {
  name: 'create_builder_layout',
  description:
    'Create a new Builder layout from a document (or bare chrome tree). Lands as a DRAFT and is NOT live until you ' +
    'publish_builder_layout then set_active_layout. To simply change the current header/footer, edit the ACTIVE layout ' +
    'with update_builder_layout instead of creating a new one.',
  scope: 'write:builder',
  confirmation: false,
  input: z.object({
    document: layoutDocumentArg,
    name: z
      .string()
      .min(1)
      .max(255)
      .optional()
      .describe('Layout name — used when `document` is a bare tree.'),
    propertyId: propertyIdArg,
  }),
  run: async (ctx, input) => {
    const { document, name, propertyId } = input as {
      document: unknown;
      name?: string;
      propertyId?: string;
    };
    const parsed = parseLayoutImport(document);
    if (!parsed.ok) throw new BuilderValidationError(parsed.error);
    const pctx = await toPropertyContext(ctx, propertyId);
    return withSite(
      pctx,
      await layoutService.create(pctx, {
        name: parsed.meta.name ?? name ?? 'Layout',
        tree: parsed.tree,
      })
    );
  },
};

export const updateBuilderLayout: McpToolDefinition = {
  name: 'update_builder_layout',
  description:
    'Replace a Builder layout’s draft chrome tree (and its name when the document carries one). Saves to DRAFT — call ' +
    'publish_builder_layout to take the change live. Get the active layout’s id + tree from get_builder_layout first.',
  scope: 'write:builder',
  confirmation: false,
  input: z.object({
    layoutId: z.string().uuid(),
    document: layoutDocumentArg,
    propertyId: propertyIdArg,
  }),
  run: async (ctx, input) => {
    const { layoutId, document, propertyId } = input as {
      layoutId: string;
      document: unknown;
      propertyId?: string;
    };
    const parsed = parseLayoutImport(document);
    if (!parsed.ok) throw new BuilderValidationError(parsed.error);
    const pctx = await toPropertyContext(ctx, propertyId);
    const patch: Record<string, unknown> = { tree: parsed.tree };
    if (parsed.meta.name !== undefined) patch.name = parsed.meta.name;
    return withSite(pctx, await layoutService.update(pctx, layoutId, patch));
  },
};

export const publishBuilderLayout: McpToolDefinition = {
  name: 'publish_builder_layout',
  description:
    'Publish a Builder layout — snapshots its draft chrome tree so the storefront serves it. If this layout is already ' +
    'the active one, the new chrome goes live immediately; otherwise publish then set_active_layout. Confirmation-gated.',
  scope: 'write:builder',
  confirmation: true,
  input: z.object({ layoutId: z.string().uuid(), propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const { layoutId, propertyId } = input as { layoutId: string; propertyId?: string };
    const pctx = await toPropertyContext(ctx, propertyId);
    return withSite(pctx, await layoutService.publish(pctx, layoutId));
  },
};

export const setActiveLayout: McpToolDefinition = {
  name: 'set_active_layout',
  description:
    'Make a PUBLISHED layout the site’s live chrome (at most one is active per site). Publish it first — activating an ' +
    'unpublished layout is refused. Confirmation-gated.',
  scope: 'write:builder',
  confirmation: true,
  input: z.object({ layoutId: z.string().uuid(), propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const { layoutId, propertyId } = input as { layoutId: string; propertyId?: string };
    const pctx = await toPropertyContext(ctx, propertyId);
    return withSite(pctx, await layoutService.setActive(pctx, layoutId));
  },
};

export const deleteBuilderLayout: McpToolDefinition = {
  name: 'delete_builder_layout',
  description:
    'Delete a Builder layout permanently. Refused for the live (active) layout — make another active first. ' +
    'Confirmation-gated.',
  scope: 'write:builder',
  confirmation: true,
  input: z.object({ layoutId: z.string().uuid(), propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const { layoutId, propertyId } = input as { layoutId: string; propertyId?: string };
    const pctx = await toPropertyContext(ctx, propertyId);
    await layoutService.remove(pctx, layoutId);
    return withSite(pctx, { deleted: layoutId });
  },
};

export const layoutReadTools = [listBuilderLayouts, getBuilderLayout];
export const layoutWriteTools = [
  createBuilderLayout,
  updateBuilderLayout,
  publishBuilderLayout,
  setActiveLayout,
  deleteBuilderLayout,
];
