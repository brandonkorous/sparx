import type { ReactNode } from 'react';

/**
 * A full-width page band — the marketing site's one section shell.
 *
 * It encodes a rule the rebuilt pages had already converged on by hand without
 * anyone writing it down: **a band that carries its own fill is inset and
 * rounded; a band sitting on the page background is not.** Across the homepage
 * and /pricing that held for all fourteen sections — every filled band wore
 * `m-6 rounded-4xl`, every unfilled one wore nothing — and it is the reason the
 * filled ones read as cards floating on the page rather than full-bleed stripes.
 *
 * Written out nine separate times, it was already drifting: the homepage's
 * indigo band was `bg-primary` with no `text-primary-content`, while /pricing's
 * identical band had it — a fill without its paired ink, holding together only
 * because what it inherited happened to be legible. `tone` now sets fill and ink
 * as one choice, so that pair cannot come apart.
 *
 * Change the radius, the inset, or the vertical rhythm HERE and every band on
 * the site follows — which is the whole point of the rule (RULE #1).
 */
export type BandTone =
  /** No fill. Sits directly on the page background (`--color-base-200`); not
   *  inset, not rounded. The default, and the quiet half of the rhythm. */
  | 'page'
  /** The lifted surface — white on a light theme. A floating card against the
   *  page's grey, which is the light-mode counterpart of `dark`. */
  | 'surface'
  /** A near-black island. A real `data-theme` scope, so everything inside
   *  resolves its own ink rather than being painted. */
  | 'dark'
  /**
   * PAINTED tones — a fill plus a `text-*-content` ink, and nothing more.
   *
   * They are not theme scopes. Inheritance carries `text-*-content` to bare
   * prose, but a silica component paints itself from its own CSS variables and
   * never sees it — so an `outline`/`ghost` control inside one still inks itself
   * from the LIGHT theme's `--color-base-content` and lands near-black on a dark
   * fill.
   *
   * So: a painted band takes SOLID controls, in a color that contrasts with the
   * fill. On `primary` (Ember) that includes `neutral` — near-black on Ember is
   * a strong contrasting solid, which is what /platform's pricing band uses. On
   * `neutral` it does not, for the obvious reason. If a band wants outline or
   * ghost controls, it wants `dark`, which IS a real island. DESIGN.md §3.0.
   */
  | 'primary'
  | 'neutral'
  | 'accent';

/** The painted subset of `BandTone`, named on its own because the marketing
 *  site has TWO section shells and both must offer the same colors: `Band`
 *  (inset + rounded, the floating-card idiom of the newer pages) and `Section`
 *  in `primitives.tsx` (full-bleed stripes, the idiom the 11 module pages are
 *  built on). The SHAPE differs on purpose; the tone vocabulary must not. */
export type PaintedTone = 'primary' | 'neutral' | 'accent';

/** Fill + its PAIRED ink, as one indivisible choice. silica emits the two as
 *  independent utilities, so a tone that set only the fill would leave its
 *  contents inheriting the ink of whatever surface came before it.
 *
 *  Exported and consumed by `Section` too — a second copy of these three pairs
 *  is exactly how the homepage and /pricing drifted apart before `Band` existed
 *  (see the note above). One definition, both shells. */
export const PAINTED_TONE_CLASS: Record<PaintedTone, string> = {
  primary: 'bg-primary text-primary-content',
  neutral: 'bg-neutral text-neutral-content',
  accent: 'bg-accent text-accent-content',
};

const TONE_CLASS: Record<BandTone, string> = {
  page: '',
  // `surface` and `dark` are the same token deliberately — `--color-base-100`
  // is white on the light theme and near-black inside the island, so one
  // declaration gives both the lifted card and the dark band.
  surface: 'bg-base-100',
  dark: 'bg-base-100',
  ...PAINTED_TONE_CLASS,
};

/** The inset + radius that makes a filled band read as a floating card. Applied
 *  to every tone that has a fill, and to none that doesn't.
 *
 *  Exported for the same reason as `PAINTED_TONE_CLASS`: `Section` in
 *  `primitives.tsx` is the site's other section shell, and a filled band that is
 *  rounded on /platform and square on /commerce is two design systems, not one.
 *  Change the radius or the inset HERE and every band on every page follows. */
export const FILLED_SHAPE = 'm-6 rounded-4xl';

export function Band({
  id,
  tone = 'page',
  className,
  children,
  /** Opt out of the inner max-width wrapper for a band that manages its own
   *  full-bleed layout (a video, an edge-to-edge strip). */
  bleed,
  /**
   * Keep a filled band flush to the viewport edge — no inset, no radius.
   *
   * The one standing exception to the shape rule above, and it has exactly one
   * case: the HERO. A page's first band sits directly under the nav, so insetting
   * it opens a 24px stripe of page background between the header and the content
   * and the page reads as if it started with a gap. Every hand-rolled hero on the
   * site (landing, /pricing) already does this; naming it here is what stops the
   * next one from being hand-rolled too.
   */
  flush,
}: {
  id?: string;
  tone?: BandTone;
  className?: string;
  children: ReactNode;
  bleed?: boolean;
  flush?: boolean;
}) {
  const filled = tone !== 'page' && !flush;
  return (
    <section
      id={id}
      // A `data-theme` island, not a painted surface: the dark band re-resolves
      // every token underneath it, so buttons, badges and prose inside need no
      // dark-mode variants of their own.
      data-theme={tone === 'dark' ? 'dark' : undefined}
      className={[
        'scroll-mt-20 px-6 py-24 sm:px-8 lg:py-32',
        TONE_CLASS[tone],
        filled ? FILLED_SHAPE : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {bleed ? children : <div className="mx-auto w-full max-w-7xl">{children}</div>}
    </section>
  );
}
