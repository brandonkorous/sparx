// silicaui-native layout primitives for apps/market. These replace the bespoke
// `.mx-container` / `.mx-section` / `.mx-grid` CSS classes with composable React
// wrappers built from the silicaui plugin's Tailwind utility layer — one
// responsibility each, so a page reads as structure, not class soup.
//
// Server-safe (no client state); imported by the shell + every product surface.

import type { ElementType, ReactNode } from 'react';
// Server-safe entry — the main `silicaui-react` barrel is `'use client'`, so its
// `cx` can't be CALLED from a Server Component; `/server` ships the same utility
// with no client directive (works in server + client alike).
import { cx } from 'silicaui-react/server';

/** Centered content measure — the marketplace runs a slightly wider gutter than
 *  the dashboard so product grids breathe on large displays (max 80rem/1280px). */
export function Container({
  as: Tag = 'div',
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={cx('mx-auto w-full max-w-[80rem] px-4 sm:px-6 lg:px-8', className)}>
      {children}
    </Tag>
  );
}

/** A vertical rhythm block — consistent top/bottom padding for a page section. */
export function Section({
  as: Tag = 'section',
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={cx('py-10 md:py-14', className)}>{children}</Tag>;
}

/** The responsive product/merchant card grid: 2 columns on mobile, 3 at sm, 4 at
 *  lg — mobile-first, matching the marketplace's dense-but-scannable rhythm. */
export function CardGrid({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx('grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4', className)}>
      {children}
    </div>
  );
}
