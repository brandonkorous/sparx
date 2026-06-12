// Read-only Site Builder MCP tools. No confirmation; scope read:builder.

import { z } from 'zod';
import { TargetId, LayoutKey } from '@sparx/sitebuilder-schemas';
import { themeService, sectionService, publishService, definitionService } from '../services/index';
import type { AnyMcpTool } from './registry';
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
  .describe('Target site (web property) id; omit for the tenant’s primary site.');
const PropertyArg = z.object({ propertyId: propertyIdArg });
const ListVersionsArgs = z.object({
  propertyId: propertyIdArg,
  take: z.number().int().min(1).max(200).optional(),
  skip: z.number().int().min(0).optional(),
});

export const readTools: AnyMcpTool[] = [
  {
    name: 'list_themes',
    description:
      'List the available storefront themes (Apex, Industrial, Drift, Market, Fleet, Drop) with their settings schema and category.',
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
