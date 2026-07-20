'use client';

// The cursor "Load more" island for the partner directory. The page renders the
// first page server-side; this appends subsequent pages via the server action,
// holding appended items + the live cursor in client state. Filter changes are
// full navigations (they remount this with a fresh initialCursor), so appended
// state resets correctly.

import * as React from 'react';
import { Button } from '@wizeworks/silicaui-react';
import type { PartnerCard } from '@/lib/partners';
import { PartnerDirectoryCard } from './partner-card';
import { loadMorePartners } from './actions';

export function LoadMorePartners({
  query,
  initialCursor,
}: {
  query: Record<string, string>;
  initialCursor: string;
}) {
  const [items, setItems] = React.useState<PartnerCard[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(initialCursor);
  const [pending, startTransition] = React.useTransition();

  function onMore(): void {
    if (!cursor) return;
    const at = cursor;
    startTransition(async () => {
      const res = await loadMorePartners(query, at);
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.next_cursor);
    });
  }

  return (
    <>
      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <PartnerDirectoryCard key={p.id} partner={p} />
          ))}
        </div>
      ) : null}
      {cursor ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onMore} loading={pending} disabled={pending}>
            Load more
          </Button>
        </div>
      ) : null}
    </>
  );
}
