import type { ReactNode, RefObject } from 'react';
import { PigglesMascot } from '@piggles/mascot/react';
import { BEATS, type Beat } from './beats';
import { BeatCopy } from './beat-copy';
import { OPENING_POSE } from './clock';
import { DeskWindow, windowState } from './desk-window';

/** Desktop: each window in its fixed place, ghosted until its beat, so the shape
 *  of the whole day is visible from the first beat and filling it reads as progress. */
function PlacedWindows({ beat }: { beat: number }) {
  return (
    <div className={`hidden lg:block ${beat === 0 ? 'lg:opacity-0' : ''}`}>
      {BEATS.map((b, i) => (
        <div key={b.when} className={`absolute ${b.place}`}>
          <DeskWindow beat={b} state={windowState(beat, i)} />
        </div>
      ))}
    </div>
  );
}

/** Small screens: the same accumulation, stacked in a column that scrolls. */
function StackedWindows({
  beat,
  stackRef,
}: {
  beat: number;
  stackRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={stackRef} className="grid auto-rows-max gap-3 overflow-hidden p-3 pb-16 lg:hidden">
      {BEATS.map((b, i) => (
        <DeskWindow key={b.when} beat={b} state={windowState(beat, i)} />
      ))}
    </div>
  );
}

/** Desktop: the sentence sits ON the desk, in the space the windows leave clear,
 *  so it reads as annotation on the software rather than a caption. */
function DeskNotes({ beat }: { beat: number }) {
  return (
    <>
      {BEATS.map((b, i) => (
        <div
          key={b.when}
          className={`absolute top-[9%] left-[3.4%] hidden w-[28%] min-w-[260px] transition-opacity duration-300 lg:block ${
            beat === i + 1 ? 'opacity-100 delay-200' : 'pointer-events-none opacity-0'
          }`}
          aria-hidden={beat !== i + 1}
        >
          <BeatCopy beat={b} />
        </div>
      ))}
    </>
  );
}

// Sized by the `size` prop, never a width class: `size` also sets the srcset
// hint, and a width class once upscaled a 96px fetch to 144. The pose is the key
// so a pose change re-mounts her; the fallback is the cold open's, hence priority.
function DeskMascot({ active }: { active: Beat | null }) {
  return (
    <div className="pointer-events-none absolute right-2.5 bottom-2 lg:right-auto lg:bottom-[2%] lg:left-[4.5%]">
      <PigglesMascot
        key={active?.pose ?? OPENING_POSE}
        pose={active?.pose ?? OPENING_POSE}
        size={{ base: 'sm', lg: 'md' }}
        priority
      />
    </div>
  );
}

interface DeskProps {
  deskRef: RefObject<HTMLDivElement | null>;
  stackRef: RefObject<HTMLDivElement | null>;
  onDeskScroll: () => void;
  beat: number;
  active: Beat | null;
  coldOpen: ReactNode;
}

// THE DESK IS THE SCROLLPORT: a sticky layer one deskful tall over a spacer.
// `overscroll-auto` is deliberate, so the last beat hands the scroll back to the page.
export function Desk({ deskRef, stackRef, onDeskScroll, beat, active, coldOpen }: DeskProps) {
  return (
    <div
      ref={deskRef}
      onScroll={onDeskScroll}
      className="day-desk relative col-start-1 row-start-2 overflow-hidden lg:col-start-2 lg:[scrollbar-width:none] lg:overflow-y-auto lg:overscroll-auto"
    >
      <div className="relative lg:sticky lg:top-0 lg:h-full">
        <div className="hidden lg:block">{coldOpen}</div>
        <PlacedWindows beat={beat} />
        <StackedWindows beat={beat} stackRef={stackRef} />
        <DeskNotes beat={beat} />
        <DeskMascot active={active} />
      </div>
      {/* The scroll budget: six deskfuls for six beats, costing the page nothing. */}
      <div aria-hidden className="hidden lg:block lg:h-[600%]" />
    </div>
  );
}
