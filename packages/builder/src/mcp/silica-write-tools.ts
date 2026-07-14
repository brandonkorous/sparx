// Write silica Builder MCP tools (docs/118). Authoring a page/frame/theme is a
// non-destructive DRAFT save; publish + delete + reset are confirmation-gated.
// Scope: 'write:builder'.
//
// Runs PARALLEL to the legacy write-tools.ts (create/update/delete/publish
// _builder_page, which write the sparx `tree`/`publishedTree` columns) — these
// write the silica `silica_*` columns via `siteService`'s single-item-safe
// wrappers (never `sync()` directly — see that file's header on why a
// single-item write must never be a whole-site payload).

import { z } from 'zod';
import {
  SilicaThemeInput,
  SilicaTreeInput,
  type SilicaNode,
  type SilicaTheme,
} from '@sparx/builder-schemas';

import * as siteService from '../services/site-service';
import { BuilderValidationError } from '../errors';
import { toPropertyContext, withSite } from './context';
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

/** Recursively count Outlet nodes in a tree — a frame must contain EXACTLY one
 *  (the routed page renders there). Structural, not a projection: no toHtml. */
function countOutlets(node: SilicaNode): number {
  if (node.kind === 'outlet') return 1;
  const children = node.children ?? [];
  return children.reduce(
    (sum, child) => sum + (typeof child === 'string' ? 0 : countOutlets(child)),
    0
  );
}

export const upsertSilicaPage: McpToolDefinition = {
  name: 'upsert_silica_page',
  description:
    'Create or replace one page’s content. `sections` are the page’s top-level children — never the outer page ' +
    'wrapper, never ids (the service stamps both). Omit `id` to CREATE a page (a fresh id is returned); pass an ' +
    'existing id to REPLACE that page’s content. A slugless page (empty `slug`) is the site home. Saves to DRAFT — ' +
    'call publish_silica_site to take it live. See describe_silica_authoring for composing `sections` from real ' +
    'blocks/composites, and set_page_seo / set_page_record_type / set_page_default for metadata this tool does NOT ' +
    'carry.',
  scope: 'write:builder',
  confirmation: false,
  input: z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(255),
    slug: z.string().max(255),
    sections: z.array(SilicaTreeInput).min(1),
    propertyId: propertyIdArg,
  }),
  run: async (ctx, input) => {
    const { id, name, slug, sections, propertyId } = input as {
      id?: string;
      name: string;
      slug: string;
      sections: SilicaNode[];
      propertyId?: string;
    };
    const pctx = await toPropertyContext(ctx, propertyId);
    const result = await siteService.upsertPage(pctx, { id, name, slug, sections });
    return withSite(pctx, result);
  },
};

export const deleteSilicaPage: McpToolDefinition = {
  name: 'delete_silica_page',
  description:
    'Delete one silica page permanently. Refused if it is the site’s only page (a site needs at least one) — ' +
    'replace its content with upsert_silica_page instead. Confirmation-gated.',
  scope: 'write:builder',
  confirmation: true,
  input: z.object({ pageId: z.string().uuid(), propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const { pageId, propertyId } = input as { pageId: string; propertyId?: string };
    const pctx = await toPropertyContext(ctx, propertyId);
    await siteService.removePage(pctx, pageId);
    return withSite(pctx, { deleted: pageId });
  },
};

export const setSilicaFrame: McpToolDefinition = {
  name: 'set_silica_frame',
  description:
    'Replace the site’s FRAME (chrome) — the shared navbar/Outlet/footer every page renders through. `root` must ' +
    'contain EXACTLY ONE Outlet node (marks where the routed page renders). Requires the site to already have at ' +
    'least one page (author the home page first via upsert_silica_page). Saves to DRAFT.',
  scope: 'write:builder',
  confirmation: false,
  input: z.object({ root: SilicaTreeInput, propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const { root, propertyId } = input as { root: SilicaNode; propertyId?: string };
    const outlets = countOutlets(root);
    if (outlets !== 1) {
      throw new BuilderValidationError(
        `A frame must contain exactly one Outlet node (found ${outlets}) — it marks where the routed page renders ` +
          'between your header and footer.'
      );
    }
    const pctx = await toPropertyContext(ctx, propertyId);
    await siteService.setFrame(pctx, { root });
    return withSite(pctx, { ok: true });
  },
};

export const setSilicaTheme: McpToolDefinition = {
  name: 'set_silica_theme',
  description:
    'Replace the site’s authored THEME. This REPLACES the whole theme object — pass every token to keep, not just ' +
    'the ones changing. Optionally replace the saved-theme library too (`savedThemes`; pass `[]` to clear it, omit ' +
    'to leave it as-is). Requires the site to already have at least one page. Saves to DRAFT.',
  scope: 'write:builder',
  confirmation: false,
  input: z.object({
    theme: SilicaThemeInput,
    savedThemes: z.array(SilicaThemeInput).optional(),
    propertyId: propertyIdArg,
  }),
  run: async (ctx, input) => {
    const { theme, savedThemes, propertyId } = input as {
      theme: SilicaTheme;
      savedThemes?: SilicaTheme[];
      propertyId?: string;
    };
    const pctx = await toPropertyContext(ctx, propertyId);
    await siteService.setTheme(pctx, { theme, savedThemes });
    return withSite(pctx, { ok: true });
  },
};

export const publishSilicaSite: McpToolDefinition = {
  name: 'publish_silica_site',
  description:
    'Publish the whole site live — snapshots every DRAFT (pages, frame, theme, symbols) to its published ' +
    'counterpart in one call. Confirmation-gated.',
  scope: 'write:builder',
  confirmation: true,
  input: z.object({ propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const pctx = await toPropertyContext(ctx, (input as { propertyId?: string }).propertyId);
    await siteService.publish(pctx);
    return withSite(pctx, { published: true });
  },
};

export const resetSilicaSite: McpToolDefinition = {
  name: 'reset_silica_site',
  description:
    'Discard ALL silica-materialized pages, the frame, and saved symbols, so the editor reopens on the current ' +
    'starter seed. The authored THEME survives a reset. DESTRUCTIVE — confirmation-gated. Use this to clear out ' +
    'stale/throwaway content before a fresh authoring pass.',
  scope: 'write:builder',
  confirmation: true,
  input: z.object({ propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const pctx = await toPropertyContext(ctx, (input as { propertyId?: string }).propertyId);
    await siteService.reset(pctx);
    return withSite(pctx, { reset: true });
  },
};

export const silicaWriteTools = [
  upsertSilicaPage,
  deleteSilicaPage,
  setSilicaFrame,
  setSilicaTheme,
  publishSilicaSite,
  resetSilicaSite,
];
