// Read-only Site Builder MCP tools. No confirmation; scope read:builder.

import { z } from 'zod';
import { withTenant } from '@sparx/db';
import { TargetId, LayoutKey } from '@sparx/sitebuilder-schemas';
import { themeService, sectionService, publishService, definitionService } from '../services/index';
import type { AnyMcpTool } from './registry';
import type { ServiceContext } from '../errors';
import { toPropertyContext } from './context';

const NoArgs = z.object({});
const TargetArg = z.object({ targetId: TargetId, key: LayoutKey.default('default') });
const SlugArg = z.object({ slug: z.string().min(1).max(56) });
// Per-property tools (docs/49 Phase 6) accept an optional target site; omit for
// the tenant's primary site.
const propertyIdArg = z
  .string()
  .uuid()
  .optional()
  .describe(
    'Target site (web property) id. Omit to target the tenant’s PRIMARY site. A tenant can have ' +
      'MULTIPLE sites — call list_sites first to get each site’s id, then pass it here to target ' +
      'that specific site.'
  );
const PropertyArg = z.object({ propertyId: propertyIdArg });
const ListVersionsArgs = z.object({
  propertyId: propertyIdArg,
  take: z.number().int().min(1).max(200).optional(),
  skip: z.number().int().min(0).optional(),
});

/** List every site (web property) the tenant owns, with its hostnames. `properties`
 *  is FORCE-RLS, so the lookup runs through withTenant (a bare query has no tenant
 *  GUC and would see zero rows). */
async function listSites(ctx: ServiceContext) {
  return withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.property.findMany({
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        isPrimary: true,
        status: true,
        domains: {
          orderBy: [{ isCanonical: 'desc' }, { createdAt: 'asc' }],
          select: { host: true, type: true, status: true, isCanonical: true },
        },
      },
    })
  );
}

export const readTools: AnyMcpTool[] = [
  {
    name: 'list_sites',
    description:
      'List every SITE (web property) this tenant owns: id, name, slug, whether it is the primary, ' +
      'status, and its hostnames. CALL THIS FIRST when the tenant may have more than one site — take a ' +
      'site’s `id` and pass it as the `propertyId` argument to any site or page tool (get_site_config, ' +
      'list_builder_pages, create_builder_page, publish_site, …) to target that specific site. Omitting ' +
      'propertyId always falls back to the tenant’s primary site.',
    scope: 'read:builder',
    input: NoArgs,
    confirmation: false,
    run: (ctx) => listSites(ctx),
  },
  {
    name: 'list_themes',
    description:
      'List every theme sparx ships — forty of them, in two shelves: `sparx` themes named for the ' +
      'BUSINESS they suit (clinic, workshop, kitchen, …) and `silica` themes named for the LOOK ' +
      '(quartz, midnight, neon, …). Each entry carries its tagline, description and browse facets ' +
      '(industry, mood, colorFamily, density) — enough to choose one. Pass a `slug` to select_theme ' +
      'to apply it; use get_silica_theme for a theme’s actual colour tokens.',
    scope: 'read:builder',
    input: NoArgs,
    confirmation: false,
    run: () => Promise.resolve(themeService.listThemes()),
  },
  {
    name: 'get_site_config',
    description:
      'Get the current Site Builder draft config: selected theme, appearance policy (light/dark), and settings overlay.',
    scope: 'read:builder',
    input: PropertyArg,
    confirmation: false,
    run: async (ctx, input) =>
      themeService.getConfig(
        await toPropertyContext(ctx, (input as z.infer<typeof PropertyArg>).propertyId)
      ),
  },
  {
    name: 'get_sections',
    description:
      'List a layout’s sections in render order. `targetId` is the layout target (commerce:product | commerce:collection | cms:content-page | site:home | cms:content-type:<id>); `key` defaults to "default" (use a slug for a standalone content page).',
    scope: 'read:builder',
    input: TargetArg,
    confirmation: false,
    run: (ctx, input) => {
      const { targetId, key } = input as z.infer<typeof TargetArg>;
      return sectionService.listForTarget(ctx, targetId, key);
    },
  },
  {
    name: 'list_site_versions',
    description: 'List published Site Builder versions (newest first) for history and rollback.',
    scope: 'read:builder',
    input: ListVersionsArgs,
    confirmation: false,
    run: async (ctx, input) => {
      const { propertyId, ...opts } = input as z.infer<typeof ListVersionsArgs>;
      return publishService.listVersions(await toPropertyContext(ctx, propertyId), opts);
    },
  },
  {
    name: 'get_published_site',
    description:
      'Get the currently-published storefront snapshot: theme, appearance policy, compiled tokens, sections, and layout.',
    scope: 'read:builder',
    input: PropertyArg,
    confirmation: false,
    run: async (ctx, input) =>
      publishService.getPublishedSnapshot(
        await toPropertyContext(ctx, (input as z.infer<typeof PropertyArg>).propertyId)
      ),
  },
  {
    name: 'list_custom_sections',
    description:
      'List the tenant’s custom section types (tenant-defined sections, each a field spec + render template). Their placed-section type is `custom:<slug>`.',
    scope: 'read:builder',
    input: NoArgs,
    confirmation: false,
    run: (ctx) => definitionService.list(ctx),
  },
  {
    name: 'get_custom_section',
    description:
      'Get one custom section definition by slug — its field spec, render template, binding, and version.',
    scope: 'read:builder',
    input: SlugArg,
    confirmation: false,
    run: (ctx, input) => definitionService.get(ctx, (input as z.infer<typeof SlugArg>).slug),
  },
];
