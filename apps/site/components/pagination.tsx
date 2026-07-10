// SSR pagination — renders prev/next + a windowed set of page links, each
// preserving the current query params. Link-based so it works without JS and
// every page is independently cacheable.

import { Button } from '@wizeworks/silicaui-react';

import { ButtonLink } from './button-link';

export interface PaginationProps {
  basePath: string;
  currentParams: Record<string, string | string[] | undefined>;
  page: number;
  totalPages: number;
}

function hrefFor(
  basePath: string,
  params: Record<string, string | string[] | undefined>,
  page: number
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === 'page' || v === undefined) continue;
    sp.set(k, Array.isArray(v) ? (v[0] ?? '') : v);
  }
  if (page > 1) sp.set('page', String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

// Compact window around the current page: 1 … (p-1) p (p+1) … last
function pageWindow(page: number, total: number): number[] {
  const pages = new Set<number>([1, total, page, page - 1, page + 1]);
  return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
}

export function Pagination({ basePath, currentParams, page, totalPages }: PaginationProps) {
  const window = pageWindow(page, totalPages);

  return (
    <nav
      aria-label="Pagination"
      style={{
        display: 'flex',
        gap: '0.4rem',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: '3rem',
        flexWrap: 'wrap',
      }}
    >
      {page > 1 ? (
        <ButtonLink
          href={hrefFor(basePath, currentParams, page - 1)}
          color="neutral"
          variant="ghost"
        >
          ← Prev
        </ButtonLink>
      ) : null}

      {window.map((p, i) => {
        const gap = i > 0 && p - window[i - 1]! > 1;
        return (
          <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            {gap ? <span className="st-muted">…</span> : null}
            {p === page ? (
              // The current page is not a link. A plain <Button> (no `render`)
              // keeps this a Server Component — see ButtonLink for why passing an
              // element across the RSC boundary crashes at request time.
              <Button color="primary" aria-current="page" disabled>
                {p}
              </Button>
            ) : (
              <ButtonLink
                href={hrefFor(basePath, currentParams, p)}
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
          href={hrefFor(basePath, currentParams, page + 1)}
          color="neutral"
          variant="ghost"
        >
          Next →
        </ButtonLink>
      ) : null}
    </nav>
  );
}
