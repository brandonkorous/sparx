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

// The `settings` keys the CALLER actually supplied, before Zod fills its defaults.
// `SiteSettings` defaults `tokens` and `customCss`, so a parse of `{presentation}`
// alone comes back carrying `customCss: ''` — indistinguishable from an explicit
// blanking. Reading the raw object keeps "sent" and "defaulted" apart so the merge
// below only touches what was really asked for.
function suppliedSettingKeys(rawInput: unknown): Set<string> {
  if (!rawInput || typeof rawInput !== 'object') return new Set();
  const s = (rawInput as { settings?: unknown }).settings;
  if (!s || typeof s !== 'object' || Array.isArray(s)) return new Set();
  return new Set(Object.keys(s));
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
    // MERGE, don't replace. `draftSettings` is one blob holding several independently
    // owned slices — the token overlay, `customCss`, the v2 `presentation`, and the
    // `activeSavedThemeId` pointer stamped by savedThemeService.apply. Assigning
    // `input.settings` wholesale meant a caller updating ONE slice silently destroyed
    // the others: sending `{tokens}` dropped the applied theme's presentation AND its
    // pointer, so the site reverted to its base preset with no error anywhere.
    const merged = ((): Record<string, unknown> | undefined => {
      if (input.settings === undefined) return undefined;
      const prev = (config.draftSettings ?? {}) as Record<string, unknown>;
      const supplied = suppliedSettingKeys(rawInput);
      const next: Record<string, unknown> = { ...prev };
      for (const [k, v] of Object.entries(input.settings)) {
        if (supplied.has(k)) next[k] = v;
      }
      return next;
    })();
    return tx.siteConfig.update({
      where: { tenantId_propertyId: { tenantId: ctx.tenantId, propertyId: ctx.propertyId } },
      data: {
        ...(merged !== undefined ? { draftSettings: merged as Prisma.InputJsonValue } : {}),
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

// Write the site's logo/favicon media ids to the site's OWN brand scope — its
// Property `brand_override` — mirroring the colour/font path
// (applyThemeBrandToSiteOverrideWithinTx). The storefront projects
// theme.logoMediaId from brand.logoLightMediaId (+ dark/favicon), with the site's
// brand_override merged over the tenant base (public content route +
// site-brand.mergeBrand). undefined = leave as-is; null = set null (clear/inherit).
//
// The primary site is NOT special-cased. It used to write straight to TenantBrand,
// which is the default every unbranded sibling inherits — so attaching a logo to
// the primary put that logo on every other site in the tenant (the wize.works →
// silicaui leak). A logo set on one site belongs to that site alone.
async function applyIdentityMedia(
  tx: TxClient,
  ctx: PropertyContext,
  input: UpdateSettingsInput
): Promise<void> {
  const present = IDENTITY_MEDIA_KEYS.filter((k) => input[k] !== undefined);
  if (present.length === 0) return;

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
