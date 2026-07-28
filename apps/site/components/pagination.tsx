// SSR pagination — renders prev/next + a windowed set of page links, each
// preserving the current query params. Link-based so it works without JS and
// every page is independently cacheable.
//
// The two inline `style` blocks this used to carry are gone (slice 23): a hand-written
// `marginTop: '3rem'` is outside the spacing scale and cannot respond to anything, and
// the rule against painting with `style` exists precisely so a control looks the same
// wherever it is placed. Both were plain flex layout, so both are utilities now.

import { Button } from '@wizeworks/silicaui-react';

import { ButtonLink } from './button-link';

export interface PaginationProps {
  basePath: string;
  currentParams: Record<string, string | string[] | undefined>;
  page: number;
  totalPages: number;
  /**
   * The query parameter this pager moves. `page` unless the route carries more than
   * one paginated list.
   *
   * It is the parameter that gets REPLACED in every href built here, which means the
   * others survive — so paging the products on a page that also lists journal entries
   * does not silently reset the journal to page one.
   */
  param?: string;
}

function hrefFor(
  basePath: string,
  params: Record<string, string | string[] | undefined>,
  page: number,
  param: string
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === param || v === undefined) continue;
    sp.set(k, Array.isArray(v) ? (v[0] ?? '') : v);
  }
  if (page > 1) sp.set(param, String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

// Compact window around the current page: 1 … (p-1) p (p+1) … last
function pageWindow(page: number, total: number): number[] {
  const pages = new Set<number>([1, total, page, page - 1, page + 1]);
  return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
}

export function Pagination({
  basePath,
  currentParams,
  page,
  totalPages,
  param = 'page',
}: PaginationProps) {
  const window = pageWindow(page, totalPages);

  return (
    <nav aria-label="Pagination" className="mt-12 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <ButtonLink
          href={hrefFor(basePath, currentParams, page - 1, param)}
          color="neutral"
          variant="ghost"
        >
          ← Prev
        </ButtonLink>
      ) : null}

      {window.map((p, i) => {
        const gap = i > 0 && p - window[i - 1]! > 1;
        return (
          <span key={p} className="inline-flex items-center gap-2">
            {gap ? <span className="text-base-content">…</span> : null}
            {p === page ? (
              // The current page is not a link. A plain <Button> (no `render`)
              // keeps this a Server Component — see ButtonLink for why passing an
              // element across the RSC boundary crashes at request time.
              <Button color="primary" aria-current="page" disabled>
                {p}
              </Button>
            ) : (
              <ButtonLink
                href={hrefFor(basePath, currentParams, p, param)}
                color="neutral"
                variant="ghost"
              >
                {p}
              </ButtonLink>
            )}
          </span>
        );
      })}

      {page < totalPages ? (
        <ButtonLink
          href={hrefFor(basePath, currentParams, page + 1, param)}
          color="neutral"
          variant="ghost"
        >
          Next →
        </ButtonLink>
      ) : null}
    </nav>
  );
}
