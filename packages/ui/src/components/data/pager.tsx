'use client';

import * as React from 'react';
import { Pagination } from '@wizeworks/silicaui-react';
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
// The page-number nav itself is silica's own `<Pagination>` (prev/next +
// ellipsis) — this component only adds the sparx-specific "x–y of N" summary
// and the rows-per-page select around it.
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
            className="w-auto"
            size="sm"
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

        <Pagination
          page={page}
          count={pageCount}
          onChange={onPageChange}
          color="module"
          size="sm"
        />
      </div>
    </div>
  );
}
