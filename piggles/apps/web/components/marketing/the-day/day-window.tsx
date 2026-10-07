import type { ReactNode, RefObject } from 'react';
import type { Beat } from './beats';
import { AppRail } from './app-rail';
import { clockOf } from './clock';
import { Desk } from './desk';

function TitleBar({ mins }: { mins: number }) {
  return (
    <div className="bg-base-100 border-base-300 col-span-full flex items-center gap-3.5 border-b px-4.5">
      <span className="flex gap-1.5" aria-hidden>
        <i className="bg-base-300 size-2.5 rounded-full" />
        <i className="bg-base-300 size-2.5 rounded-full" />
        <i className="bg-base-300 size-2.5 rounded-full" />
      </span>
      <span className="truncate text-sm font-semibold">
        Wildroot Flowers{' '}
        <span className="hidden font-normal sm:inline">(an example workspace)</span>
      </span>
      <span className="ml-auto flex items-center gap-2 text-sm whitespace-nowrap">
        <b className="text-base font-bold tabular-nums">{clockOf(mins)}</b>
        <span className="font-medium">Thursday</span>
      </span>
    </div>
  );
}

interface DayWindowProps {
  deskRef: RefObject<HTMLDivElement | null>;
  stackRef: RefObject<HTMLDivElement | null>;
  onDeskScroll: () => void;
  beat: number;
  mins: number;
  active: Beat | null;
  coldOpen: ReactNode;
}

// The lit window: `data-theme="light"` keeps the console a light product inside
// the dark act. It fills its row (`lg:h-full`) and places windows by percentage,
// so a tall display just gets a roomier desk instead of more blank mat.
export function DayWindow({ mins, beat, active, ...desk }: DayWindowProps) {
  return (
    <div
      data-theme="light"
      className="bg-base-200 rounded-section border-base-300 relative grid h-[58vh] max-h-[470px] w-full grid-rows-[2.875rem_1fr_auto] overflow-hidden border lg:h-full lg:max-h-none lg:w-[min(1440px,100%)] lg:grid-cols-[4.375rem_1fr] lg:grid-rows-[3.25rem_1fr]"
    >
      <TitleBar mins={mins} />
      <AppRail beat={beat} active={active} />
      <Desk beat={beat} active={active} {...desk} />
    </div>
  );
}
