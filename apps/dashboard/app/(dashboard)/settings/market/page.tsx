import { redirect } from 'next/navigation';

// sparx.market management moved into the Commerce module — it's a first-party sales
// channel (join, seller profile, listed products), not a platform setting, and the
// API already gates it on Commerce. This redirect keeps old links and bookmarks
// working; the money (settlement + payouts) stays in Finance → Payouts.
export default function MarketSettingsRedirect(): never {
  redirect('/commerce/market');
}
