// themeService — a tenant's LOOKS, as documents of their own.
//
// A theme was a JSON column on one site plus a saved-themes array beside it,
// which cannot express either of the two things a theme actually is: reusable
// across a tenant's sites, and publishable on its own schedule. `builder_themes`
// makes it a row; this is the service over it.
//
// THREE TIERS, ONE TABLE. Platform presets ship in code and marketplace listings
// live in `marketplace_themes`; both are COPIED into a row when used, so a preset
// or a listing changing under a live site can never repaint it, and an author can
// always edit what they picked. `origin` keeps the provenance.
//
// Tenant-scoped through `withTenant` (FORCE RLS), like every other builder table.

import { withTenant, type Prisma, type TxClient } from '@sparx/db';
import type { Theme as SilicaTheme } from '@wizeworks/silicaui-html';
import { z } from 'zod';
import {
  BuilderNotFoundError,
  BuilderValidationError,
  type PropertyContext,
  type ServiceContext,
} from '../errors';

/** Where a look came from. Never who owns it — every row belongs to the tenant. */
export type ThemeOrigin = 'custom' | 'preset' | 'marketplace';

export interface ThemeDto {
  id: string;
  name: string;
  origin: ThemeOrigin;
  sourceKey: string | null;
  marketplaceThemeId: string | null;
  marketplaceVersion: string | null;
  draft: SilicaTheme;
  published: SilicaTheme | null;
  publishedAt: string | null;
  /** True when the saved draft differs from what visitors are served. */
  unpublished: boolean;
  updatedAt: string;
}

/** A silica `Theme`, validated only as far as this service depends on it — the
 *  token maps are open by design, because silica gains tokens and a closed schema
 *  here would reject a theme the renderer understands perfectly well. */
const ThemeShape = z.object({
  name: z.string().min(1).max(160),
  tokens: z.record(z.string(), z.string()),
  dark: z.record(z.string(), z.string()).optional(),
  mode: z.enum(['light', 'dark']).optional(),
});

export const CreateThemeInput = z.object({
  name: z.string().min(1).max(160),
  theme: ThemeShape,
  origin: z.enum(['custom', 'preset', 'marketplace']).default('custom'),
  sourceKey: z.string().max(120).optional(),
  marketplaceThemeId: z.string().uuid().optional(),
  marketplaceVersion: z.string().max(20).optional(),
});

export const UpdateThemeInput = z.object({
  name: z.string().min(1).max(160).optional(),
  theme: ThemeShape.optional(),
});

interface ThemeRow {
  id: string;
  name: string;
  origin: string;
  sourceKey: string | null;
  marketplaceThemeId: string | null;
  marketplaceVersion: string | null;
  draftTokens: unknown;
  publishedTokens: unknown;
  publishedAt: Date | null;
  updatedAt: Date;
}

function toDto(row: ThemeRow): ThemeDto {
  const draft = row.draftTokens as SilicaTheme;
  const published = (row.publishedTokens ?? null) as SilicaTheme | null;
  return {
    id: row.id,
    name: row.name,
    origin: row.origin as ThemeOrigin,
    sourceKey: row.sourceKey,
    marketplaceThemeId: row.marketplaceThemeId,
    marketplaceVersion: row.marketplaceVersion,
    draft,
    published,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    // Compared as VALUES, not by timestamp. A save that changed nothing must not
    // report "not live yet" — the operator would publish to clear a badge that
    // was never true, and learn to ignore the one that is.
    unpublished: JSON.stringify(draft) !== JSON.stringify(published),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function list(ctx: ServiceContext): Promise<ThemeDto[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderTheme.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ name: 'asc' }],
    });
    return rows.map(toDto);
  });
}

export function get(ctx: ServiceContext, id: string): Promise<ThemeDto> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderTheme.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!row) throw new BuilderNotFoundError('Theme', id);
    return toDto(row);
  });
}

export function create(ctx: ServiceContext, input: unknown): Promise<ThemeDto> {
  const parsed = CreateThemeInput.parse(input);
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderTheme.create({
      data: {
        tenantId: ctx.tenantId,
        name: parsed.name,
        origin: parsed.origin,
        sourceKey: parsed.sourceKey ?? null,
        marketplaceThemeId: parsed.marketplaceThemeId ?? null,
        marketplaceVersion: parsed.marketplaceVersion ?? null,
        draftTokens: parsed.theme,
      },
    });
    return toDto(row);
  });
}

export function update(ctx: ServiceContext, id: string, input: unknown): Promise<ThemeDto> {
  const parsed = UpdateThemeInput.parse(input);
  if (parsed.name === undefined && parsed.theme === undefined) {
    throw new BuilderValidationError('Nothing to update');
  }
  return withTenant(ctx, async (tx) => {
    const existing = await tx.builderTheme.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) throw new BuilderNotFoundError('Theme', id);
    const row = await tx.builderTheme.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.theme !== undefined ? { draftTokens: parsed.theme } : {}),
      },
    });
    return toDto(row);
  });
}

/** Copy a look. The one move a read-only preset or a marketplace listing offers,
 *  and the safe answer to "I want this but different". */
