'use client';

// Numbered pagination for the PLP / category / search grids. All state is in the
// URL — this reads the current query string and pushes a new `page` on change,
// preserving every other facet. A client island (silicaui <Pagination> is
// controlled); hidden when there's a single page.

import { useRouter, useSearchParams } from 'next/navigation';
import { Pagination } from '@wizeworks/silicaui-react';

export function MarketPager({
  basePath,
  page,
  totalPages,
}: {
  basePath: string;
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function goTo(target: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (target > 1) params.set('page', String(target));
    else params.delete('page');
    const s = params.toString();
    router.push(s ? `${basePath}?${s}` : basePath);
  }

  return (
    <nav className="flex justify-center pt-10" aria-label="Pagination">
      <Pagination page={page} count={totalPages} onChange={goTo} color="primary" size="sm" />
    </nav>
  );
}
