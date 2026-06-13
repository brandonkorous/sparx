'use client';

import * as React from 'react';
import { cn } from '../../utils/cn';
import { BrandRail, type BrandRailProps } from '../brand/brand-rail';

export interface AuthFrameProps {
  /** Full-width chrome pinned to the top — the shared site header. Rendered above
   *  the split panel so the auth pages read as part of the marketing site. */
  header?: React.ReactNode;
  /** Rail headline + blurb (the value-prop on the colored panel). */
  lede?: BrandRailProps['lede'];
  /** Rail body below the lede — a feature list / trust signals. */
  aside?: React.ReactNode;
  /** Rail footer pinned to the bottom (e.g. a small legal line). */
  asideFooter?: React.ReactNode;
  /** The form column (right pane). Centered in its pane with a sensible max width. */
  children: React.ReactNode;
  className?: string;
}

// The auth split-panel: the shared site header on top, then a two-column body —
// a colored <BrandRail> on the left (same treatment as the onboarding wizard, so
// the sign-up → onboarding hand-off is seamless) and the form on the right. The
// header is injected as a slot rather than imported, so this stays free of any
// marketing dependency (the rail's color comes from the wrapping <ModuleProvider>).
//
// Below 860px the rail drops away and the form takes the full width — the header
// already carries the brand on small screens.
export function AuthFrame({
  header,
  lede,
  aside,
  asideFooter,
  children,
  className,
}: AuthFrameProps) {
  return (
    <div className={cn('flex min-h-screen flex-col bg-[var(--color-bg-page)]', className)}>
      {header}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,44%)_1fr] max-[860px]:grid-cols-1">
        <BrandRail lede={lede} footer={asideFooter} className="max-[860px]:hidden">
          {aside}
        </BrandRail>
        <main className="flex items-center justify-center overflow-y-auto px-6 py-12">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
