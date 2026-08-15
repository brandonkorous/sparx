import { buttonClasses } from '@wizeworks/silicaui-react/server';
import type { MascotPoseId } from '@piggles/mascot';
import { PigglesMascot } from '@piggles/mascot/react';

// The dark band that closes every page.
//
// ── WHY THIS IS A REAL THEME ISLAND ─────────────────────────────────────────
//
// The first version was `bg-secondary text-secondary-content` with a
// `color="neutral" variant="outline"` second button, and the second button was
// very nearly invisible. A background utility is NOT a theme island: it paints
// one surface and changes nothing about how the tokens inside resolve, so every
// control in the band went on resolving against the LIGHT palette while sitting
// on a dark navy.
//
// Measured on the page, ink against the band:
//
//   | on `bg-secondary` (utility)          | contrast |
//   | neutral + outline                    |  1.4:1   |  ← what shipped
//   | uncoloured outline                   |  1.06:1  |  ← invisible
//
//   | inside `data-theme="dark"` + base-200 | contrast |
//   | uncoloured outline                    | 14.77:1  |  ← this
//   | primary + outline                     |  6.56:1  |
//   | neutral + outline                     |  2.52:1  |
//   | accent + outline                      |  2.44:1  |
//
// Two things follow, and both are the point rather than trivia:
//
//   1. **`data-theme` is the mechanism, not a background class.** Inside the
//      island every token flips together — base, content, borders, focus rings —
//      so anything dropped in here is correct without being told about the dark
//      surface. That is the single-point-of-change property; a utility-painted
//      dark band gives it up and makes every child a manual fix.
//   2. **The second button asks for `outline` and NOT for a colour.** Uncoloured,
//      it resolves to `base-content`, which the island has already flipped to
//      light. Pin a colour and you have pinned a value that no longer follows the
//      surface — `neutral` fails here in BOTH themes, so it is not a palette bug
//      to route around but simply the wrong choice for ink on a dark ground.

// ── THE MASCOT, WHEN A PAGE ASKS FOR ONE ────────────────────────────────────
//
// She goes INSIDE the band, DIRECTLY ABOVE THE BUTTONS.
//
// Two wrong placements got here first and both are worth keeping, because the
// third one is only obviously right against them:
//
//   1. Floating UNDER the band. Attached to nothing, it read as a sticker
//      somebody had put on the page rather than the end of the argument.
//   2. Bottom of the heading column, opposite the buttons. That looks reasonable
//      written down and leaves a hole on the page: heading top-left, pig
//      bottom-left, buttons bottom-right, and a large empty middle-right that the
//      eye has to cross for no reason.
//
// Above the buttons she is in the column that the band exists for, stacked with
// the thing she is recommending, and the dead space is gone — the right column
// now has three things in it and carries its own height.
//
// ── WHICH MEANS THE POSE MOVED WITH HER ─────────────────────────────────────
//
// It was `point-right`, chosen when she stood to the LEFT of the buttons: her arm
// extends to the viewer's right, so she aimed at them. Directly above them that
// same arm points off the edge of the band at nothing. A directional pose is the
// one case where the art constrains the layout — and equally, where moving the
// layout invalidates the art. The home page now asks for a plain wave.
//
// So: if a page passes a directional pose here, it is wrong. She is above the
// decision, not beside it.
//
// Opt-in rather than automatic. Four of the five bands using this component are a
// terse restatement of the price, and a mascot on every one of them spends her
// for nothing; she is worth something at the end of the home page because that is
// the page with a story to finish.

export function CloseBand({
  heading,
  primary,
  secondary,
  note,
  mascot,
}: {
  heading: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
  /** The terms, restated at the point of decision. Optional because only the
   *  home page ends 3000px below the price — the other pages ARE the price and
   *  the trust pages, and repeating it there is noise rather than a reminder. */
  note?: string;
  /** Piggles above the buttons. NOT a directional pose — see the note above. */
  mascot?: MascotPoseId;
}) {
  return (
    <section className="px-4 sm:px-6">
      <div
        data-theme="dark"
        className="rounded-section bg-base-200 mx-auto grid max-w-7xl gap-10 px-6 py-16 sm:px-10 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-14"
      >
        <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">{heading}</h2>
        {/* `lg:items-center` on the grid, not `items-end`: with her in here this
            column is the taller of the two, and bottom-aligning would drop the
            heading to the floor and open the same hole again at the top. Centred,
            the two columns balance and the band keeps its own height.

            `lg:ml-auto` puts her over the right-hand end of the button row, which
            is where the row actually sits once `lg:justify-end` has pushed it
            there. Hidden below `sm` — a phone gets the heading and two full-width
            buttons, and the decision is what matters at that width. */}
        <div>
          {mascot ? (
            <PigglesMascot pose={mascot} size="md" className="mb-7 hidden sm:block lg:ml-auto" />
          ) : null}
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <a className={buttonClasses({ color: 'primary', size: 'lg' })} href={primary.href}>
              {primary.label}
            </a>
            <a className={buttonClasses({ variant: 'outline', size: 'lg' })} href={secondary.href}>
              {secondary.label}
            </a>
          </div>
          {note && <p className="text-accent mt-5 text-base font-semibold lg:text-right">{note}</p>}
        </div>
      </div>
    </section>
  );
}
