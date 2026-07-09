'use client';

// Cursor "Load more" island for the bootcamp directory. The page renders the
// first page server-side; this appends subsequent pages via the server action.
// Filter changes are full navigations (remount with a fresh initialCursor), so
// appended state resets correctly.

import * as React from 'react';
import { Button } from '@wizeworks/silicaui-react';
import type { BootcampCard } from '@/lib/bootcamp';
import { BootcampDirectoryCard } from './bootcamp-card';
import { loadMoreBootcamps } from './actions';

export function LoadMoreBootcamps({
  query,
  initialCursor,
}: {
  query: Record<string, string>;
  initialCursor: string;
}) {
  const [items, setItems] = React.useState<BootcampCard[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(initialCursor);
  const [pending, startTransition] = React.useTransition();

  function onMore(): void {
    if (!cursor) return;
    const at = cursor;
    startTransition(async () => {
      const res = await loadMoreBootcamps(query, at);
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.next_cursor);
    });
  }

  return (
    <>
      {items.length > 0 ? (
        <div className="mkt-grid-3-2-1">
          {items.map((b) => (
            <BootcampDirectoryCard key={b.id} bootcamp={b} />
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
