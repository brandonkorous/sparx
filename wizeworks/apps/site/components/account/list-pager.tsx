'use client';

// Previous and Next under a list on the account pages, with which ones are
// shown, of how many. Draws nothing when everything fits on one page.
//
// The Orders page had none, so a buyer's 11th order could not be reached; six
// other lists each kept their own copy, saying it three ways (sparx persona
// issue 194). One pager now. It counts by offset; a page that counts by page
// number converts at the call.

import { Button } from '@wizeworks/silicaui-react';

import { pagerWords } from '@/lib/pager-words';

export function ListPager({
  offset,
  pageSize,
  total,
  onMove,
}: {
  /** How many come before the first one shown. */
  offset: number;
  pageSize: number;
  total: number;
  /** The offset of the page to show next. */
  onMove: (offset: number) => void;
}) {
  const words = pagerWords(offset, pageSize, total);
  if (words === null) return null;
  return (
    <nav aria-label="More of this list" className="mt-4 flex items-center justify-between gap-3">
      <Button
        type="button"
        color="primary"
        variant="outline"
        disabled={offset === 0}
        onClick={() => onMove(Math.max(0, offset - pageSize))}
      >
        Previous
      </Button>
      <span className="text-base-content text-sm">{words}</span>
      <Button
        type="button"
        color="primary"
        variant="outline"
        disabled={offset + pageSize >= total}
        onClick={() => onMove(offset + pageSize)}
      >
        Next
      </Button>
    </nav>
  );
}
