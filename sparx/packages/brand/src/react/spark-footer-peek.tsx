'use client';

/**
 * SparkFooterPeek — sparky leaning over the top edge of a page footer.
 *
 * The same gesture as the auth pane's Sparky: ONE mascot (one DOM node, so two
 * can never show at once) that idles fully hidden BEHIND an opaque surface and
 * slides out past one of its edges, tucking back before reappearing somewhere
 * else. Here the surface is the footer and the edge is its top, so he rises out
 * of the footer, holds a beat, and sinks back — then does it again from a
 * different spot along the bar.
 *
 * Occlusion is the whole trick, and it is the caller's half of the contract:
 *
 *   <div className="relative">        ← positioning context (wraps the footer)
 *     <SparkFooterPeek />             ← absolute, z-0, bottom:100% (see mascot.css)
 *     <footer className="relative z-10 bg-base-100">…</footer>
 *   </div>
 *
 * The mascot's bottom edge sits on the footer's top line and is pushed DOWN
 * behind it; the footer's opaque background is what hides the part of him that
 * hasn't risen past the line yet. A transparent footer, a missing `relative`, or
 * a footer that doesn't out-stack him will leave him floating over the page.
 *
 * Decorative by construction: aria-hidden, pointer-events:none, and motion gated
 * on prefers-reduced-motion (which parks him in a resting half-peek rather than
 * removing him). Position + slide live in `.sparky-footer-peek`
 * (@sparx/brand/mascot.css) — import that stylesheet once per app.
 */

import { cx } from './cx';
import { SparkMascot } from './spark-mascot';

export interface SparkFooterPeekProps {
  /** Match the footer's surface: `dark` flips the face to white so it stays
   *  legible through the mascot's open centre. */
  tone?: 'light' | 'dark';
  /** Body width in px. Small enough that the peek reads as a lean, not a hero. */
  size?: number;
  className?: string;
}

export function SparkFooterPeek({ tone = 'light', size = 104, className }: SparkFooterPeekProps) {
  return (
    <div className={cx('sparky-footer-peek', className)} aria-hidden>
      {/* bob is OFF: the slide is the motion here, and a float on top of it
          reads as a wobble. The blink keeps the face alive while he's up. */}
      <SparkMascot expression="happy" tone={tone} size={size} bob={false} blink title="" />
    </div>
  );
}
