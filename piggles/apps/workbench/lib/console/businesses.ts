'use client';

import { useQuery } from '@wizeworks/query';
import type { WorkbenchController } from '@/lib/workbench/controller';
import { saveLayout } from '@/lib/workbench/persistence';
import type { ConsoleBusiness } from '@/app/api/businesses/route';

// The businesses this person can act as, and the act of moving between them.
//
// ── THIS IS NOT THE SAME AXIS AS THE SITE SWITCHER ──────────────────────────
//
// A BUSINESS is a tenant: its own customers, products, invoices, staff, billing
// and row-level isolation. A SITE is one web property belonging to a business,
// and a business can own several. Both switchers live in the top bar and they
// are genuinely different questions — "whose books am I in" and "which of their
// shopfronts am I editing".
//
// Collapsing them into one control is the mistake to avoid: it would put
// "Copperleaf Studio" and "Copperleaf's second shop" in the same list, where
// choosing wrongly means either editing the wrong page or reading the wrong
// business's revenue. One of those is a mistake and the other is a breach.
//
// ── WHY THE SWITCH RELOADS ──────────────────────────────────────────────────
//
// Changing business changes EVERYTHING behind the screen: the site list, the
// active site, every module flag, every cached query, the dock arrangement
// (layouts are stored per site, and the sites themselves are about to change),
// and the tenant claim in the API token minted at /api/token.
//
// Reconciling all of that in place would mean invalidating every query, tearing
// down every open pane, and hoping nothing held a stale tenant id. A full reload
// is not the lazy option here — it is the only one that cannot leave one pane
// showing another business's data. The site switcher already works this way for
// the same reason.

export interface BusinessSummary {
  id: string;
  name: string;
  slug: string | null;
  /** The caller's role in THIS business. Owner in one, bookkeeper in another. */
  role: string;
}

/**
 * Every business this person is a member of.
 *
 * ── WHY THIS DOES NOT USE THE SHARED AUTH CLIENT ────────────────────────────
 *
 * It did, and it never worked here. `organization.list()` posts to `/api/auth/*`
 * on the current origin, and the console mounts no Better Auth handler by design
 * — so the request fell through to the catch-all page, came back as an HTML
 * document with a 200 status, and produced an empty list with no error. The
 * switcher correctly renders plain text when there is nothing to switch to, so
 * somebody belonging to three businesses saw one name and no control.
 *
 * The console's own `/api/businesses` reads the memberships server-side, where
 * the session already lives. Same guarantee as before and a stronger one: the
 * server never trusts a business id the browser supplies, so a business cannot
 * appear here — or be switched into — because a client asked nicely.
 */
export function useBusinesses() {
  return useQuery({
    queryKey: ['console', 'businesses'],
    queryFn: async (): Promise<BusinessSummary[]> => {
      const response = await fetch('/api/businesses', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Could not load your businesses');
      const body = (await response.json()) as ConsoleBusiness[];
      return body.map((business) => ({
        id: business.id,
        name: business.name,
        slug: business.slug || null,
        role: business.role,
      }));
    },
    // Memberships change rarely and an extra fetch per focus buys nothing.
    staleTime: 300_000,
  });
}

/**
 * Move the whole window into another business.
 *
 * Order matters and is the same order the site switch uses:
 *
 *   1. Ask the server to make it active. `setActive` re-checks membership, so a
 *      person who has been removed from a business gets an error here rather
 *      than a session pointing somewhere they no longer belong.
 *   2. Only then reload. Reloading first would race the cookie and land the
 *      window back in the business it started in, which reads as the switch
 *      silently failing.
 *
 * The caller is expected to have already dealt with unsaved work — this
 * function is destructive to everything on screen and deliberately says so in
 * its name rather than guarding internally, so the confirmation lives with the
 * UI that knows what is open.
 */
export async function switchBusiness(
  controller: WorkbenchController,
  currentSiteKey: string,
  businessId: string
): Promise<void> {
  // Flush the outgoing arrangement under the site being left, exactly as the
  // site switch does — the debounced auto-save may not have fired, and coming
  // back to a business whose desk has been tidied by a switch is its own small
  // betrayal.
  const grid = controller.serializeGrid();
  if (grid) saveLayout(currentSiteKey, grid, controller.snapshotDescriptors());

  const response = await fetch('/api/businesses', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ organizationId: businessId }),
  });
  if (!response.ok) {
    throw new Error('Could not switch business');
  }

  // The active-SITE cookie is deliberately left alone, and that is not an
  // oversight — it is relying on a property the platform already guarantees.
  //
  // After the switch that cookie still names a site in the business being left.
  // It does no harm: /api/token forwards it only as a HINT, and api-rest
  // "fails closed to the tenant's primary property" when the hint names
  // something the tenant does not own (see app/api/token/route.ts and the same
  // note in `switchSite`). So the incoming business resolves to its
  // own primary site and the stale value is discarded server-side.
  //
  // The tempting fix — POST /api/active-site with null to clear it — does not
  // work anyway: that route requires a non-empty string and answers 400. Adding
  // a clear verb to a shared route to solve a problem RLS already solves would
  // be shared-code churn for nothing.

  // Tell the controller the teardown is deliberate BEFORE navigating. Without
  // it the dock's `beforeunload` guard fires on any unsaved pane, the browser
  // cancels the navigation, and the session is left pointing at the new business
  // while the window still shows the old one — the switcher appears to do
  // nothing, which is the worst way for this particular control to fail.
  controller.markIntentionalUnload();

  // `replace`, not `assign`: the address being left names a record in the
  // business we are leaving, and keeping it in history means Back walks into a
  // pane that cannot load.
  window.location.replace('/');
}
