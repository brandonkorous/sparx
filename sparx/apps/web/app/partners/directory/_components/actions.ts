'use server';

// Cursor "Load more" for the public partner directory. The client island calls
// this with the active filter params + the opaque cursor; it returns the next
// page's partners + the following cursor. The public read is unauthenticated, so
// this is a thin pass-through to the data layer.

import { fetchPartners, type PartnerCard } from '@/lib/partners';

export async function loadMorePartners(
  query: Record<string, string>,
  cursor: string
): Promise<{ items: PartnerCard[]; next_cursor: string | null }> {
  const page = await fetchPartners({ ...query, cursor, limit: '24' });
  return { items: page.items, next_cursor: page.next_cursor };
}
