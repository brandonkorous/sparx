// The public marketplace moved to /market (docs/60 Phase 5) so the sparx.market
// vanity domain (Caddy 301 → sparx.works/market) lands directly on it. This old
// route permanently redirects to keep any external links working.

import { permanentRedirect } from 'next/navigation';

export default function MarketplaceRedirect(): never {
  permanentRedirect('/market');
}
