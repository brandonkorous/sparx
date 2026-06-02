// Write-input schemas shared by the service layer, REST routes, and MCP tools.
// Every mutation validates against one of these before touching Prisma.

import { z } from 'zod';
import { AppearancePolicy, LayoutSlot, OptionalUuid, ThemeKey, Uuid } from './common';
import { TargetId } from './layout-targets';
import { SectionTypeEnum } from './section-registry';
import { CustomSectionTypeSchema } from './custom-section';
import { PresentationOverlay, SiteSettings } from './site-settings';

// A placed section's type: a code section (SectionTypeEnum) or a tenant custom
// section (`custom:<slug>`). The custom type's existence + scope are validated
// downstream against the tenant's loaded definitions (sectionService), not here.
const SectionTypeRef = z.union([SectionTypeEnum, CustomSectionTypeSchema]);

export const SelectThemeInput = z.object({
  themeKey: ThemeKey,
});
export type SelectThemeInput = z.infer<typeof SelectThemeInput>;

export const UpdateSettingsInput = z.object({
  settings: SiteSettings.optional(),
  appearancePolicy: AppearancePolicy.optional(),
});
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsInput>;

// key: stable within (tenant, targetId) — "default" for a target's single
// layout, a slug for cms:content-page standalone pages.
export const LayoutKey = z.string().min(1).max(255);

// Resolve-or-create a (targetId, key) page layout. `key` defaults to a target's
// single "default" layout; `name` is humanized from the target when omitted.
export const CreatePageLayoutInput = z.object({
  targetId: TargetId,
  key: LayoutKey.default('default'),
  name: z.string().min(1).max(255).optional(),
});
export type CreatePageLayoutInput = z.infer<typeof CreatePageLayoutInput>;

// "Customize this layout" — get-or-create then, if the layout is still empty,
// copy the code-defined DEFAULT_TEMPLATES[targetId] rows into it (targets without
// a code default just get an empty layout).
export const MaterializePageLayoutInput = z.object({
  targetId: TargetId,
  key: LayoutKey.default('default'),
});
export type MaterializePageLayoutInput = z.infer<typeof MaterializePageLayoutInput>;

export const ListPageLayoutsQuery = z.object({
  targetId: TargetId.optional(),
});
export type ListPageLayoutsQuery = z.infer<typeof ListPageLayoutsQuery>;

// Instantiate a NEW page layout for a target from a Page Template (the code-first
// catalog, docs/36 §10). `name` defaults to the template's name; `key` is derived
// from the name when omitted — the service guarantees it's unique within the
// target (suffixing `-2`, `-3`, … on collision).
export const InstantiateLayoutInput = z.object({
  targetId: TargetId,
  templateId: z.string().min(1).max(120),
  name: z.string().min(1).max(255).optional(),
  key: LayoutKey.optional(),
});
export type InstantiateLayoutInput = z.infer<typeof InstantiateLayoutInput>;

// Rename a page layout — the tenant-facing label only. The `key` is immutable
// (it's the snapshot/resolver identity), so it is NOT editable here.
export const RenamePageLayoutInput = z.object({
  name: z.string().min(1).max(255),
});
export type RenamePageLayoutInput = z.infer<typeof RenamePageLayoutInput>;

export const CreateSectionInput = z.object({
  // Target layout. Address by `pageLayoutId` (preferred) or by `targetId` (+
  // `key`, default 'default') — e.g. 'commerce:product' / 'site:home'. The
  // service requires one of the two.
  pageLayoutId: Uuid.optional(),
  targetId: TargetId.optional(),
  key: LayoutKey.optional(),
  sectionType: SectionTypeRef,
  // Optional initial config; defaults are filled from the section schema.
  config: z.record(z.string(), z.unknown()).optional(),
  // Insert position; appended to the end when omitted.
  position: z.number().int().min(0).optional(),
});
export type CreateSectionInput = z.infer<typeof CreateSectionInput>;

export const UpdateSectionInput = z.object({
  config: z.record(z.string(), z.unknown()).optional(),
  visible: z.boolean().optional(),
});
export type UpdateSectionInput = z.infer<typeof UpdateSectionInput>;

