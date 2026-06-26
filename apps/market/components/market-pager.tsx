// Server-rendered pagination for the PLP / category / search grids. All state is
// in the URL, so this is a pure server component emitting prev/next links that
// preserve the current query string (only `page` changes). Hidden when there's a
// single page.

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@sparx/ui';

export function MarketPager({
  basePath,
  searchParams,
  page,
  totalPages,
}: {
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  function hrefFor(targetPage: number): string {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === 'page' || value === undefined) continue;
      qs.set(key, Array.isArray(value) ? (value[0] ?? '') : value);
    }
    if (targetPage > 1) qs.set('page', String(targetPage));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav className="mx-pager" aria-label="Pagination">
      <Button
        asChild={hasPrev}
        color="neutral"
        variant="outline"
        size="sm"
        disabled={!hasPrev}
        aria-label="Previous page"
      >
        {hasPrev ? (
          <Link href={hrefFor(page - 1)} rel="prev">
            <ChevronLeft size={16} aria-hidden />
            Prev
          </Link>
        ) : (
          <span>
            <ChevronLeft size={16} aria-hidden />
            Prev
          </span>
        )}
      </Button>

      <span className="mx-pager__info">
        Page {page} of {totalPages}
      </span>

      <Button
        asChild={hasNext}
        color="neutral"
        variant="outline"
        size="sm"
        disabled={!hasNext}
        aria-label="Next page"
      >
        {hasNext ? (
          <Link href={hrefFor(page + 1)} rel="next">
            Next
            <ChevronRight size={16} aria-hidden />
          </Link>
        ) : (
          <span>
            Next
            <ChevronRight size={16} aria-hidden />
          </span>
        )}
      </Button>
    </nav>
  );
}
