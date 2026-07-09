'use client';

// The cursor "Load more" island (docs/60 D10). The browse page renders the first
// page server-side; this appends subsequent pages via the server action, holding
// the appended items + the live cursor in client state. The button hides when the
// cursor runs out. Filter/sort changes are full navigations (they remount this
// island with a fresh initialCursor), so appended state resets correctly.

import * as React from 'react';
import { Button } from '@wizeworks/silicaui-react';

import type { MarketplaceListing } from '@/lib/marketplace';

import { ListingCard } from '../_components/listing-card';
import { loadMoreListings } from './actions';

export function LoadMore({
  category,
  query,
  initialCursor,
}: {
  category: string;
  query: Record<string, string>;
  initialCursor: string;
}) {
  const [items, setItems] = React.useState<MarketplaceListing[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(initialCursor);
  const [pending, startTransition] = React.useTransition();

  function onMore(): void {
    if (!cursor) return;
    const at = cursor;
    startTransition(async () => {
      const res = await loadMoreListings(category, query, at);
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.next_cursor);
    });
  }

  return (
    <>
      {items.length > 0 ? (
        <div className="mkt-grid-3-2-1">
          {items.map((item) => (
            <ListingCard key={item.id} item={item} />
          ))}
        </div>
      ) : null}
      {cursor ? (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Button variant="outline" onClick={onMore} loading={pending} disabled={pending}>
            Load more
          </Button>
        </div>
      ) : null}
    </>
  );
}
