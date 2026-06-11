// themeService — theme catalog + per-tenant theme selection and settings.
//
// listThemes/getThemeSchema are static (no tenant). selectTheme/updateSettings
// mutate the draft SiteConfig; they do NOT publish — changes go live only when
// publishService.publishNow runs.

import { SelectThemeInput, UpdateSettingsInput } from '@sparx/sitebuilder-schemas';
import type { Prisma, SiteConfig } from '@sparx/db';
import { withTenant } from '@sparx/db';
import { getTheme, isThemeKey, THEME_LIST, type ThemePreset } from '@sparx/site-themes';

import { writeAuditLog } from '../audit';
import { publishSitebuilderEvent } from '../events';
import { SitebuilderNotFoundError, type ServiceContext } from '../errors';
import { getOrCreateConfig } from './_config';

// ── Static catalog (no tenant) ──────────────────────────────────────────────

export function listThemes(): ThemePreset[] {
  return THEME_LIST;
}

export function getThemeSchema(themeKey: string): ThemePreset['settingsSchema'] {
  return getTheme(themeKey).settingsSchema;
}

// ── Per-tenant config ───────────────────────────────────────────────────────

export function getConfig(ctx: ServiceContext): Promise<SiteConfig> {
  return withTenant(ctx, (tx) => getOrCreateConfig(tx, ctx.tenantId));
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
  ctx: ServiceContext,
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
    const config = await getOrCreateConfig(tx, ctx.tenantId);

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
      where: { tenantId: ctx.tenantId },
      data: { themeKey: slug, draftSettings: draftSettings as Prisma.InputJsonValue },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'sitebuilder.theme.selected',
      entityType: 'SiteConfig',
      entityId: ctx.tenantId,
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

export async function updateSettings(ctx: ServiceContext, rawInput: unknown): Promise<SiteConfig> {
  const input = UpdateSettingsInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const config = await getOrCreateConfig(tx, ctx.tenantId);
    if (input.settings === undefined && input.appearancePolicy === undefined) {
      return config;
    }
    return tx.siteConfig.update({
      where: { tenantId: ctx.tenantId },
      data: {
        ...(input.settings !== undefined ? { draftSettings: input.settings } : {}),
        ...(input.appearancePolicy !== undefined
          ? { appearancePolicy: input.appearancePolicy }
          : {}),
      },
    });
  });
}
