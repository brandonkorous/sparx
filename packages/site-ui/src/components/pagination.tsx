// Pagination — a page navigator (docs/46 §5.2). SERVER component, structural (the
// active page uses the fixed primary accent — not a selectable color axis).
// Presentational: every page is an <a> built from `hrefFor`, so it works without a
// client runtime (no onClick on the base). Long ranges collapse with ellipses.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface PaginationProps {
  /** Current 1-based page. */
  page: number;
  /** Total page count. */
  total: number;
  /** Builds the href for a page. Defaults to `?page=N`. */
  hrefFor?: (page: number) => string;
  /** Pages shown on each side of the current page. Defaults to 1. */
  siblingCount?: number;
  prevLabel?: string;
  nextLabel?: string;
  /** Accessible label for the nav landmark. Defaults to `Pagination`. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

const DOTS = 'ellipsis' as const;
type Page = number | typeof DOTS;

const range = (start: number, end: number): number[] =>
  Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);

/** The page list with ellipses, e.g. `[1, 'ellipsis', 4, 5, 6, 'ellipsis', 20]`. */
export function paginationRange(page: number, total: number, siblingCount = 1): Page[] {
  const totalNumbers = siblingCount * 2 + 5; // first, last, current, 2 ellipses
  if (totalNumbers >= total) return range(1, total);

  const left = Math.max(page - siblingCount, 1);
  const right = Math.min(page + siblingCount, total);
  const showLeftDots = left > 2;
  const showRightDots = right < total - 1;

  if (!showLeftDots && showRightDots) {
    return [...range(1, siblingCount * 2 + 3), DOTS, total];
  }
  if (showLeftDots && !showRightDots) {
    return [1, DOTS, ...range(total - (siblingCount * 2 + 2), total)];
  }
  return [1, DOTS, ...range(left, right), DOTS, total];
}

export function Pagination({
  page,
  total,
  hrefFor = (p) => `?page=${p}`,
  siblingCount = 1,
  prevLabel = 'Previous',
  nextLabel = 'Next',
  label = 'Pagination',
  className,
  style,
  id,
}: PaginationProps): React.ReactElement | null {
  if (total <= 1) return null;
  const pages = paginationRange(page, total, siblingCount);
  const atStart = page <= 1;
  const atEnd = page >= total;

  return (
    <nav aria-label={label} className={cx('st-pagination', className)} style={style} id={id}>
      <ul className="st-pagination__list">
        <li className={cx('st-pagination__item', atStart && 'st-pagination__item--disabled')}>
          {atStart ? (
            <span className="st-pagination__link" aria-disabled="true">
              {prevLabel}
            </span>
          ) : (
            <a className="st-pagination__link" href={hrefFor(page - 1)} rel="prev">
              {prevLabel}
            </a>
          )}
        </li>

        {pages.map((p, i) =>
          p === DOTS ? (
            <li key={`dots-${i}`} className="st-pagination__item">
              <span className="st-pagination__ellipsis" aria-hidden="true">
                …
              </span>
            </li>
          ) : (
            <li
              key={p}
              className={cx('st-pagination__item', p === page && 'st-pagination__item--active')}
            >
              <a
                className="st-pagination__link"
                href={hrefFor(p)}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </a>
            </li>
          )
        )}

        <li className={cx('st-pagination__item', atEnd && 'st-pagination__item--disabled')}>
          {atEnd ? (
            <span className="st-pagination__link" aria-disabled="true">
              {nextLabel}
            </span>
          ) : (
            <a className="st-pagination__link" href={hrefFor(page + 1)} rel="next">
              {nextLabel}
            </a>
          )}
        </li>
      </ul>
    </nav>
  );
}
Pagination.displayName = 'Pagination';
