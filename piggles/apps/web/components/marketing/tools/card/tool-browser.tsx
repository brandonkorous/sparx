'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Input, NativeSelect } from '@wizeworks/silicaui-react';
import { FilterChips, type ChipOption } from './filter-chips';

export interface BrowserItem {
  slug: string;
  name: string;
  tagline: string;
  keywords: string;
  group: string;
  /** Rendered on the server, so the QR and barcode encoders never reach the
   *  client bundle. */
  card: ReactNode;
}

type Sort = 'a-z' | 'z-a';

/** Search, filter and sort over the whole set. No sections: the grouping is a
 *  filter you apply, not a wall you scroll past. */
export function ToolBrowser({ items, groups }: { items: BrowserItem[]; groups: ChipOption[] }) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [sort, setSort] = useState<Sort>('a-z');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = items.filter((item) => {
      if (group !== 'all' && item.group !== group) return false;
      if (q === '') return true;
      return `${item.name} ${item.tagline} ${item.keywords}`.toLowerCase().includes(q);
    });
    return matches.sort((a, b) =>
      sort === 'a-z' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    );
  }, [items, query, group, sort]);

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Input
          size="lg"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search — invoice, QR, colors…"
          aria-label="Search the tools"
          className="lg:max-w-sm"
        />
        <NativeSelect
          size="lg"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Sort the tools"
          className="lg:w-52"
        >
          <option value="a-z">A to Z</option>
          <option value="z-a">Z to A</option>
        </NativeSelect>
      </div>

      <div className="mt-5">
        <FilterChips options={groups} value={group} onChange={setGroup} />
      </div>

      <p className="mt-5 text-base" aria-live="polite">
        {shown.length === items.length
          ? `All ${items.length} tools.`
          : `${shown.length} of ${items.length}.`}
      </p>

      {shown.length > 0 ? (
        // Masonry via CSS columns. The previews are genuinely different shapes —
        // a square QR, a wide barcode, a tall policy — so a grid leaves ragged
        // gaps under the short ones. Columns pack them tight, need no JS, and
        // cannot shift after paint.
        <div className="mt-5 columns-1 gap-4 sm:columns-2 lg:columns-3">
          {shown.map((item) => (
            <div key={item.slug} className="mb-4 break-inside-avoid">
              {item.card}
            </div>
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-lg">
          Nothing matches “{query}”. Try a plainer word — “invoice”, “code”, “color”.
        </p>
      )}
    </div>
  );
}
