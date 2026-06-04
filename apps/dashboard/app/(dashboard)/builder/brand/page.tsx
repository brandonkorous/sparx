import { ModuleProvider } from '@sparx/ui';
import { getBrand, getConfig, listSavedThemes, resolveMediaUrl } from '../../sitebuilder/_lib/api';
import { ThemeCenter } from '../../sitebuilder/_components/theme-center';

// The Builder's bx-toolbar/bx-ctx classes — loaded here so the Brand & Theme
// editor wears the SAME toolbar as /builder/page and /builder/site (docs/45).
import '../builder.css';

// Brand & Theme, hosted in the Builder module. The tenant brand (colors, type,
// rounding) + theme that the storefront, email, and Builder canvas render with.
//
// RE-USES the Brand & Theme surface (server loaders + ThemeCenter) from the now-
// deprecated Site Builder module, so this exercises the REAL save/publish path —
// server actions → PATCH /v1/brand + the site config, publish → compiled into the
// live storefront theme — rather than a forked copy that could drift. ThemeCenter
// now renders the shared Builder toolbar (theme switcher · new/rename/delete ·
// Light/Dark · Save · Publish), so the brand page matches the other Builder
// surfaces. When Site Builder is fully retired the components physically relocate
// here; no behavior change.
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
      <ThemeCenter
        brand={brand}
        config={config}
        savedThemes={savedThemes}
        media={{ logoLight, logoDark, favicon }}
      />
    </ModuleProvider>
  );
}
