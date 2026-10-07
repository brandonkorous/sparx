import type { ReactNode } from 'react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { accountUrl, APP_COUNT_WORD, APP_COUNT_WORD_CAP } from '@piggles/config';

/** The hero a page puts over the empty desk before the day starts. */
export interface DayIntro {
  heading: ReactNode;
  lede: ReactNode;
  /** Signup placement, passed to `accountUrl('signup', from)`. */
  from: string;
  secondary: { label: string; href: string };
  assurances: string[];
}

export const HOME_INTRO: DayIntro = {
  heading: (
    <>
      Your whole business.
      <br className="hidden lg:inline" /> One screen.
    </>
  ),
  lede: (
    <>
      {APP_COUNT_WORD_CAP} apps that already know about each other. Here is an ordinary Thursday, on
      one login.
    </>
  ),
  from: 'home-hero',
  secondary: { label: 'See what’s included', href: '#apps' },
  assurances: ['Free for 14 days', `All ${APP_COUNT_WORD} apps included`, 'No card needed'],
};

// The hero has its own ground: `bg-accent bg-soft` marks where marketing stops
// and the product starts, and beat 1 lifts it to reveal the desk. Soft, because
// solid accent would outshout the Start free button.
export function ColdOpen({ intro, beat }: { intro: DayIntro; beat: number }) {
  return (
    <div
      className={`rounded-section bg-accent bg-soft px-5 py-9 transition-opacity duration-500 sm:px-8 sm:py-11 lg:absolute lg:inset-0 lg:grid lg:place-items-center lg:rounded-none lg:px-[7%] lg:py-0 lg:text-center ${
        beat === 0 ? 'opacity-100' : 'lg:pointer-events-none lg:opacity-0'
      }`}
    >
      <div>
        <h1 className="text-4xl leading-[1.02] font-black sm:text-5xl lg:text-7xl">
          {intro.heading}
        </h1>
        <p className="mt-5 max-w-[52ch] text-lg sm:text-xl lg:mx-auto">{intro.lede}</p>
        <div className="mt-7 flex flex-wrap gap-3 lg:justify-center">
          <a
            className={buttonClasses({ color: 'primary', size: 'xl' })}
            href={accountUrl('signup', intro.from)}
          >
            Start free
          </a>
          {/* No color on the outline: it sits in the window's light island on a
              wide screen and on the dark mat on a phone. Uncolored resolves to
              `base-content`, right on both; `neutral` measured 2.52:1. */}
          <a
            className={buttonClasses({ variant: 'outline', size: 'xl' })}
            href={intro.secondary.href}
          >
            {intro.secondary.label}
          </a>
        </div>
        <ul className="mt-6 flex flex-wrap gap-x-7 gap-y-2 lg:justify-center">
          {intro.assurances.map((line) => (
            <li key={line} className="text-base font-semibold">
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
