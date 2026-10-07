import type { RefObject } from 'react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { APP_BY_ID } from '@piggles/config';
import { ArrowDown, ArrowRight } from './arrows';
import { BEATS, type Beat } from './beats';
import { BeatCopy } from './beat-copy';

function Progress({ beat, active }: { beat: number; active: Beat | null }) {
  return (
    <>
      <span className="flex gap-1.5" aria-hidden>
        {BEATS.map((b, i) => (
          <i
            key={b.when}
            data-group={b.group}
            className={`h-1.5 w-6.5 rounded-full transition-colors duration-300 ${
              i < beat ? 'bg-module' : 'bg-base-300'
            }`}
          />
        ))}
      </span>
      <span className="hidden truncate font-bold lg:inline">
        {active ? APP_BY_ID[active.lights[0]!]?.label : ''}
      </span>
    </>
  );
}

// The film's own controls, on screen the whole time: how long the day runs and
// the way out of it. `#why` so skipping the day lands on the beat after it.
export function FilmControls({ beat, active }: { beat: number; active: Beat | null }) {
  return (
    <div className="bg-base-100 border-base-300 rounded-field relative flex w-full items-center justify-between gap-4 border py-2 pr-2 pl-4 lg:w-[min(1440px,100%)] lg:pl-5">
      <div className="flex min-w-0 items-center gap-3 text-sm font-semibold lg:text-base">
        {beat === 0 ? (
          <>
            <ArrowDown className="text-primary size-4.5 motion-safe:animate-bounce" />
            Scroll to run the day
          </>
        ) : (
          <Progress beat={beat} active={active} />
        )}
      </div>
      <a className={buttonClasses({ variant: 'outline' })} href="#why">
        Skip the day <ArrowRight className="size-4" />
      </a>
    </div>
  );
}

/** Small screens: one sentence per screenful scrolling past the pinned window,
 *  which is what keeps the film a film on a phone rather than a list of cards. */
export function PhoneNotes({ noteRefs }: { noteRefs: RefObject<(HTMLDivElement | null)[]> }) {
  return (
    <div className="lg:hidden">
      {BEATS.map((b, i) => (
        <div
          key={b.when}
          ref={(el) => {
            noteRefs.current[i] = el;
          }}
          className="mx-auto min-h-[76vh] max-w-[620px] px-5 pt-6"
        >
          <BeatCopy beat={b} />
        </div>
      ))}
    </div>
  );
}
