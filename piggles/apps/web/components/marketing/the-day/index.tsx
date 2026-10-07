'use client';

import { useRef } from 'react';
import { BEATS } from './beats';
import { ColdOpen, HOME_INTRO, type DayIntro } from './cold-open';
import { DayWindow } from './day-window';
import { FilmControls, PhoneNotes } from './film-controls';
import { GroundField } from './ground-field';
import { useContained, useDayClock, useStackFollow } from './use-beat';

export type { DayIntro } from './cold-open';

// The one client component on the site: it needs a scroll position. No inline
// styles: hues come from `data-group` repointing `--color-module`, positions are
// literal Tailwind classes, and `.day-desk`'s dot grid lives in globals.css.

// A dark `data-theme` island is the window's mat; the window nests a light island
// so the product keeps looking like the product. The act costs the page one
// screen, capped at 71rem so the mat's padding never comes off the window.
export function TheDay({ intro = HOME_INTRO }: { intro?: DayIntro }) {
  const deskRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const noteRefs = useRef<(HTMLDivElement | null)[]>([]);
  const contained = useContained();
  const { beat, mins, onDeskScroll } = useDayClock(contained, deskRef, noteRefs);
  useStackFollow(stackRef, beat, contained);
  const active = beat > 0 ? BEATS[beat - 1]! : null;
  const coldOpen = <ColdOpen intro={intro} beat={beat} />;

  return (
    <div data-theme="dark" className="bg-base-300 relative lg:bg-transparent">
      <div className="grid lg:h-screen lg:max-h-[71rem]">
        {/* The padding IS the mat; the window takes the `1fr` row and the
            controls sit under it, so a tall screen grows the window, not the mat. */}
        <div className="bg-base-300 relative grid w-full content-center justify-items-center gap-2.5 overflow-hidden px-2.5 pt-12 pb-12 lg:h-full lg:grid-rows-[1fr_auto] lg:gap-5 lg:px-4 lg:pt-24 lg:pb-20">
          <GroundField />
          {/* Small screens: the hero sits ABOVE the window; a 58vh desk cannot hold it. */}
          <div className="relative w-full lg:hidden">{coldOpen}</div>
          <DayWindow
            deskRef={deskRef}
            stackRef={stackRef}
            onDeskScroll={onDeskScroll}
            beat={beat}
            mins={mins}
            active={active}
            coldOpen={coldOpen}
          />
          <FilmControls beat={beat} active={active} />
        </div>
      </div>
      <PhoneNotes noteRefs={noteRefs} />
    </div>
  );
}
