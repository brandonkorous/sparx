import type { ReactNode } from 'react';
import type { PigglesGroup } from '@piggles/brand';

// The opening block of every page that is not the homepage.
//
// One component rather than a hand-built heading per page, because the thing
// that makes a set of pages feel like a site is that they start the same way.
// The homepage deliberately does NOT use it — its opening is the film, and a
// homepage that opened like an interior page would have nothing to announce.
//
// ── WHY IT CARRIES A FIGURE ─────────────────────────────────────────────────
//
// It used to be a heading, a paragraph and two buttons on `base-100`, and it had
// three faults that compounded. It did not read as an OPENING — `base-100` with
// a hairline is what the header above it and the bands below it already wear, so
// the page simply began. It left two thirds of the fold empty. And it showed
// NOTHING: /apps claimed fifteen apps over blank space, /pricing named a price
// and put the receipt eight hundred pixels further down.
//
// So the fold is where the page's own subject goes, not a caption introducing
// it. `figure` is the slot; components/marketing/hero/ holds the ten of them,
// each built from the page's real data rather than from a picture of it.
//
// ── THE SURFACE LADDER IS THE SEPARATION ────────────────────────────────────
//
// `base-200` — between the `base-100` header above and the `base-300` page
// ground below, so both edges of the hero are visible without a border doing the
// work. It also gives the figure something to lift off: a `base-100` object on a
// `base-100` band is invisible, which is why this is not simply a lighter band.
// Rounded and lifted, so it hangs off the header as an object. Piggles owns this
// shadow — silica paints none of it (piggles/DESIGN.md §4).
//
// `eyebrow` is not a prop and will not be added. Root RULE #2 bans the slot, not
// the markup: a kicker, a category chip, a step number and a <Badge> in that
// position are the same anti-pattern. If a page needs to say what section it
// belongs to, the heading says it.

export function PageHero({
  heading,
  lede,
  figure,
  assurances,
  group,
  children,
  className = '',
}: {
  heading: ReactNode;
  lede: string;
  /**
   * What the page is about, shown. Anything in components/marketing/hero/.
   * Optional only because /status renders a heading whose whole job is to be
   * read before anything else on the page.
   */
  figure?: ReactNode;
  /**
   * The three or four words a visitor wants before clicking the button — free,
   * no card, everything included. The homepage's cold open carries them and the
   * interior pages carried none, so the CTA asked for a decision without
   * answering the objection that comes with it.
   */
  assurances?: string[];
  /** Wears a group's hue. The app pages set it on an ancestor instead. */
  group?: PigglesGroup;
  /** Calls to action. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      data-group={group}
      className={`bg-base-200 rounded-b-section px-6 pt-12 pb-14 shadow-lg sm:pt-16 sm:pb-20 ${className}`}
    >
      <div
        className={`mx-auto grid max-w-7xl gap-10 lg:gap-16 ${
          // No figure, no second column — otherwise the text is squeezed into
          // half a page to make room for nothing.
          figure ? 'lg:grid-cols-[1.04fr_0.96fr] lg:items-center' : ''
        }`}
      >
        <div>
          {/* Bigger and heavier than it was, and the reason is that it was
              smaller than the homepage's H2 — `text-5xl font-extrabold` under a
              `text-6xl font-black`. An interior page whose title is outweighed
              by a subheading one click away reads as a lesser page. Fredoka's
              wght axis stops at 700, so `font-black` clamps there rather than
              erroring; it is written for the day the face gains a heavier cut. */}
          <h1 className="text-4xl leading-[1.03] font-black text-balance sm:text-5xl lg:text-6xl">
            {heading}
          </h1>

          <p className="mt-6 max-w-[48ch] text-lg sm:text-xl">{lede}</p>

          {children ? <div className="mt-8 flex flex-wrap gap-3">{children}</div> : null}

          {assurances?.length ? (
            <ul className="mt-6 flex flex-wrap gap-x-7 gap-y-2">
              {assurances.map((line) => (
                <li key={line} className="text-base font-semibold">
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* `.settle` is scroll-driven and its range is `entry`, so an element
            that is already on screen at load sits at the END of the animation
            rather than the start — it renders visible, and moves only on the way
            back up. The opposite arrangement is the one that ships an invisible
            hero when the timeline never runs. */}
        {figure ? <div className="settle min-w-0">{figure}</div> : null}
      </div>
    </section>
  );
}
