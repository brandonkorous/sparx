// Themes are now a marketplace category (docs/60 Phase 5). This standalone route
// permanently redirects to the marketplace's themes browse (a coming-soon teaser
// until the themes catalog is seeded in Phase 4).

import { permanentRedirect } from 'next/navigation';

export default function ThemesRedirect(): never {
  permanentRedirect('/market/themes');
}
