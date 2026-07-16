import type { Metadata } from 'next';
import { THEME_PRESETS, type Theme } from '@wizeworks/silicaui-html';
import { EMAIL_SOURCES, toSilicaDataSources } from '@sparx/builder-schemas';
import { compileThemeForTenant, compiledToSilicaTheme } from '@sparx/site-themes';

import { resolveSiteScope } from '@/lib/sites';
import { getEmailBindingCatalog, listEmails, listEmailsForProperty } from '../_lib/api';
import { getBrand, getConfig } from '../_brand/lib/api';
import { applyBrandOverride } from '../_brand/lib/site-brand';
import type { BrandDto, SiteConfigDto } from '../_brand/lib/types';
import { buildPreviewData } from '../_builder/binding-catalog';
import { EmailSilicaStudio } from '../_builder/email-silica-studio';

// /builder/email — the Email Builder on the silica engine (docs/120). silicaui
// 0.17's `<EmailBuilder>` owns the editor chrome + the document fields
// (subject/preheader); sparx keeps the catalog + lifecycle (switch · new · rename ·
// delete · fork-for-this-site · publish) and persists the whole `EmailDocument`
// through the debounced sync. The legacy `.bx-*` EmailBuilderApp is retired; an
// email not yet authored on silica still SENDS through its stored sparx tree
// (parallel-run) until it's re-authored and published here.

export const metadata: Metadata = {
  title: 'Builder · Email',
};

const FALLBACK_BRAND: BrandDto = {
  tenantId: '',
  businessName: 'Workspace',
  tagline: null,
  logoLightMediaId: null,
  logoDarkMediaId: null,
  faviconMediaId: null,
  colorPrimary: null,
  colorPrimaryForeground: null,
  colorAccent: null,
  colorAccentForeground: null,
  colorSecondary: null,
  colorSecondaryForeground: null,
  fontHeading: null,
  fontBody: null,
  tokens: null,
};

const FALLBACK_CONFIG: SiteConfigDto = {
  tenantId: '',
  themeKey: 'default',
  appearancePolicy: 'auto',
  draftSettings: {},
  publishedVersionId: null,
  createdAt: '',
  updatedAt: '',
};

/** The tenant's compiled brand as a silica `Theme` — seeds new blocks on-brand.
 *  Authoring convenience only: the SEND re-resolves the real email brand and
 *  composes the branded frame (docs/120 D2), so this never decides the shipped look. */
function tenantTheme(brand: BrandDto, config: SiteConfigDto): Theme | undefined {
  try {
    const compiled = compileThemeForTenant({
      themeKey: config.themeKey,
      brand,
      presentation: config.draftSettings.presentation ?? null,
    });
    return compiledToSilicaTheme(compiled, config.themeKey);
  } catch {
    return undefined;
  }
}

/** The emails the editor opens — the active site's view for a multi-site tenant
 *  (docs/49 Phase 7b), else the tenant-wide catalog. Defensive cascade to []. */
async function loadEmails(propertyId: string | undefined) {
  try {
    return propertyId ? await listEmailsForProperty(propertyId) : await listEmails();
  } catch {
    try {
      return await listEmails();
    } catch {
      return [];
    }
  }
}

export default async function BuilderEmailRoute() {
  // The active site (docs/49): a multi-site tenant authors ONE site at a time; a
  // single-site tenant gets `undefined` and the tenant-wide catalog. `activeSite`
  // gates the per-site fork affordance + the override badge.
  const scope = await resolveSiteScope().catch(() => null);
  const activePropertyId = scope?.activePropertyId;
  const activeSite =
    scope && activePropertyId ? scope.sites.find((s) => s.id === activePropertyId) : undefined;

  const [catalog, baseBrand, config, emails] = await Promise.all([
    getEmailBindingCatalog().catch(() => ({ sources: [] })),
    getBrand().catch(() => FALLBACK_BRAND),
    getConfig().catch(() => FALLBACK_CONFIG),
    loadEmails(activePropertyId),
  ]);

  if (emails.length === 0) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <div className="border-base-300 text-base-content rounded-xl border border-dashed p-12 text-center">
          Couldn’t load your emails. Check that the Builder module is enabled, then reload.
        </div>
      </div>
    );
  }

  // The tenant's real email binding catalog drives the picker + the resolver root;
  // fall back to the code-defined email sources when the fetch fails so the editor
  // always opens with a working binding picker.
  const sources = catalog.sources.length ? catalog.sources : [...EMAIL_SOURCES];
  const root = buildPreviewData(sources, null);
  const dataSources = toSilicaDataSources(sources);

  // Preview in this site's brand (the base for the primary site, else the base with
  // this site's override applied) — the same merge the send path does.
  const effectiveBrand =
    (activeSite?.isPrimary ?? true)
      ? baseBrand
      : applyBrandOverride(baseBrand, activeSite?.brandOverride);
  const theme: Theme = tenantTheme(effectiveBrand, config) ?? THEME_PRESETS[0]!;

  return (
    <EmailSilicaStudio
      initialEmails={emails}
      theme={theme}
      dataSources={dataSources}
      root={root}
      site={
        activePropertyId && activeSite
          ? { propertyId: activePropertyId, name: activeSite.name }
          : undefined
      }
    />
  );
}
