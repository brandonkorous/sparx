import { buttonClasses } from '@wizeworks/silicaui-react/server';

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

export function CloseBand({
  heading,
  primary,
  secondary,
}: {
  heading: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
}) {
  return (
    <section data-theme="dark" className="bg-base-200 px-6 py-16 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:items-end lg:gap-16">
        <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">{heading}</h2>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <a className={buttonClasses({ color: 'primary', size: 'lg' })} href={primary.href}>
            {primary.label}
          </a>
          <a className={buttonClasses({ variant: 'outline', size: 'lg' })} href={secondary.href}>
            {secondary.label}
          </a>
        </div>
      </div>
    </section>
  );
}
