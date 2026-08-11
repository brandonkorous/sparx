// themeService — theme catalog + per-tenant theme selection and settings.
//
// listThemes is static (no tenant). selectTheme/updateSettings
// mutate the draft SiteConfig; they do NOT publish — changes go live only when
// publishService.publishNow runs.

import { SelectThemeInput, UpdateSettingsInput } from '@sparx/sitebuilder-schemas';
import type { Prisma, SiteConfig, TxClient } from '@sparx/db';
import { withTenant } from '@sparx/db';
import { FIRST_PARTY_THEMES, firstPartyTheme, type FirstPartyTheme } from '@sparx/silica-catalog';

import { writeAuditLog } from '../audit';
import { publishSitebuilderEvent } from '../events';
import { SitebuilderNotFoundError, type PropertyContext } from '../errors';
import { getOrCreateConfig } from './_config';
import { themePresetFor } from './theme-preset';
import { readDraftThemeSlices, syncSilicaDraftTheme } from './silica-theme-sync';

// ── Static catalog (no tenant) ──────────────────────────────────────────────

/** One theme as the catalog surfaces it: what it's called and what it's for.
 *  Deliberately NOT the palette — a caller listing themes is choosing between
 *  them, and shipping forty full token bags to answer "what can I pick" is a
 *  payload nobody reads. `get_silica_theme` returns the tokens for one. */
export interface ThemeSummary {
  slug: string;
  name: string;
  /** Which shelf the theme sits on, taken from the catalog rather than spelled
   *  again here. A second copy of the union is a second thing to remember: this
   *  one said `'sparx' | 'silica'` and went stale the moment the content,
   *  template and portfolio shelves were added upstream. */
  shelf: FirstPartyTheme['shelf'];
  tagline: string;
  description: string;
  industry: string;
  mood: string;
  colorFamily: string;
  density: string;
}

/** Every theme sparx ships — the same list the marketplace serves, from the same
 *  code (`FIRST_PARTY_THEMES`). Deliberately not a count: the catalog grows, and
 *  a number written here is a claim that goes quietly wrong when it does.
 *
 *  This returned `THEME_LIST`: six presets that predated the silica catalog, were
 *  reachable from no picker, and matched no row on any cluster. So the builder's
 *  "which themes exist" answer and the marketplace's disagreed — six against forty —
 *  and the six were the ones `selectTheme` would accept. */
const title = (slug: string): string => slug.charAt(0).toUpperCase() + slug.slice(1);

export function listThemes(): ThemeSummary[] {
  return FIRST_PARTY_THEMES.map(({ slug, shelf, meta }) => ({
    slug,
    name: title(slug),
    shelf,
    tagline: meta.tagline,
    description: meta.description,
    industry: meta.industry,
    mood: meta.mood,
    colorFamily: meta.colorFamily,
    density: meta.density,
  }));
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

  // Resolve the slug, first-party FIRST. sparx's forty themes are CODE
  // (`FIRST_PARTY_THEMES`), so they resolve on every cluster with nothing ingested
  // and no storage read; a tenant/partner upload is the one that genuinely arrives at
  // runtime, and it resolves from its storage artifact (docs/85 §7).
  //
  // The order matters as a guard, not just as an optimisation: checking code first is
  // what stops an uploaded row named `clinic` from redefining a shipped theme for the
  // tenant who published it. It mirrors the marketplace adapter, which serves the same
  // union under the same precedence.
  const shipped = firstPartyTheme(slug);
  const dataPreset =
    !shipped && resolution.resolveDataPreset ? await resolution.resolveDataPreset(slug) : null;
  const preset = shipped ? themePresetFor(shipped.theme) : dataPreset;
  if (preset == null) {
    throw new SitebuilderNotFoundError('Theme', slug);
  }

  const updated = await withTenant(ctx, async (tx) => {
    const config = await getOrCreateConfig(tx, ctx.tenantId, ctx.propertyId);

    // Carry the resolved preset inline in draftSettings so every downstream compile
    // is self-contained — no registry lookup, no marketplace read at render.
    //
    // A non-marketplace pick used to DELETE this key and lean on `themeKey` alone,
    // because the six code presets could be resolved from it. Nothing resolves a key
    // any more, so clearing the preset is how a site ends up compiling the platform
    // default while its config says otherwise. Always write what was picked.
    const draftSettings: Record<string, unknown> = {
      ...((config.draftSettings as Record<string, unknown> | null) ?? {}),
      themePreset: preset,
    };

    const next = await tx.siteConfig.update({
      where: { tenantId_propertyId: { tenantId: ctx.tenantId, propertyId: ctx.propertyId } },
      data: { themeKey: slug, draftSettings: draftSettings as Prisma.InputJsonValue },
    });
    // Write the pick THROUGH to the silica theme. Without this, selecting a theme
    // recoloured the builder canvas (which derives its preview from these very
    // columns) and left the live site on the platform base — see silica-theme-sync.
    // `themePreset` is passed so a MARKETPLACE data theme compiles from the artifact
    // it carries; its slug is not in the code registry and would otherwise miss.
    await syncSilicaDraftTheme(tx, ctx.tenantId, ctx.propertyId, {
      themeKey: slug,
      presentation: readDraftThemeSlices(draftSettings).presentation,
      themePreset: draftSettings.themePreset,
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
    const next = await tx.siteConfig.update({
      where: { tenantId_propertyId: { tenantId: ctx.tenantId, propertyId: ctx.propertyId } },
      data: {
        ...(merged !== undefined ? { draftSettings: merged as Prisma.InputJsonValue } : {}),
        ...(input.appearancePolicy !== undefined
          ? { appearancePolicy: input.appearancePolicy }
          : {}),
      },
    });
    // A settings change that touched the LOOK has to reach the silica theme too, or
    // the presentation overlay edited here only ever moves the builder's preview.
    // Skipped when the caller sent no settings (an appearance-policy-only call changes
    // which palette is offered, not what either palette contains).
    if (merged !== undefined) {
      const slices = readDraftThemeSlices(merged);
      await syncSilicaDraftTheme(tx, ctx.tenantId, ctx.propertyId, {
        themeKey: next.themeKey,
        presentation: slices.presentation,
        themePreset: slices.themePreset,
      });
    }
    return next;
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
