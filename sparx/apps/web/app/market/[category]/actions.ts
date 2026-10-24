'use server';

// Cursor "Load more" for public browse (docs/60 D10). The client island calls
// this with the active filter/sort params + the opaque cursor; it returns the
// next page's items + the following cursor. The public catalog read is
// unauthenticated (no session to forward), so this is a thin pass-through to the
// data layer.

import { MAX_FACET_SELECTIONS, countFacetSelections } from '@/lib/browse-params';
import { fetchCategory, type MarketplaceListing } from '@/lib/marketplace';
import { orWhenUnavailable } from '@/lib/public-api';

export async function loadMoreListings(
  category: string,
  query: Record<string, string>,
  cursor: string
): Promise<{ items: MarketplaceListing[]; next_cursor: string | null }> {
  // A server action is a public POST endpoint, so it holds the same facet cap
  // the browse page does — otherwise it is the uncapped way to the same reads.
  if (countFacetSelections(category, query) > MAX_FACET_SELECTIONS) {
    return { items: [], next_cursor: null };
  }
  const page = await orWhenUnavailable(
    fetchCategory(category, { ...query, cursor, limit: '24' }),
    null
  );
  // api-rest did not answer: keep the cursor so "Load more" can be pressed again.
  if (!page) return { items: [], next_cursor: cursor };
  return { items: page.items, next_cursor: page.next_cursor };
}
