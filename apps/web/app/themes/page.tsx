// Themes are now an extension-catalog category (docs/60 Phase 5). This standalone
// route permanently redirects to the catalog's themes browse, which is live
// (`status: 'live'` in lib/marketplace-registry.ts) — not the coming-soon teaser
// it was when this redirect was written.

import { permanentRedirect } from 'next/navigation';

export default function ThemesRedirect(): never {
  permanentRedirect('/market/themes');
}
