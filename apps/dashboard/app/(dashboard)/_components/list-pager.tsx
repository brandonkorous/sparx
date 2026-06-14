'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Pager } from '@sparx/ui';

import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/lib/pagination';

// URL-sync wrapper around the presentational `@sparx/ui` Pager (docs/34 §7
// follow-up). Owns all Next-router knowledge: page / page-size changes write
// `?page=` / `?per_page=` via `router.replace`, and the server page re-reads
// `searchParams`, refetches the window, and passes a fresh `total` back.
//
// Params are kept clean: page 1 and the default size drop their query key
// entirely. Changing the page size resets to page 1 (the old page index would
// usually be out of range under the new size). The `ListToolbar` already clears
// `?page=` on any filter/search/sort change, so the two cooperate.

export interface ListPagerProps {
  /** Total row count from the server fetch (`meta.total`). */
  total: number;
  /** Query key for the page number. Default `page`. */
  pageKey?: string;
  /** Query key for the page size. Default `per_page`. */
  perPageKey?: string;
  /** Default (and param-omitted) page size. Default 50. */
  defaultPerPage?: number;
}

export function ListPager({
  total,
  pageKey = 'page',
  perPageKey = 'per_page',
  defaultPerPage = DEFAULT_PAGE_SIZE,
}: ListPagerProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const page = Math.max(1, Math.floor(Number(searchParams?.get(pageKey)) || 1));
  const rawPerPage = Math.floor(Number(searchParams?.get(perPageKey)) || defaultPerPage);
  const perPage = PAGE_SIZE_OPTIONS.includes(rawPerPage) ? rawPerPage : defaultPerPage;
  const pageCount = Math.max(1, Math.ceil(total / perPage));

  const commit = React.useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(Array.from(searchParams?.entries() ?? []));
      for (const [k, v] of Object.entries(updates)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <Pager
      page={page}
      pageCount={pageCount}
      total={total}
      pageSize={perPage}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      onPageChange={(p) => commit({ [pageKey]: p <= 1 ? '' : String(p) })}
      onPageSizeChange={(size) =>
        commit({
          [perPageKey]: size === defaultPerPage ? '' : String(size),
          // A new page size invalidates the current page index — back to page 1.
          [pageKey]: '',
        })
      }
    />
  );
}
