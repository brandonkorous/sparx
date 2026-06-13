'use client';

import * as React from 'react';
import { cn } from '../../utils/cn';

// The colored brand panel shared by every guided/branded surface: the wizard's
// journey rail (docs/86) and the auth split-panel. It is the single source of
// truth for the rail's color treatment and the inverted wordmark, so the
// sign-up → onboarding hand-off reads as one continuous flow.
//
// Drive the color with a wrapping <ModuleProvider> — the rail adopts the active
// module's color via `--module-active`, no per-call color props. Everything here
// is bespoke chrome on a colored surface (white/translucent by design), not a
// re-skinned control.

// Strong, flat shade of the active module color for the rail. Darkening the 500
// shade lands on the module's "strong" shade (indigo → ~#4f46e5) and lifts
// white-on-rail contrast above AA. Still a single flat color — no gradient.
export const RAIL_BG = 'color-mix(in oklab, var(--module-active) 86%, #000)';

// The inverted Sparx wordmark for a colored rail: white "Spar" + a light tint of
// the module color "x". The "x" keeps its brand role even on the rail.
export function RailWordmark() {
  return (
    <span
      style={{
        fontFamily: "var(--font-wordmark, 'Inter', system-ui, sans-serif)",
        fontWeight: 700,
        letterSpacing: '-0.03em',
        fontSize: 20,
        lineHeight: 1,
        color: '#fff',
      }}
    >
      Spar
      <span style={{ color: 'color-mix(in oklab, #fff 55%, var(--module-active))' }}>x</span>
    </span>
  );
}

export interface BrandRailProps {
  /** Brand node at the rail top. Omit when an outer chrome (e.g. the site header)
   *  already carries the wordmark, so it isn't shown twice. */
  wordmark?: React.ReactNode;
  /** Headline + supporting blurb — the rail's narrative. */
  lede?: { title: React.ReactNode; blurb?: React.ReactNode };
  /** Body below the lede — a feature list, trust signals, or a testimonial. */
  children?: React.ReactNode;
  /** Pinned to the rail bottom (`mt-auto`) — a small links/legal line. */
  footer?: React.ReactNode;
  /** Tighter padding for dense contexts (e.g. the modal wizard). */
  compact?: boolean;
  className?: string;
}

// The flat-filled colored panel. `h-full` so it runs the full height of its
// (stretched) grid/flex cell even when its own content is short.
export function BrandRail({
  wordmark,
  lede,
  children,
  footer,
  compact = false,
  className,
}: BrandRailProps) {
  return (
    <aside
      style={{ background: RAIL_BG, color: '#fff' }}
      className={cn(
        'flex h-full flex-col overflow-y-auto',
        compact ? 'px-6 py-7' : 'px-8 py-9 lg:px-12 lg:py-12',
        className
      )}
    >
      {wordmark && <div className="shrink-0">{wordmark}</div>}

      {lede && (
        <div className={cn(wordmark && 'mt-10')}>
          <p className="text-[1.7rem] leading-tight font-medium tracking-tight text-white">
            {lede.title}
          </p>
          {lede.blurb && (
            <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-white/65">{lede.blurb}</p>
          )}
        </div>
      )}

      {children && (
        <div className={cn((wordmark != null || lede != null) && 'mt-10')}>{children}</div>
      )}

      {footer && (
        <div className="mt-auto flex flex-col gap-4 pt-10 text-[0.78rem] text-white/60">
          {footer}
        </div>
      )}
    </aside>
  );
}
