// savedThemeService — the tenant's NAMED theme variants (docs/36 Brand+Theme
// tier). CRUD over SiteTheme rows + `apply`, which loads a saved theme's
// presentation + base preset into the working draft (theme_key + draftSettings)
// without publishing. Distinct from the read-only platform presets returned by
// themeService.listThemes() — those stay code-first in @sparx/site-themes.
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
import type { PropertyContext, ServiceContext } from '../errors';
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

// Apply a saved theme's captured brand "look" to ONE site. A site carries its brand
// as its Property's `brand_override` JSON (the compile-relevant colour/type/shape
// subset publish-service.readPropertyBrandOverride reads), NOT the tenant base
// brand — so applying a theme recolours ONLY that site (docs/49). Writes ONLY the
// look fields (colours, fonts, shape tokens); never the business identity
// (name/logo/socials). Merge the theme's look fields OVER any existing override: a
// carried field wins, an untouched override field survives, and the shape doc is
// replaced only when the theme brings one. A theme with no snapshot is a no-op.
//
// There is deliberately NO tenant-base counterpart. Writing the primary site's
// theme to TenantBrand is what made `apply_saved_theme` on the primary recolour
// every sibling site that had no override of its own — the tenant base is the
// inherited default for an unbranded site, never a site's own storage.
export async function applyThemeBrandToSiteOverrideWithinTx(
  tx: TxClient,
  propertyId: string,
  brand: SavedThemeBrand | null | undefined
): Promise<void> {
  if (!brand) return;
  const row = await tx.property.findUnique({
    where: { id: propertyId },
    select: { brandOverride: true },
  });
  const prev =
    row?.brandOverride && typeof row.brandOverride === 'object' && !Array.isArray(row.brandOverride)
      ? (row.brandOverride as Record<string, unknown>)
      : {};
  const next: Record<string, unknown> = { ...prev };
  // Present (incl. explicit null = "inherit base") wins; undefined leaves the prior
  // override field untouched — the same undefined-vs-null contract as the tenant
  // brand upsert above.
  const carry = (k: keyof SavedThemeBrand): void => {
    if (brand[k] !== undefined) next[k] = brand[k];
  };
  carry('colorPrimary');
  carry('colorPrimaryForeground');
  carry('colorAccent');
  carry('colorAccentForeground');
  carry('colorSecondary');
  carry('colorSecondaryForeground');
  carry('fontHeading');
  carry('fontBody');
  if (brand.tokens != null) next.tokens = brand.tokens;
  await tx.property.update({
    where: { id: propertyId },
    data: { brandOverride: next as Prisma.InputJsonValue },
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

// Load a saved theme into the working draft: set theme_key = basePresetKey, merge
// its presentation into draftSettings (preserving tokens/customCss), point
// activeSavedThemeId at it, AND apply its captured brand "look" to the right scope
// (the tenant base brand for the primary site, this site's brand_override
// otherwise). Applying the brand is what makes a HEADLESS apply (MCP
// apply_saved_theme, the REST apply route, the blueprint installer) fully land the
// theme the way the interactive dashboard does — the dashboard applies the brand
// via its own client, so before this every headless caller left the colours/fonts
// unapplied and the theme "didn't apply" in the brand designer. Does NOT publish —
// the tenant publishes or schedules afterward; the published snapshot picks it up
// because publish reads the draft + the live brand.
export async function apply(
  ctx: PropertyContext,
  id: string
): Promise<{ ok: true; themeKey: string }> {
  return withTenant(ctx, async (tx) => {
    const theme = await tx.siteTheme.findUnique({ where: { id } });
    if (!theme) throw new SitebuilderNotFoundError('SiteTheme', id);
    const config = await getOrCreateConfig(tx, ctx.tenantId, ctx.propertyId);
    const draft = (config.draftSettings ?? {}) as Record<string, unknown>;
    await tx.siteConfig.update({
      where: { tenantId_propertyId: { tenantId: ctx.tenantId, propertyId: ctx.propertyId } },
      data: {
        themeKey: theme.basePresetKey,
        // Record WHICH saved theme is applied (the pointer), alongside its
        // presentation, so the dashboard rail restores the selection on reload.
        // Stamped here (server-side, within the merge) so it can't race the
        // dashboard's debounced settings autosave.
        draftSettings: {
          ...draft,
          // CLEAR the v1 `tokens` overlay. It is the previous theme's colours +
          // fonts in the legacy vocabulary, and merging over `draft` used to carry
          // it through untouched — so a swap landed the new presentation while
          // `compileTokens()` (publish-service) still compiled the OLD primary and
          // the old type stack, and the site silently kept its former brand. The
          // overlay is the layer being retired (docs/implementation/
          // st-token-retirement.md), so a theme apply clears it rather than
          // rewriting it: the theme's own presentation + brand snapshot below are
          // the complete look.
          tokens: { light: {}, dark: {} },
          presentation: theme.presentation,
          activeSavedThemeId: id,
        },
      },
    });
    // Apply the captured brand look to THIS site's brand_override — whether or not
    // it is the primary — so the colours/fonts land for headless callers (the
    // dashboard's client does this itself) without touching any sibling site. A
    // legacy theme with no snapshot (brand == null) leaves the brand untouched.
    const brand = (theme.brand ?? null) as SavedThemeBrand | null;
    if (brand) await applyThemeBrandToSiteOverrideWithinTx(tx, ctx.propertyId, brand);
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
