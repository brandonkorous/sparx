// themeService — theme catalog + per-tenant theme selection and settings.
//
// listThemes/getThemeSchema are static (no tenant). selectTheme/updateSettings
// mutate the draft SiteConfig; they do NOT publish — changes go live only when
// publishService.publishNow runs.

import { SelectThemeInput, UpdateSettingsInput } from '@sparx/sitebuilder-schemas';
import type { Prisma, SiteConfig, TxClient } from '@sparx/db';
import { withTenant } from '@sparx/db';
import { getTheme, isThemeKey, THEME_LIST, type ThemePreset } from '@sparx/site-themes';

import { writeAuditLog } from '../audit';
import { publishSitebuilderEvent } from '../events';
import { SitebuilderNotFoundError, type PropertyContext } from '../errors';
import { getOrCreateConfig } from './_config';

// ── Static catalog (no tenant) ──────────────────────────────────────────────

export function listThemes(): ThemePreset[] {
  return THEME_LIST;
}

export function getThemeSchema(themeKey: string): ThemePreset['settingsSchema'] {
  return getTheme(themeKey).settingsSchema;
}

// ── Per-tenant config ───────────────────────────────────────────────────────

export function getConfig(ctx: PropertyContext): Promise<SiteConfig> {
  return withTenant(ctx, (tx) => getOrCreateConfig(tx, ctx.tenantId, ctx.propertyId));
}

export interface SelectThemeResolution {
  /** Resolve a marketplace DATA theme's full `DataThemePreset` by slug, or null
   *  when the slug is not a marketplace data theme (a code foundation, or unknown).
   *  Injected by the api-rest route because the artifact lives in object storage,
   *  not a column (docs/85 §6/§7) — the @sparx/sitebuilder package never reaches
   *  storage directly. */
  resolveDataPreset?: (slug: string) => Promise<unknown>;
}

export async function selectTheme(
  ctx: PropertyContext,
  rawInput: unknown,
  resolution: SelectThemeResolution = {}
): Promise<SiteConfig> {
  const input = SelectThemeInput.parse(rawInput);
  const slug = input.themeKey;

  // Resolve the slug (docs/85 §7): a marketplace DATA theme carries its full
  // `DataThemePreset` as a storage artifact (resolved by the injected callback);
  // the code foundations resolve by key. A slug that is neither is unknown.
  const dataPreset = resolution.resolveDataPreset ? await resolution.resolveDataPreset(slug) : null;
  const isData = dataPreset != null;
  if (!isData && !isThemeKey(slug)) {
    throw new SitebuilderNotFoundError('Theme', slug);
  }

  const updated = await withTenant(ctx, async (tx) => {
    const config = await getOrCreateConfig(tx, ctx.tenantId, ctx.propertyId);

    // Carry (or clear) the inline preset in draftSettings so the compile engine
    // applies it with no code preset. A code foundation clears any prior inline.
    const draftSettings: Record<string, unknown> = {
      ...((config.draftSettings as Record<string, unknown> | null) ?? {}),
    };
    if (isData) {
      draftSettings.themePreset = dataPreset;
    } else {
      delete draftSettings.themePreset;
    }

    const next = await tx.siteConfig.update({
      where: { tenantId_propertyId: { tenantId: ctx.tenantId, propertyId: ctx.propertyId } },
      data: { themeKey: slug, draftSettings: draftSettings as Prisma.InputJsonValue },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'sitebuilder.theme.selected',
      entityType: 'SiteConfig',
      entityId: ctx.propertyId,
      diff: { before: { themeKey: config.themeKey }, after: { themeKey: next.themeKey } },
    });
    return next;
  });

  await publishSitebuilderEvent({
    tenantId: ctx.tenantId,
    topic: 'sitebuilder.theme_changed',
    payload: { themeKey: updated.themeKey },
    dedupeKey: `sitebuilder.theme_changed:${ctx.tenantId}:${updated.themeKey}`,
  });

  return updated;
}

export async function updateSettings(ctx: PropertyContext, rawInput: unknown): Promise<SiteConfig> {
  const input = UpdateSettingsInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const config = await getOrCreateConfig(tx, ctx.tenantId, ctx.propertyId);
    // Identity imagery (logo/favicon) lives on the brand, not the SiteConfig — so
    // it's written scope-aware (primary → tenant brand, non-primary → override),
    // independently of any theme-settings change. No-op when no id field is present.
    await applyIdentityMedia(tx, ctx, input);
    if (input.settings === undefined && input.appearancePolicy === undefined) {
      return config;
    }
    return tx.siteConfig.update({
      where: { tenantId_propertyId: { tenantId: ctx.tenantId, propertyId: ctx.propertyId } },
      data: {
        ...(input.settings !== undefined ? { draftSettings: input.settings } : {}),
        ...(input.appearancePolicy !== undefined
          ? { appearancePolicy: input.appearancePolicy }
          : {}),
      },
    });
  });
}

// The three site-identity media ids (a MediaAsset id, or null to clear/inherit).
type IdentityMediaKey = 'logoLightMediaId' | 'logoDarkMediaId' | 'faviconMediaId';
const IDENTITY_MEDIA_KEYS: readonly IdentityMediaKey[] = [
  'logoLightMediaId',
  'logoDarkMediaId',
  'faviconMediaId',
];

// Write the site's logo/favicon media ids to the right brand scope — mirrors the
// colour/font split (applyThemeBrandWithinTx vs …ToSiteOverride). The storefront
// projects theme.logoMediaId from brand.logoLightMediaId (+ dark/favicon), with a
// non-primary site's brand_override merged over the base (public content route +
// site-brand.mergeBrand). undefined = leave as-is; null = set null (clear/inherit).
async function applyIdentityMedia(
  tx: TxClient,
  ctx: PropertyContext,
  input: UpdateSettingsInput
): Promise<void> {
  const present = IDENTITY_MEDIA_KEYS.filter((k) => input[k] !== undefined);
  if (present.length === 0) return;

  const property = await tx.property.findUnique({
    where: { id: ctx.propertyId },
    select: { isPrimary: true },
  });

  if (property?.isPrimary) {
    // Primary → the tenant base brand (recolours/rebrands every primary surface).
    const data: Prisma.TenantBrandUncheckedUpdateInput = {};
    for (const k of present) data[k] = input[k];
    await tx.tenantBrand.upsert({
      where: { tenantId: ctx.tenantId },
      create: { tenantId: ctx.tenantId, ...data } as Prisma.TenantBrandUncheckedCreateInput,
      update: data,
    });
    return;
  }

  // Non-primary → merge into the Property brand_override (only THIS site changes).
  const row = await tx.property.findUnique({
    where: { id: ctx.propertyId },
    select: { brandOverride: true },
  });
  const prev =
    row?.brandOverride && typeof row.brandOverride === 'object' && !Array.isArray(row.brandOverride)
      ? (row.brandOverride as Record<string, unknown>)
      : {};
  const next: Record<string, unknown> = { ...prev };
  for (const k of present) next[k] = input[k];
  await tx.property.update({
    where: { id: ctx.propertyId },
    data: { brandOverride: next as Prisma.InputJsonValue },
  });
}
