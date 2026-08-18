// The public extension catalog moved to /market (docs/60 Phase 5). This old route
// permanently redirects to keep any external links working.
//
// The move was originally motivated by a planned sparx.market → sparx.works/market
// Caddy 301. That redirect no longer exists: sparx.market is now its own deployed
// app (sparx/apps/market) serving a different product. The /market path stands on its
// own merits — do not "restore" the redirect on the strength of this route.

import { permanentRedirect } from 'next/navigation';

export default function MarketplaceRedirect(): never {
  permanentRedirect('/market');
}
