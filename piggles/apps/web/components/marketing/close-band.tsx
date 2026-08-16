import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Section } from '@piggles/ui';
import type { MascotPoseId } from '@piggles/mascot';
import { PigglesMascot } from '@piggles/mascot/react';

// The dark band that closes every page, identically.
//
// `data-theme="dark"` is a real theme island, NOT `bg-secondary`. A background
// utility paints one surface and changes nothing about how tokens resolve, so
// every control inside went on resolving against the light palette — the second
// button measured 1.4:1 on the navy. Inside the island every token flips
// together and anything dropped in here is correct without being told.
//
// Two consequences that look like style choices and are not:
//   • The second button asks for `outline` and NO color. Uncolored it resolves
//     to `base-content`, which the island has already flipped to light (14.8:1).
//     Pinning `neutral` fails in both themes.
//   • The note is `text-primary`, not `text-accent`. Accent is `#8F4656` here —
//     a surface, not a color to read — and measured 2.44:1 against 6.56:1.

export function CloseBand({
  heading,
  primary,
  secondary,
  note,
  mascot = 'mascot-base',
}: {
  heading: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
  /** The terms, restated at the point of decision. */
  note?: string;
  /**
   * Piggles beside the argument, defaulted so every page closes the same way.
   *
   * NEVER a directional pose. She has stood on both sides of this band across
   * three arrangements, and `point-right` aimed off the edge in two of them —
   * the art constrains the layout and moving the layout invalidates the art. A
   * wave cannot be misread from any position.
   */
  mascot?: MascotPoseId;
}) {
  return (
    <Section variant="panel" theme="dark" className="bg-base-200">
      {/* The right column holds one image and nothing else, so it takes the
          width of that image rather than half the band. */}
      <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-16">
        {/* Heading and the thing it asks you to do are ONE column, in reading
            order. Splitting them across columns put the pig between the sentence
            and the decision. */}
        <div>
          <h2 className="text-5xl font-extrabold sm:text-4xl lg:text-6xl">{heading}</h2>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className={buttonClasses({ color: 'primary', size: 'lg' })} href={primary.href}>
              {primary.label}
            </a>
            <a className={buttonClasses({ variant: 'outline', size: 'lg' })} href={secondary.href}>
              {secondary.label}
            </a>
          </div>
          {note ? <p className="text-primary mt-5 text-base font-semibold">{note}</p> : null}
        </div>

        {/* Hidden below `sm`: a phone gets the heading and two full-width
            buttons, because there the decision is the only thing worth space. */}
        <PigglesMascot
          pose={mascot}
          size={{ base: 'md', lg: 'lg' }}
          className="mx-auto hidden sm:block lg:mx-0"
        />
      </div>
    </Section>
  );
}
