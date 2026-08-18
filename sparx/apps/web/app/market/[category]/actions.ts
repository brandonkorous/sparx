'use server';

// Cursor "Load more" for public browse (docs/60 D10). The client island calls
// this with the active filter/sort params + the opaque cursor; it returns the
// next page's items + the following cursor. The public catalog read is
// unauthenticated (no session to forward), so this is a thin pass-through to the
// data layer.

import { fetchCategory, type MarketplaceListing } from '@/lib/marketplace';

export async function loadMoreListings(
  category: string,
  query: Record<string, string>,
  cursor: string
): Promise<{ items: MarketplaceListing[]; next_cursor: string | null }> {
  const page = await fetchCategory(category, { ...query, cursor, limit: '24' });
  return { items: page.items, next_cursor: page.next_cursor };
}
