// Write Site Builder MCP tools. Go-live actions (publish/rollback/schedule)
// are confirmation-gated; scope write:builder.

import { z } from 'zod';
import {
  CreateSectionInput,
  PublishInput,
  ReorderSectionsInput,
  RollbackInput,
  ScheduleInput,
  SectionDefinitionInput,
  SectionDefinitionUpdateInput,
  SelectThemeInput,
  UpdateSettingsInput,
  UpsertLayoutInput,
  Uuid,
} from '@wizeworks/sitebuilder-schemas';
import {
  themeService,
  sectionService,
  layoutService,
  publishService,
  scheduleService,
  definitionService,
} from '../services/index';
import type { AnyMcpTool } from './registry';
import { toPropertyContext, withSite } from './context';

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

const UpdateSectionTool = z.object({
  sectionId: Uuid,
  config: z.record(z.string(), z.unknown()).optional(),
  visible: z.boolean().optional(),
});
const RemoveSectionTool = z.object({ sectionId: Uuid });

// Update addresses the definition by its immutable slug; the rest is a full
// replacement body (SectionDefinitionUpdateInput) that bumps the version.
const UpdateDefinitionTool = SectionDefinitionUpdateInput.extend({
  slug: z.string().min(1).max(56),
});
const DeleteDefinitionTool = z.object({ slug: z.string().min(1).max(56) });

