// Saved-theme (custom theme) MCP tools — the tenant's NAMED theme variants
// (docs/36). A saved theme captures a base preset + a presentation overlay + a
// brand snapshot (colors / fonts / shape) under a name, so a site can wear a
// FIRST-CLASS custom theme instead of a bare preset with unsaved overrides.
// list/create/update/delete are tenant-scoped; apply loads a saved theme into a
// specific site's draft config. Scope: read:builder / write:builder.
//
// Distinct from the read-only platform presets (list_themes / select_theme): those
// are code-first starting points; these are the tenant's own reusable themes.

import { z } from 'zod';
import { CreateSavedThemeInput, UpdateSavedThemeInput, Uuid } from '@sparx/sitebuilder-schemas';

import { savedThemeService } from '../services/index';
import type { AnyMcpTool } from './registry';
import { toPropertyContext, withSite } from './context';

const propertyIdArg = z
    .string()
    .uuid()
    .optional()
    .describe(
        'Target site (web property) id. Omit to target the tenant’s PRIMARY site. A tenant can have ' +
        'MULTIPLE sites — call list_sites first to get each site’s id, then pass it here to target that specific site.'
    );

export const themeTools: AnyMcpTool[] = [
    {
        name: 'list_saved_themes',
        description:
            'List the tenant’s SAVED custom themes (the "My themes" library): id, name, base preset, and the captured ' +
            'brand snapshot. These are named, reusable themes — distinct from the read-only platform presets (list_themes).',
        scope: 'read:builder',
        input: z.object({}),
        confirmation: false,
        run: (ctx) => savedThemeService.list(ctx),
    },
    {
        name: 'create_saved_theme',
        description:
            'Create a named custom theme from a base preset + a presentation overlay + a brand snapshot (colors, fonts, ' +
            'shape). This is how a site gets a FIRST-CLASS custom theme instead of a bare preset with overrides. After ' +
            'creating it, call apply_saved_theme to make a site use it. `basePresetKey` is a platform preset key (apex, ' +
            'industrial, drift, market, fleet, drop) the theme derives its structure from.',
        scope: 'write:builder',
        input: CreateSavedThemeInput,
        confirmation: false,
        run: (ctx, input) => savedThemeService.create(ctx, input),
    },
    {
        name: 'update_saved_theme',
        description:
            'Update a saved custom theme (by `id`) — its name, presentation overlay, and/or brand snapshot. Does not ' +
            're-apply it to any site; apply_saved_theme (then publish_site) does that.',
        scope: 'write:builder',
        input: UpdateSavedThemeInput.extend({ id: Uuid }),
        confirmation: false,
        run: (ctx, input) => {
            const { id, ...rest } = input as z.infer<typeof UpdateSavedThemeInput> & { id: string };
            return savedThemeService.update(ctx, id, rest);
        },
    },
    {
        name: 'apply_saved_theme',
        description:
            'Apply a saved custom theme to a SITE — loads its base preset + presentation into the site’s DRAFT config ' +
            '(and points activeSavedThemeId at it). Draft only; call publish_site to take it live. Targets the tenant’s ' +
            'primary site unless propertyId is given.',
        scope: 'write:builder',
        input: z.object({ savedThemeId: Uuid, propertyId: propertyIdArg }),
        confirmation: false,
        run: async (ctx, input) => {
            const { savedThemeId, propertyId } = input as { savedThemeId: string; propertyId?: string };
            const pctx = await toPropertyContext(ctx, propertyId);
            return withSite(pctx, await savedThemeService.apply(pctx, savedThemeId));
        },
    },
    {
        name: 'delete_saved_theme',
        description:
            'Delete a saved custom theme by `id`. Does not change any site already using it (that site’s config keeps the ' +
            'applied presentation). Confirmation-gated.',
        scope: 'write:builder',
        input: z.object({ id: Uuid }),
        confirmation: true,
        run: (ctx, input) => savedThemeService.remove(ctx, (input as { id: string }).id),
    },
];
