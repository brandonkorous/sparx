'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';
import { NativeSelect } from '../form/native-select';

// Pager — the shared offset/page-number pager that sits below a Collection/List
// (docs/34 §7: ListToolbar → list → pager). Presentational + controlled: it
// reports page / page-size changes through callbacks and holds no URL/router
// knowledge, so `@sparx/ui` stays framework-agnostic. The dashboard's
// `ListPager` wrapper turns these into `?page=` / `?per_page=` query updates;
// the server page reads them, fetches the window (skip/take), and passes
// `total` back here.
//
// Renders nothing for a single page — pagination chrome only appears once there
// is more than one page of results.

export interface PagerProps {
  /** 1-based current page. */
  page: number;
  /** Total number of pages. */
  pageCount: number;
  /** Total row count across all pages (for the "x–y of N" summary). */
  total: number;
  /** Current page size. */
  pageSize: number;
  /** Selectable page sizes. Default `[25, 50, 100]`. */
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  className?: string;
}

type PageItem = number | 'gap-left' | 'gap-right';

// First + last always shown; current ±1 in the middle; gaps collapse to an
// ellipsis. ≤7 pages renders every number.
function pageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const items: PageItem[] = [1];
  const left = Math.max(2, page - 1);
  const right = Math.min(pageCount - 1, page + 1);
  if (left > 2) items.push('gap-left');
  for (let p = left; p <= right; p++) items.push(p);
  if (right < pageCount - 1) items.push('gap-right');
  items.push(pageCount);
  return items;
}

export function Pager({
  page,
  pageCount,
  total,
  pageSize,
  pageSizeOptions = [25, 50, 100],
  onPageChange,
  onPageSizeChange,
  className,
}: PagerProps) {
  // Always render for any non-empty list so the result count + rows-per-page
  // control live in a predictable, discoverable place — never appearing or
  // vanishing as the row count crosses a page boundary. An empty list is owned
  // by the page's EmptyState. On a single page the prev/next/number nav simply
  // disables rather than disappearing.
  if (total === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        'text-base-content/70 flex flex-wrap items-center justify-between gap-3 px-1 text-xs',
        className
      )}
    >
      <span className="tabular-nums">
        {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
      </span>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5">
          <span className="sr-only">Rows per page</span>
          <NativeSelect
            className="h-7 w-auto py-0 text-xs"
            aria-label="Rows per page"
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </NativeSelect>
        </label>

        <nav aria-label="Pagination" className="flex items-center gap-1">
          <PagerButton
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </PagerButton>

          {pageItems(page, pageCount).map((item) =>
            typeof item === 'number' ? (
              <PagerButton
                key={item}
                active={item === page}
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onPageChange(item)}
              >
                {item}
              </PagerButton>
            ) : (
              <span key={item} aria-hidden className="text-base-content/50 px-1 select-none">
                …
              </span>
            )
          )}

          <PagerButton
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </PagerButton>
        </nav>
      </div>
    </div>
  );
}

interface PagerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

function PagerButton({ active, className, children, ...props }: PagerButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-2 tabular-nums transition-colors',
        'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-40',
        active
          ? 'border-module bg-module bg-soft text-module font-medium'
          : 'border-[var(--color-base-300)] hover:bg-[var(--color-base-200)] disabled:hover:bg-transparent',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
