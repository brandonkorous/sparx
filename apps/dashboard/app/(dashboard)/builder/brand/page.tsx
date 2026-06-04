import { ModuleProvider } from '@sparx/ui';
import { getBrand, getConfig, listSavedThemes, resolveMediaUrl } from '../_brand/lib/api';
import { ThemeCenter } from '../_brand/components/theme-center';

// The Builder's bx-toolbar/bx-ctx classes — loaded here so the Brand & Theme
// editor wears the SAME toolbar as /builder/page and /builder/site (docs/45).
import '../builder.css';

// Brand & Theme, hosted in the Builder module. The tenant brand (colors, type,
// rounding) + theme that the site, email, and Builder canvas render with.
//
// The Brand & Theme surface (server loaders + ThemeCenter) lives under ./_brand —
// the REAL save/publish path: server actions → PATCH /v1/brand + the site config,
// publish → compiled into the live site theme. ThemeCenter renders the shared
// Builder toolbar (theme switcher · new/rename/delete · Light/Dark · Save ·
// Publish), so the brand page matches the other Builder surfaces.
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