export const ReorderSectionsInput = z.object({
  // Target layout — `pageLayoutId` (preferred) or `targetId` (+ `key`, default
  // 'default'). The service requires one of the two.
  pageLayoutId: Uuid.optional(),
  targetId: TargetId.optional(),
  key: LayoutKey.optional(),
  orderedIds: z.array(Uuid).min(1),
});
export type ReorderSectionsInput = z.infer<typeof ReorderSectionsInput>;

// ── Layout assignment (docs/36 §6, P-C) ─────────────────────────────────────
// SB-owned assignment of a layout to a target's default or a specific record.
// `itemRef` = the owning module's STABLE record id (product/collection/entry id).
export const SetLayoutDefaultInput = z.object({
  targetId: TargetId,
  pageLayoutId: Uuid,
});
export type SetLayoutDefaultInput = z.infer<typeof SetLayoutDefaultInput>;

export const AssignLayoutInput = z.object({
  targetId: TargetId,
  itemRef: z.string().min(1).max(255),
  pageLayoutId: Uuid,
});
export type AssignLayoutInput = z.infer<typeof AssignLayoutInput>;

export const UpsertLayoutInput = z.object({
  slot: LayoutSlot,
  navigationMenuId: OptionalUuid,
  config: z.record(z.string(), z.unknown()).optional(),
  visible: z.boolean().optional(),
});
export type UpsertLayoutInput = z.infer<typeof UpsertLayoutInput>;

export const PublishInput = z.object({
  note: z.string().max(500).optional(),
});
export type PublishInput = z.infer<typeof PublishInput>;

export const RollbackInput = z.object({
  versionId: Uuid,
});
export type RollbackInput = z.infer<typeof RollbackInput>;

export const ScheduleInput = z.object({
  scheduledAt: z.string().datetime(),
  note: z.string().max(500).optional(),
  // Optional saved theme to apply to the draft before this scheduled publish
  // snapshots — seasonal/holiday theme swaps (docs/36 Brand+Theme tier).
  themeId: Uuid.optional(),
});
export type ScheduleInput = z.infer<typeof ScheduleInput>;

// ── Saved themes (docs/36 Brand+Theme tier) ─────────────────────────────────
// A tenant's NAMED theme — the tenant's own library, distinct from the
// read-only platform presets. `presentation` is the v2 surface overlay;
// `basePresetKey` is the preset it layers on; `brand` is the captured identity
// "look" (colours/fonts/shape) so the theme is a self-contained snapshot.
export const SavedThemeName = z.string().min(1).max(120);

// Hex (#rrggbb) or a CSS colour keyword — permissive; the v2 compiler reads each
// slot defensively. Lengths/tokens mirror the brand record (docs/33 §3).
const ThemeColor = z.string().max(32);

// The brand identity captured into a saved theme: colour identity, typography,
// and the shape/rhythm/effect token doc. All fields optional/nullable — a theme
// snapshots whatever the brand had; absent/null means "no override for that slot".
export const SavedThemeBrand = z
  .object({
    colorPrimary: ThemeColor.nullable(),
    colorPrimaryForeground: ThemeColor.nullable(),
    colorAccent: ThemeColor.nullable(),
    colorAccentForeground: ThemeColor.nullable(),
    colorSecondary: ThemeColor.nullable(),
    colorSecondaryForeground: ThemeColor.nullable(),
    fontHeading: z.string().max(127).nullable(),
    fontBody: z.string().max(127).nullable(),
    tokens: z.record(z.string(), z.unknown()).nullable(),
  })
  .partial();
export type SavedThemeBrand = z.infer<typeof SavedThemeBrand>;

export const CreateSavedThemeInput = z.object({
  name: SavedThemeName,
  basePresetKey: ThemeKey,
  presentation: PresentationOverlay.default({}),
  brand: SavedThemeBrand.optional(),
});
export type CreateSavedThemeInput = z.infer<typeof CreateSavedThemeInput>;

export const UpdateSavedThemeInput = z.object({
  name: SavedThemeName.optional(),
  presentation: PresentationOverlay.optional(),
  brand: SavedThemeBrand.optional(),
});
export type UpdateSavedThemeInput = z.infer<typeof UpdateSavedThemeInput>;
