// The server-compiled tenant theme scoped to `.bx-canvas` — the brand a builder
// canvas previews in (colors, type, rounding), before any live Theme panel takes
// over. Shared by /builder/studio (the unified editor) AND the CMS entry editor's
// embedded record preview (docs/51 §6), so a content entry previews in the SAME
// brand the storefront ships — the canvas can't drift from production.
//
// Pure compile (no I/O), so it's safe to call from any server component; a failed
// compile degrades to '' and the canvas falls back to builder.css's neutral
// `--st-*` defaults rather than throwing.

import { buildThemeCssV2, compileThemeForTenant } from '@sparx/site-themes';
import type { BrandDto, SiteConfigDto } from '../_brand/lib/types';

export function canvasThemeCss(brand: BrandDto, config: SiteConfigDto): string {
  try {
    const compiled = compileThemeForTenant({
      themeKey: config.themeKey,
      brand,
      presentation: config.draftSettings.presentation ?? null,
    });
    return buildThemeCssV2(compiled, { rootSelector: '.bx-canvas' });
  } catch {
    return '';
  }
}
