'use client';

import * as React from 'react';
import { Wordmark } from '@sparx/brand/react';
import { cn } from '../../utils/cn';

// The colored brand panel for the auth split-screen — a flat fill of the active
// module color with white text. Drive the color with a wrapping <ModuleProvider>.
// Everything here is bespoke chrome on a colored surface (white/translucent by
// design), not a re-skinned control.
//
// Layout is deliberately three-band so the panel never reads as an empty
// rectangle: brand pinned top, the value statement vertically CENTERED, a
// grounding footer pinned bottom.

// Strong, flat shade of the active module color. Darkening the 500 shade lands
// on the module's "strong" shade (indigo → ~#4f46e5) and lifts white-on-rail
// contrast above AA. A single flat color — no gradient (sparx is flat).
export const RAIL_BG = 'color-mix(in oklab, var(--color-module) 86%, #000)';

// The inverted sparx wordmark for a colored rail: the real vector lockup drawn
// white, with a light tint of the module color for the "x" (it keeps its brand
// role even on the rail). Body is `currentColor`, so the inline white wins over
// the component's default ink class.
export function RailWordmark() {
  return (
    <Wordmark
      size={22}
      accentColor="color-mix(in oklab, #fff 55%, var(--color-module))"
      style={{ color: '#fff' }}
    />
  );
}

export interface BrandRailProps {
  /** Brand node pinned to the top. */
  wordmark?: React.ReactNode;
  /** The centered value statement — a confident headline + supporting line. */
  lede?: { title: React.ReactNode; blurb?: React.ReactNode };
  /** Supporting content below the lede (e.g. a short value list). */
  children?: React.ReactNode;
  /** Grounding footer pinned to the bottom (a back link / brand line). */
  footer?: React.ReactNode;
  className?: string;
}

export function BrandRail({ wordmark, lede, children, footer, className }: BrandRailProps) {
  return (
    <aside
      style={{ background: RAIL_BG, color: '#fff' }}
      className={cn(
        'flex h-full flex-col overflow-y-auto px-10 py-11 lg:px-14 lg:py-14',
        className
      )}
    >
      {wordmark && <div className="shrink-0">{wordmark}</div>}

      <div className="flex flex-1 flex-col justify-center py-12">
        {lede && (
          <div>
            <h2 className="max-w-[16ch] text-[2.4rem] leading-[1.08] font-medium tracking-[-0.02em] text-white">
              {lede.title}
            </h2>
            {lede.blurb && (
              <p className="mt-5 max-w-[42ch] text-[1.0625rem] leading-relaxed text-white/70">
                {lede.blurb}
              </p>
            )}
          </div>
        )}
        {children && <div className="mt-10">{children}</div>}
      </div>

      {footer && <div className="shrink-0 text-sm text-white/55">{footer}</div>}
    </aside>
  );
}