export const writeTools: AnyMcpTool[] = [
  {
    name: 'select_theme',
    description:
      'Switch a site to a different theme (draft change — publish to go live). Targets the tenant’s primary site unless `propertyId` is given.',
    scope: 'write:builder',
    input: SelectThemeInput.extend({ propertyId: propertyIdArg }),
    confirmation: false,
    run: async (ctx, input) => {
      const { propertyId, ...rest } = input as { propertyId?: string } & z.infer<
        typeof SelectThemeInput
      >;
      const pctx = await toPropertyContext(ctx, propertyId);
      return withSite(pctx, await themeService.selectTheme(pctx, rest));
    },
  },
  {
    name: 'update_site_settings',
    description:
      'Update the draft theme settings (colors per light/dark, fonts, layout, custom CSS), the appearance policy, ' +
      'and/or the site identity imagery — logoLightMediaId / logoDarkMediaId / faviconMediaId (a MediaAsset id from ' +
      'upload_image or set_image_from_url; pass null to clear). The header logo + favicon render from these. Targets ' +
      'the tenant’s primary site unless `propertyId` is given.',
    scope: 'write:builder',
    input: UpdateSettingsInput.extend({ propertyId: propertyIdArg }),
    confirmation: false,
    run: async (ctx, input) => {
      const { propertyId, ...rest } = input as { propertyId?: string } & z.infer<
        typeof UpdateSettingsInput
      >;
      const pctx = await toPropertyContext(ctx, propertyId);
      return withSite(pctx, await themeService.updateSettings(pctx, rest));
    },
  },
  {
    name: 'add_section',
    description:
      'Add a section (hero, featured-products, testimonials, …) to a layout draft. Target the layout by `pageLayoutId`, or by `targetId` (commerce:product | commerce:collection | cms:content-page | site:home | cms:content-type:<id>) + optional `key`.',
    scope: 'write:builder',
    input: CreateSectionInput,
    confirmation: false,
    run: (ctx, input) => sectionService.create(ctx, input),
  },
  {
    name: 'update_section',
    description: "Update a section's config and/or visibility.",
    scope: 'write:builder',
    input: UpdateSectionTool,
    confirmation: false,
    run: (ctx, input) => {
      const { sectionId, ...rest } = input as z.infer<typeof UpdateSectionTool>;
      return sectionService.update(ctx, sectionId, rest);
    },
  },
  {
    name: 'reorder_sections',
    description:
      'Reorder a layout’s sections by supplying the section ids in the desired order. Target the layout by `pageLayoutId`, or by `targetId` (+ optional `key`).',
    scope: 'write:builder',
    input: ReorderSectionsInput,
    confirmation: false,
    run: (ctx, input) => sectionService.reorder(ctx, input),
  },
  {
    name: 'remove_section',
    description: 'Delete a section from a page draft.',
    scope: 'write:builder',
    input: RemoveSectionTool,
    confirmation: true,
    run: (ctx, input) =>
      sectionService.remove(ctx, (input as z.infer<typeof RemoveSectionTool>).sectionId),
  },
  {
    name: 'upsert_layout',
    description:
      'Configure a header / footer / announcement slot (optionally linking a navigation menu). The header & footer MUST be ' +
      'responsive — keep the header link set short so it collapses cleanly on phones (avoid fixed-width CTAs), and lay footer ' +
      'links out in columns that stack on narrow screens. A header/footer that overflows a phone is a defect.',
    scope: 'write:builder',
    input: UpsertLayoutInput,
    confirmation: false,
    run: (ctx, input) => layoutService.upsert(ctx, input),
  },
  {
    name: 'publish_site',
    description:
      'Publish the current draft live to the live site. Targets the tenant’s primary site unless `propertyId` is given.',
    scope: 'write:builder',
    input: PublishInput.extend({ propertyId: propertyIdArg }),
    confirmation: true,
    run: async (ctx, input) => {
      const { propertyId, ...rest } = input as { propertyId?: string } & z.infer<
        typeof PublishInput
      >;
      const pctx = await toPropertyContext(ctx, propertyId);
      return withSite(pctx, await publishService.publishNow(pctx, rest));
    },
  },
  {
    name: 'rollback_site',
    description:
      'Roll a site back to a prior published version (creates a new version). Targets the tenant’s primary site unless `propertyId` is given.',
    scope: 'write:builder',
    input: RollbackInput.extend({ propertyId: propertyIdArg }),
    confirmation: true,
    run: async (ctx, input) => {
      const { propertyId, ...rest } = input as { propertyId?: string } & z.infer<
        typeof RollbackInput
      >;
      return publishService.rollback(await toPropertyContext(ctx, propertyId), rest);
    },
  },
  {
    name: 'schedule_publish',
    description:
      'Schedule the current draft to publish at a future time. Targets the tenant’s primary site unless `propertyId` is given.',
    scope: 'write:builder',
    input: ScheduleInput.extend({ propertyId: propertyIdArg }),
    confirmation: true,
    run: async (ctx, input) => {
      const { propertyId, ...rest } = input as { propertyId?: string } & z.infer<
        typeof ScheduleInput
      >;
      return scheduleService.schedule(await toPropertyContext(ctx, propertyId), rest);
    },
  },
  {
    name: 'create_custom_section',
    description:
      'Define a new custom section TYPE: a `slug`, `label`, an optional `binding` (product | collection), a `fieldSpec` (the editable fields), and a `template` (the render-template AST). Tenants then add it to layouts as `custom:<slug>`.',
    scope: 'write:builder',
    input: SectionDefinitionInput,
    confirmation: false,
    run: (ctx, input) => definitionService.create(ctx, input),
  },
  {
    name: 'update_custom_section',
    description:
      'Replace a custom section definition (by `slug`) — its label, binding, field spec, and template. Bumps the version; the next publish re-pins it.',
    scope: 'write:builder',
    input: UpdateDefinitionTool,
    confirmation: false,
    run: (ctx, input) => {
      const { slug, ...rest } = input as z.infer<typeof UpdateDefinitionTool>;
      return definitionService.update(ctx, slug, rest);
    },
  },
  {
    name: 'delete_custom_section',
    description:
      'Delete a custom section definition by slug. Refused while draft sections still place it; published pages keep rendering from their pinned snapshot.',
    scope: 'write:builder',
    input: DeleteDefinitionTool,
    confirmation: true,
    run: (ctx, input) =>
      definitionService.remove(ctx, (input as z.infer<typeof DeleteDefinitionTool>).slug),
  },
];
