import { Logo } from '@piggles/brand/react';
import { PIGGLES_GROUPS } from '@piggles/brand';
import { HeroPanel } from './panel';

// /brand — the mark, and the six hues, at the top of the page about them.
//
// The reference page renders every token in both themes and did not render the
// LOGO once, which is a strange thing for a brand page to leave out: the mark is
// where the pink comes from, and the panels below argue about that pink for two
// screens without ever showing the object it belongs to.
//
// The six group fills sit under it as a strip rather than as the labelled blocks
// the theme panels use further down. Not a duplicate — those exist to be
// compared across light and dark with their app lists and hex values beside
// them; this is the palette as a single shape, which is the thing you cannot see
// once it has been broken into two columns of swatches.

export function BrandFigure() {
  return (
    <HeroPanel>
      <div className="grid place-items-center px-6 py-12">
        <Logo className="h-16 w-auto" />
      </div>

      <div className="grid grid-cols-6">
        {PIGGLES_GROUPS.map((group) => (
          <div key={group} data-group={group} className="bg-module h-16" />
        ))}
      </div>

      <p className="px-5 py-4 text-base font-semibold">
        One pink, six group hues, and a warm off-white to stand them on.
      </p>
    </HeroPanel>
  );
}
