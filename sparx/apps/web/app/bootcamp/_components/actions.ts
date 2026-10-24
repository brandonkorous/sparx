'use server';

// Cursor "Load more" for the public bootcamp directory. Thin pass-through to the
// data layer (the public read is unauthenticated). The client island calls this
// with the active filter params + the opaque cursor.

import { fetchBootcamps, type BootcampCard } from '@/lib/bootcamp';
import { orWhenUnavailable } from '@/lib/public-api';

export async function loadMoreBootcamps(
  query: Record<string, string>,
  cursor: string
): Promise<{ items: BootcampCard[]; next_cursor: string | null }> {
  const page = await orWhenUnavailable(fetchBootcamps({ ...query, cursor, limit: '24' }), null);
  // api-rest did not answer: keep the cursor so "Load more" can be pressed again.
  if (!page) return { items: [], next_cursor: cursor };
  return { items: page.items, next_cursor: page.next_cursor };
}