export function duplicate(ctx: ServiceContext, id: string, name?: string): Promise<ThemeDto> {
  return withTenant(ctx, async (tx) => {
    const source = await tx.builderTheme.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!source) throw new BuilderNotFoundError('Theme', id);
    const row = await tx.builderTheme.create({
      data: {
        tenantId: ctx.tenantId,
        name: name ?? `${source.name} copy`,
        origin: 'custom',
        draftTokens: source.draftTokens as Prisma.InputJsonValue,
      },
    });
    return toDto(row);
  });
}

/**
 * Snapshot draft → published.
 *
 * Publishing a theme does NOT change what any site is serving on its own: a site
 * serves the theme its `published_theme_id` points at, and that pointer moves
 * when the SITE publishes. So an author can perfect a look, publish it, and still
 * choose when each site starts wearing it.
 */
export function publish(ctx: ServiceContext, id: string): Promise<ThemeDto> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.builderTheme.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) throw new BuilderNotFoundError('Theme', id);
    const row = await tx.builderTheme.update({
      where: { id },
      data: {
        publishedTokens: existing.draftTokens as Prisma.InputJsonValue,
        publishedAt: new Date(),
      },
    });
    return toDto(row);
  });
}

/** Which sites wear this look — the blast radius of deleting or changing it. */
export function usages(ctx: ServiceContext, id: string): Promise<{ propertyId: string }[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderSite.findMany({
      where: { tenantId: ctx.tenantId, OR: [{ themeId: id }, { publishedThemeId: id }] },
      select: { propertyId: true },
    });
    return rows;
  });
}

/**
 * Delete a look.
 *
 * Refused while a site is wearing it. A dangling pointer falls back to the
 * brand-derived theme, which is safe — but it happens on the LIVE site the moment
 * the row goes, and nobody deleting an unused-looking theme expects to repaint a
 * shop. The caller changes the site's look first.
 */
export function remove(ctx: ServiceContext, id: string): Promise<void> {
  return withTenant(ctx, async (tx) => {
    const inUse = await tx.builderSite.count({
      where: { tenantId: ctx.tenantId, OR: [{ themeId: id }, { publishedThemeId: id }] },
    });
    if (inUse > 0) {
      throw new BuilderValidationError(
        'This look is being used by a site. Choose a different look for it first.'
      );
    }
    const deleted = await tx.builderTheme.deleteMany({ where: { id, tenantId: ctx.tenantId } });
    if (deleted.count === 0) throw new BuilderNotFoundError('Theme', id);
  });
}

/** What a property is wearing, draft and published. */
export interface SiteThemeSelection {
  themeId: string | null;
  publishedThemeId: string | null;
}

export function selection(ctx: PropertyContext): Promise<SiteThemeSelection> {
  return withTenant(ctx, async (tx) => {
    const site = await tx.builderSite.findUnique({
      where: { propertyId: ctx.propertyId },
      select: { themeId: true, publishedThemeId: true },
    });
    return {
      themeId: site?.themeId ?? null,
      publishedThemeId: site?.publishedThemeId ?? null,
    };
  });
}

/**
 * Point a site at a look — the DRAFT pointer only.
 *
 * Deliberately not the published one. Trying a different look must never repaint
 * the live site the moment it is clicked; the change reaches visitors when the
 * site publishes, exactly like every other edit in the editor.
 */
export function apply(ctx: PropertyContext, themeId: string | null): Promise<SiteThemeSelection> {
  return withTenant(ctx, async (tx) => {
    if (themeId) {
      const exists = await tx.builderTheme.count({
        where: { id: themeId, tenantId: ctx.tenantId },
      });
      if (exists === 0) throw new BuilderNotFoundError('Theme', themeId);
    }
    await ensureSite(tx, ctx);
    const site = await tx.builderSite.update({
      where: { propertyId: ctx.propertyId },
      data: { themeId },
      select: { themeId: true, publishedThemeId: true },
    });
    return { themeId: site.themeId, publishedThemeId: site.publishedThemeId };
  });
}

/** Move the published pointer to match the draft — called by the site publish. */
export function publishSelection(ctx: PropertyContext): Promise<SiteThemeSelection> {
  return withTenant(ctx, async (tx) => {
    const site = await tx.builderSite.findUnique({
      where: { propertyId: ctx.propertyId },
      select: { themeId: true },
    });
    if (!site) return { themeId: null, publishedThemeId: null };
    const updated = await tx.builderSite.update({
      where: { propertyId: ctx.propertyId },
      data: { publishedThemeId: site.themeId },
      select: { themeId: true, publishedThemeId: true },
    });
    return { themeId: updated.themeId, publishedThemeId: updated.publishedThemeId };
  });
}

/** The `builder_sites` row, created if this property has never had one. */
async function ensureSite(tx: TxClient, ctx: PropertyContext): Promise<void> {
  const existing = await tx.builderSite.count({ where: { propertyId: ctx.propertyId } });
  if (existing > 0) return;
  await tx.builderSite.create({
    data: { tenantId: ctx.tenantId, propertyId: ctx.propertyId },
  });
}
