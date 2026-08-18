// Read-only silica Builder MCP tools (docs/118). Scope: 'read:builder'. No
// confirmation — an agent calls these freely to learn the authoring vocabulary,
// browse the block/composite catalog, and inspect the current site.
//
// Runs PARALLEL to the legacy read-tools.ts (list_builder_pages/get_builder_page,
// which read the sparx `tree`/`publishedTree` columns) — these read the silica
// `silica_*` columns via `siteService`.

import { z } from 'zod';

import * as pageService from '../services/page-service';
import * as siteService from '../services/site-service';
import { BuilderNotFoundError } from '../errors';
import { toPropertyContext, withSite } from './context';
import { getSilicaCatalogEntry, listSilicaCatalog } from './silica-blocks';
import { SILICA_STYLE_GUIDE } from './silica-vocabulary';
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

export const describeSilicaAuthoring: McpToolDefinition = {
  name: 'describe_silica_authoring',
  description:
    'The silica authoring guide: the Site/Page/Frame/Theme model, the authoring-kit primitives, native blocks vs ' +
    'sparx domain composites and when to use each, the data-binding model, the theme token model, and the SEO/' +
    'recordType metadata side-channel. Call this BEFORE authoring so pages compose from real, pre-built material ' +
    'instead of freehand markup.',
  scope: 'read:builder',
  confirmation: false,
  input: z.object({}),
  run: () => Promise.resolve(SILICA_STYLE_GUIDE),
};

export const listSilicaBlocks: McpToolDefinition = {
  name: 'list_silica_blocks',
  description:
    'List available silica blocks (native marketing/content patterns) and sparx composites (commerce/content ' +
    'patterns), the MCP equivalent of the Insert palette. Trees are omitted for compactness — call get_silica_block ' +
    'for one entry’s full tree. Optionally filter by `category`.',
  scope: 'read:builder',
  confirmation: false,
  input: z.object({ category: z.string().optional() }),
  run: (_ctx, input) =>
    Promise.resolve(listSilicaCatalog(input as { category?: string } | undefined)),
};

export const getSilicaBlock: McpToolDefinition = {
  name: 'get_silica_block',
  description:
    'Fetch one block/composite’s full, id-free Node tree by its key (from list_silica_blocks). Edit its text/props/' +
    'hrefs in place, then pass it (or its children, for a container block) into upsert_silica_page’s `sections` — ' +
    'this is the reliable way to compose a page instead of inventing markup from scratch.',
  scope: 'read:builder',
  confirmation: false,
  input: z.object({ key: z.string() }),
  run: (_ctx, input) => {
    const { key } = input as { key: string };
    const node = getSilicaCatalogEntry(key);
    if (!node) throw new BuilderNotFoundError('SilicaBlock', key);
    return Promise.resolve(node);
  },
};

export const getSilicaSite: McpToolDefinition = {
  name: 'get_silica_site',
  description:
    'Fetch the whole DRAFT silica site — pages (id/name/slug/root) + frame + theme + symbols. An empty `pages` array ' +
    'means nothing has been authored yet (start with upsert_silica_page for the home page).',
  scope: 'read:builder',
  confirmation: false,
  input: z.object({ propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const pctx = await toPropertyContext(ctx, (input as { propertyId?: string }).propertyId);
    return withSite(pctx, (await siteService.load(pctx)) ?? { pages: [] });
  },
};

export const listSilicaPages: McpToolDefinition = {
  name: 'list_silica_pages',
  description:
    'List the site’s silica-authored pages: id, name, slug, plus the SEO/recordType/isDefault/published metadata ' +
    'that lives on the page’s row side-channel (see describe_silica_authoring’s `metadata` section). Trees are ' +
    'omitted — call get_silica_page for one.',
  scope: 'read:builder',
  confirmation: false,
  input: z.object({ propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const pctx = await toPropertyContext(ctx, (input as { propertyId?: string }).propertyId);
    const site = await siteService.load(pctx);
    if (!site) return withSite(pctx, { pages: [] });
    const rows = await pageService.listOrSeed(pctx);
    const byId = new Map(rows.map((r) => [r.id, r] as const));
    const pages = site.pages.map((p) => {
      const row = byId.get(p.id);
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        recordType: row?.recordType ?? null,
        isDefault: row?.isDefault ?? false,
        published: row?.published ?? false,
        seoTitle: row?.seoTitle ?? null,
      };
    });
    return withSite(pctx, { pages });
  },
};

export const getSilicaPage: McpToolDefinition = {
  name: 'get_silica_page',
  description:
    'Fetch one silica page’s full DRAFT tree by id (from list_silica_pages), plus its SEO/recordType/isDefault/' +
    'published metadata.',
  scope: 'read:builder',
  confirmation: false,
  input: z.object({ pageId: z.string().uuid(), propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const { pageId, propertyId } = input as { pageId: string; propertyId?: string };
    const pctx = await toPropertyContext(ctx, propertyId);
    const [site, row] = await Promise.all([siteService.load(pctx), pageService.get(pctx, pageId)]);
    const page = site?.pages.find((p) => p.id === pageId);
    if (!page) throw new BuilderNotFoundError('SilicaPage', pageId);
    return withSite(pctx, {
      id: page.id,
      name: page.name,
      slug: page.slug,
      root: page.root,
      recordType: row.recordType,
      isDefault: row.isDefault,
      published: row.published,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
    });
  },
};

export const getSilicaFrame: McpToolDefinition = {
  name: 'get_silica_frame',
  description: 'Fetch the site’s DRAFT frame (chrome) tree — null when none has been authored yet.',
  scope: 'read:builder',
  confirmation: false,
  input: z.object({ propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const pctx = await toPropertyContext(ctx, (input as { propertyId?: string }).propertyId);
    const site = await siteService.load(pctx);
    return withSite(pctx, { frame: site?.frame ?? null });
  },
};

export const getSilicaTheme: McpToolDefinition = {
  name: 'get_silica_theme',
  description:
    'Fetch the site’s DRAFT theme + saved-theme library. A null theme means the tenant’s brand-derived default is ' +
    'what the editor currently previews — that is expected, not a gap, until an author explicitly saves one.',
  scope: 'read:builder',
  confirmation: false,
  input: z.object({ propertyId: propertyIdArg }),
  run: async (ctx, input) => {
    const pctx = await toPropertyContext(ctx, (input as { propertyId?: string }).propertyId);
    const site = await siteService.load(pctx);
    return withSite(pctx, { theme: site?.theme ?? null, savedThemes: site?.savedThemes ?? [] });
  },
};

export const silicaReadTools = [
  describeSilicaAuthoring,
  listSilicaBlocks,
  getSilicaBlock,
  getSilicaSite,
  listSilicaPages,
  getSilicaPage,
  getSilicaFrame,
  getSilicaTheme,
];
