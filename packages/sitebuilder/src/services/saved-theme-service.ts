// savedThemeService — the tenant's NAMED theme variants (docs/36 Brand+Theme
// tier). CRUD over SiteTheme rows + `apply`, which loads a saved theme's
// presentation + base preset into the working draft (theme_key + draftSettings)
// without publishing. Distinct from the read-only platform presets returned by
// themeService.listThemes() — those stay code-first in @sparx/storefront-themes.
//
// Tenant-scoped via withTenant; SiteTheme is ENABLE+FORCE RLS, so a findUnique
// by a cross-tenant id returns null → ownership is enforced (NotFound), the same
// guarantee pageLayoutService relies on.

import {
  CreateSavedThemeInput,
  UpdateSavedThemeInput,
  type PresentationOverlay,
  type SavedThemeBrand,
} from '@sparx/sitebuilder-schemas';
import type { Prisma, SiteTheme, TxClient } from '@sparx/db';
import { withTenant } from '@sparx/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { SitebuilderNotFoundError } from '../errors';
import { getOrCreateConfig } from './_config';

export interface SavedThemeView {
  id: string;
  name: string;
  basePresetKey: string;
  presentation: PresentationOverlay;
  // The captured brand "look" (colours/fonts/shape). Null on legacy rows saved
  // before themes carried a snapshot — those fall back to the live brand.
  brand: SavedThemeBrand | null;
  createdAt: string;
  updatedAt: string;
}

function toView(row: SiteTheme): SavedThemeView {
  return {
    id: row.id,
    name: row.name,
    basePresetKey: row.basePresetKey,
    presentation: (row.presentation ?? {}) as PresentationOverlay,
    brand: (row.brand ?? null) as SavedThemeBrand | null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function list(ctx: ServiceContext): Promise<SavedThemeView[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.siteTheme.findMany({ orderBy: { name: 'asc' } });
    return rows.map(toView);
  });
}

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<SavedThemeView> {
  const input = CreateSavedThemeInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const row = await tx.siteTheme.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        basePresetKey: input.basePresetKey,
        presentation: input.presentation,
        ...(input.brand !== undefined ? { brand: input.brand as Prisma.InputJsonValue } : {}),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'sitebuilder.theme.saved',
      entityType: 'SiteTheme',
      entityId: row.id,
      diff: { after: { name: row.name, basePresetKey: row.basePresetKey } },
    });
    return toView(row);
  });
}

export async function update(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<SavedThemeView> {
  const input = UpdateSavedThemeInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const existing = await tx.siteTheme.findUnique({ where: { id } });
    if (!existing) throw new SitebuilderNotFoundError('SiteTheme', id);
    const row = await tx.siteTheme.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.presentation !== undefined ? { presentation: input.presentation } : {}),
        ...(input.brand !== undefined ? { brand: input.brand as Prisma.InputJsonValue } : {}),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'sitebuilder.theme.updated',
      entityType: 'SiteTheme',
      entityId: row.id,
      diff: { before: { name: existing.name }, after: { name: row.name } },
    });
    return toView(row);
  });
}

// Apply a saved theme's captured brand "look" onto the tenant brand — the
// "apply to brand everywhere" model (docs/33). Writes ONLY the look fields
// (colours, fonts, shape tokens); never the business identity (name/logo/
// socials). A theme with no snapshot (brand == null) is a no-op, leaving the
// current brand untouched. Used by the scheduled-swap path so a scheduled theme
// recolours the whole store — the storefront reads brand live (publish-service
// overlayBrand). The interactive dashboard apply writes the same fields via
// /v1/brand; this is the server-side equivalent for headless application.
export async function applyThemeBrandWithinTx(
  tx: TxClient,
  tenantId: string,
  brand: SavedThemeBrand | null | undefined
): Promise<void> {
  if (!brand) return;
  const data: Prisma.TenantBrandUncheckedUpdateInput = {};
  if (brand.colorPrimary !== undefined) data.colorPrimary = brand.colorPrimary;
  if (brand.colorPrimaryForeground !== undefined)
    data.colorPrimaryForeground = brand.colorPrimaryForeground;
  if (brand.colorAccent !== undefined) data.colorAccent = brand.colorAccent;
  if (brand.colorAccentForeground !== undefined)
    data.colorAccentForeground = brand.colorAccentForeground;
  if (brand.colorSecondary !== undefined) data.colorSecondary = brand.colorSecondary;
  if (brand.colorSecondaryForeground !== undefined)
    data.colorSecondaryForeground = brand.colorSecondaryForeground;
  if (brand.fontHeading !== undefined) data.fontHeading = brand.fontHeading;
  if (brand.fontBody !== undefined) data.fontBody = brand.fontBody;
  // tokens is a JSON column — only set it when the theme carries a shape doc, so
  // a brand without one leaves the tenant's shape untouched (avoids the DbNull
  // dance; clearing shape isn't a goal of a theme swap).
  if (brand.tokens != null) data.tokens = brand.tokens as Prisma.InputJsonValue;
  if (Object.keys(data).length === 0) return;
  await tx.tenantBrand.upsert({
    where: { tenantId },
    create: { tenantId, ...data } as Prisma.TenantBrandUncheckedCreateInput,
    update: data,
  });
}

export async function remove(ctx: ServiceContext, id: string): Promise<{ id: string }> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.siteTheme.findUnique({ where: { id } });
    if (!existing) throw new SitebuilderNotFoundError('SiteTheme', id);
    await tx.siteTheme.delete({ where: { id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'sitebuilder.theme.deleted',
      entityType: 'SiteTheme',
      entityId: id,
      diff: { before: { name: existing.name } },
    });
    return { id };
  });
}

// Load a saved theme into the working draft: set theme_key = basePresetKey and
// merge its presentation into draftSettings (preserving tokens/customCss). Does
// NOT publish — the tenant publishes or schedules afterward. The published
// snapshot picks it up because publish reads the draft.
export async function apply(
  ctx: ServiceContext,
  id: string
): Promise<{ ok: true; themeKey: string }> {
  return withTenant(ctx, async (tx) => {
    const theme = await tx.siteTheme.findUnique({ where: { id } });
    if (!theme) throw new SitebuilderNotFoundError('SiteTheme', id);
    const config = await getOrCreateConfig(tx, ctx.tenantId);
    const draft = (config.draftSettings ?? {}) as Record<string, unknown>;
    await tx.siteConfig.update({
      where: { tenantId: ctx.tenantId },
      data: {
        themeKey: theme.basePresetKey,
        // Record WHICH saved theme is applied (the pointer), alongside its
        // presentation, so the dashboard rail restores the selection on reload.
        // Stamped here (server-side, within the merge) so it can't race the
        // dashboard's debounced settings autosave.
        draftSettings: { ...draft, presentation: theme.presentation, activeSavedThemeId: id },
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'sitebuilder.theme.applied',
      entityType: 'SiteTheme',
      entityId: theme.id,
      diff: { after: { themeKey: theme.basePresetKey } },
    });
    return { ok: true, themeKey: theme.basePresetKey };
  });
}
