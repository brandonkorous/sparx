'use client';

import * as React from 'react';
import { cn } from '../../utils/cn';
import { Wordmark } from '../brand/wordmark';
import { BrandRail, RailWordmark, type BrandRailProps } from '../brand/brand-rail';

export interface AuthFrameProps {
  /** Rail value statement (headline + blurb on the colored panel). */
  lede?: BrandRailProps['lede'];
  /** Rail body below the lede — a short value list. */
  aside?: React.ReactNode;
  /** Rail footer pinned to the bottom (e.g. a back link). */
  asideFooter?: React.ReactNode;
  /** The form column (right pane). Centered with a sensible max width. */
  children: React.ReactNode;
  className?: string;
}

// The auth split-screen: a full-height colored <BrandRail> on the left (the same
// indigo treatment as the onboarding wizard, so sign-up flows seamlessly into
// setup) and the form on the right. No top header — the rail carries the brand.
//
// Below 820px the rail drops away and the form takes the full width, with a
// compact dark wordmark above it so small screens still read as sparx.
export function AuthFrame({ lede, aside, asideFooter, children, className }: AuthFrameProps) {
  return (
    <div
      className={cn(
        'grid min-h-screen grid-cols-[minmax(0,46%)_1fr] bg-[var(--color-bg-page)] max-[820px]:grid-cols-1',
        className
      )}
    >
      <BrandRail
        wordmark={<RailWordmark />}
        lede={lede}
        footer={asideFooter}
        className="max-[820px]:hidden"
      >
        {aside}
      </BrandRail>

      <main className="flex items-center justify-center overflow-y-auto px-6 py-12">
        <div className="w-full max-w-[26rem]">
          <div className="mb-10 hidden max-[820px]:block">
            <Wordmark />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
