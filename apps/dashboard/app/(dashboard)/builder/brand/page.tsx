import { ModuleProvider } from '@sparx/ui';
import { getBrand, getConfig, listSavedThemes, resolveMediaUrl } from '../../sitebuilder/_lib/api';
import { ThemeCenter } from '../../sitebuilder/_components/theme-center';

// Brand & Theme, hosted in the Builder module. The tenant brand (colors, type,
// rounding) that every page canvas renders with — the source of truth read by
// the storefront, email, and (soon) the Builder canvas preview.
//
// For now this RE-USES the existing Brand & Theme surface from the Site Builder
// module verbatim (server data loaders + ThemeCenter), so the new home exercises
// the REAL save path — server actions → PATCH /v1/brand and the site config —
// rather than a forked copy that could drift. Site Builder is untouched and its
// own /sitebuilder/brand keeps working. When Site Builder is retired the
// components physically relocate here and these two import paths update; no
// behavior change.
export default async function BuilderBrandPage() {
  const [brand, config, savedThemes] = await Promise.all([
    getBrand(),
    getConfig(),
    listSavedThemes(),
  ]);
  const [logoLight, logoDark, favicon] = await Promise.all([
    resolveMediaUrl(brand.logoLightMediaId),
    resolveMediaUrl(brand.logoDarkMediaId),
    resolveMediaUrl(brand.faviconMediaId),
  ]);

  return (
    <ModuleProvider module="builder">
      <div className="px-6 py-8 lg:px-10">
        <ThemeCenter
          brand={brand}
          config={config}
          savedThemes={savedThemes}
          media={{ logoLight, logoDark, favicon }}
        />
      </div>
    </ModuleProvider>
  );
}
