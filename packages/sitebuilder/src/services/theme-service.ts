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

export async function selectTheme(ctx: ServiceContext, rawInput: unknown): Promise<SiteConfig> {
  const input = SelectThemeInput.parse(rawInput);
  const slug = input.themeKey;
  const updated = await withTenant(ctx, async (tx) => {
    const config = await getOrCreateConfig(tx, ctx.tenantId);

    // Resolve the slug: a marketplace DATA theme carries its full preset in
    // `tokens`; the 6 code foundations resolve by key. (docs/85 §7)
    const row = await tx.marketplaceTheme.findFirst({ where: { slug }, select: { tokens: true } });
    const dataPreset = (row?.tokens ?? null) as { v1?: unknown; v2?: unknown } | null;
    const isData = Boolean(dataPreset?.v1 && dataPreset?.v2);
    if (!isData && !isThemeKey(slug)) {
      throw new SitebuilderNotFoundError('Theme', slug);
    }

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
