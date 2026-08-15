'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import type { PigglesGroup } from '@piggles/brand';
import { accountUrl, APP_BY_ID, APPS, appIcon } from '@piggles/config';
import { PigglesMascot } from '@piggles/mascot/react';
import type { MascotPoseId } from '@piggles/mascot';

// Two inline arrows rather than an icon import. apps/web has no icon package of
// its own — the only one in the workspace arrives through @piggles/config as APP
// ICONS, which is the right dependency for a rail glyph and the wrong one for a
// chevron — and a new dependency needs asking for. They inherit `currentColor`,
// so they are correct on any surface without being told which one.
function ArrowDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        d="M12 4v15M6 13.5 12 20l6-6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        d="M4 12h15M13 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── THE DAY ──────────────────────────────────────────────────────────────────
//
// One app window, pinned to the viewport, with an ordinary Thursday scrolling
// through it. Six beats: each lights a different app in the rail, moves the
// clock, changes the mascot's pose, and opens one more window on the desk —
// which then STAYS. By the last beat the desk is full, which is the product's
// central claim happening in front of somebody instead of being asserted above
// a screenshot.
//
// ── WHY THIS REPLACED THE HERO + THE COLLAGE ────────────────────────────────
//
// The page used to depict the workspace TWICE: four cards in the hero, then the
// same four things again in a different layout under "keep what you're working
// on open together". Two depictions of one screen is the page arguing with its
// own headline. There is now exactly one, and the argument is what the page does
// to it over six screens of scroll.
//
// ── WHY THIS IS THE ONE CLIENT COMPONENT ────────────────────────────────────
//
// Everything else on this site is a server component and must stay that way
// (see home.tsx). This needs a scroll position, so it is `'use client'` — the
// same exception the header and the FAQ already take. Nothing else moved across
// the boundary: the six beats are static data rendered here, not fetched.
//
// ── NO INLINE STYLES ────────────────────────────────────────────────────────
//
// Every hue comes from `data-group`, which repoints `--color-module` for that
// subtree (@piggles/brand theme.css), so the windows and rail wear their app's
// colour through `text-module` / `bg-module` / `border-module` rather than
// through a `--hue` variable set at the call site. Window positions are Tailwind
// arbitrary values in literal class strings — Tailwind scans this file, so they
// generate. The only bespoke CSS is `.day-desk`'s dot grid, which is a
// background-image and has nowhere else to live (globals.css).

interface Row {
  label: string;
  sub: string;
  /** Right-hand side: a badge, or a figure to shout. */
  badge?: { text: string; tone: 'module' | 'success' | 'warning' };
  figure?: string;
}

interface Beat {
  /** Minutes past midnight. The clock lands exactly here. */
  at: number;
  when: string;
  /** Apps this beat lights in the rail. First one is the hot one. */
  lights: string[];
  group: PigglesGroup;
  pose: MascotPoseId;
  heading: string;
  body: string;
  window: { title: string; rows: Row[] };
  /** Position on the desk. Literal Tailwind classes so they generate. */
  place: string;
}

// The composition is two staggered columns of varying width. It was a single
// overlapping cascade first, which looked more like a real desk and also put My
// Site on top of the reorder line and Money on top of "card or bank transfer".
// A window covering another window's words is a defect, not charm; the offset
// tops carry the workspace feeling on their own.
const BEATS: Beat[] = [
  {
    at: 460,
    when: '07:40 · Bookings',
    lights: ['bookings'],
    group: 'people',
    pose: 'calendar',
    heading: 'It booked itself while you were asleep.',
    body: 'Somebody found your site at half eleven last night and took a place. No email to read, no diary to copy it into.',
    place: 'left-[33%] top-[3%] w-[26%]',
    window: {
      title: 'Bookings',
      rows: [
        {
          label: 'Wreath workshop',
          sub: 'Saturday · 10:00',
          badge: { text: '6 of 8', tone: 'module' },
        },
        {
          label: 'Two seats taken',
          sub: 'Booked online · 23:14',
          badge: { text: 'New', tone: 'success' },
        },
      ],
    },
  },
  {
    at: 545,
    when: '09:05 · Customers',
    lights: ['customers', 'messages'],
    group: 'people',
    pose: 'neutral',
    heading: 'You know who they are before they finish the sentence.',
    body: 'Every order, message and booking they have ever made is on the same card. Not in a separate system you pay separately for.',
    place: 'left-[65%] top-[17%] w-[28%]',
    window: {
      title: 'Customers',
      rows: [
        {
          label: 'Regular customer',
          sub: '4 orders · 2 workshops',
          badge: { text: 'Repeat', tone: 'module' },
        },
        {
          label: 'Last message',
          sub: '“Same again for the shop window?”',
          badge: { text: 'Reply', tone: 'warning' },
        },
      ],
    },
  },
  {
    at: 680,
    when: '11:20 · Sell & Stock',
    lights: ['sell', 'stock'],
    group: 'sell',
    pose: 'thinking',
    heading: 'Sell one. The shelf count moves on its own.',
    body: 'You didn’t type it anywhere. Selling and counting are not two products here, so they cannot disagree with each other.',
    place: 'left-[36%] top-[32%] w-[27%]',
    window: {
      title: 'Sell → Stock',
      rows: [
        {
          label: 'Order taken',
          sub: '3 × hand-tied bouquet',
          badge: { text: 'Paid', tone: 'success' },
        },
        { label: 'Left on the shelf', sub: 'Was 14', figure: '11' },
        {
          label: 'Ribbon, 25mm',
          sub: 'Below your reorder point',
          badge: { text: 'Reorder', tone: 'warning' },
        },
      ],
    },
  },
  {
    at: 825,
    when: '13:45 · Invoices',
    lights: ['invoices'],
    group: 'money',
    pose: 'invoice',
    heading: 'The invoice already knew what the job was.',
    body: 'It was the booking half an hour ago. You added a line and sent it. Nothing was copied from one screen into another.',
    place: 'left-[68%] top-[43%] w-[26%]',
    window: {
      title: 'Invoices',
      rows: [
        {
          label: 'INV-2214',
          sub: 'From Saturday’s workshop',
          badge: { text: 'Sent', tone: 'success' },
        },
        { label: 'Due', sub: 'Card or bank transfer', figure: '$340' },
      ],
    },
  },
  {
    at: 930,
    when: '15:30 · My Site',
    lights: ['site'],
    group: 'web',
    pose: 'laptop',
    heading: 'Your website is not a different company.',
    body: 'It is the same products, the same prices and the same calendar you have been looking at all day. Change one, it changes everywhere.',
    place: 'left-[34%] top-[63%] w-[25%]',
    window: {
      title: 'My Site',
      rows: [
        {
          label: 'Spring arrivals',
          sub: 'New page · live now',
          badge: { text: 'Published', tone: 'success' },
        },
        {
          label: 'Workshop page',
          sub: 'Shows 2 seats left',
          badge: { text: 'Auto', tone: 'module' },
        },
      ],
    },
  },
  {
    at: 1070,
    when: '17:50 · That’s the day',
    lights: ['money'],
    group: 'money',
    pose: 'celebrate',
    // Eight and seven, not six and nine. The rail lights eight apps across the
    // day and a visitor can count both numbers on screen — a claim the page
    // makes with its own furniture has to survive being checked.
    heading: 'Eight apps before six o’clock. You opened one.',
    body: 'The other seven were there the whole time — content, suppliers, staff, automations, the rest. Not an upgrade. Not an add-on. Just not needed today.',
    place: 'left-[64%] top-[69%] w-[28%]',
    window: {
      title: 'Money',
      rows: [
        { label: 'Taken today', sub: 'Shop, site and workshop', figure: '$1,286' },
        { label: 'Still owed', sub: '1 invoice out', badge: { text: '$340', tone: 'warning' } },
      ],
    },
  },
];

/** Offsets and sizes for the ground field, cycled by index. Five and three
 *  against fifteen apps, so no two neighbours share a hue AND an offset. */
const JITTER = [
  'translate-x-1/3',
  '-translate-x-2 translate-y-4 rotate-6',
  'translate-x-8 -translate-y-3 -rotate-3',
  '-translate-x-6 translate-y-1 rotate-12',
  'translate-x-2 translate-y-6 -rotate-6',
];
const GLYPH = ['size-8', 'size-10', 'size-7'];

/** Beat 0 is the cold open — an empty desk and the headline. */
const OPENING = 420;
const STOPS = [OPENING, ...BEATS.map((b) => b.at)];

const clockOf = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/** Which apps are lit by the time you reach `beat`. */
const litBy = (beat: number) => new Set(BEATS.slice(0, beat).flatMap((b) => b.lights));

function WindowRows({ rows }: { rows: Row[] }) {
  return (
    <div className="grid gap-2 px-3.5 pt-3 pb-4">
      {rows.map((row, i) => (
        <div key={row.label}>
          {i > 0 && <div className="bg-base-300 mb-2 h-px" />}
          <div className="flex items-center justify-between gap-2.5">
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="text-sm font-semibold">{row.label}</b>
              <span className="text-sm">{row.sub}</span>
            </span>
            {row.badge && (
              <Badge color={row.badge.tone} variant="soft">
                {row.badge.text}
              </Badge>
            )}
            {row.figure && (
              <span className="text-module font-heading text-3xl font-extrabold tabular-nums">
                {row.figure}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function DeskWindow({ beat, state }: { beat: Beat; state: 'ghost' | 'on' | 'hot' }) {
  const Icon = appIcon(beat.lights[0]!);
  return (
    <div
      data-group={beat.group}
      className={[
        'rounded-box overflow-hidden transition-[background-color,border-color,box-shadow,opacity] duration-300',
        state === 'ghost'
          ? 'border-base-300 border-[1.5px] border-dashed bg-transparent'
          : 'bg-base-100 border-base-300 border',
        state === 'hot' && 'border-module ring-module z-40 ring-1',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={`border-base-300 flex items-center gap-2.5 border-b px-3.5 py-2.5 text-sm font-semibold transition-opacity duration-300 ${
          state === 'ghost' ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <span className="bg-module bg-soft text-module grid size-5 place-items-center rounded-md">
          <Icon aria-hidden className="size-3" strokeWidth={2.2} />
        </span>
        {beat.window.title}
      </div>
      <div className={`transition-opacity duration-300 ${state === 'ghost' ? 'opacity-0' : ''}`}>
        <WindowRows rows={beat.window.rows} />
      </div>
    </div>
  );
}

export function TheDay() {
  const filmRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const noteRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [beat, setBeat] = useState(0);
  const [mins, setMins] = useState(OPENING);
  const [pinned, setPinned] = useState(true);

  // Pinned is a layout question, so it is answered by the same media query the
  // stylesheet uses rather than by a width read that can disagree with it.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1081px)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setPinned(mq.matches && !motion.matches);
    sync();
    mq.addEventListener('change', sync);
    motion.addEventListener('change', sync);
    return () => {
      mq.removeEventListener('change', sync);
      motion.removeEventListener('change', sync);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (pinned) {
        const film = filmRef.current;
        if (!film) return;
        const travel = film.offsetHeight - window.innerHeight;
        const p = Math.min(1, Math.max(0, -film.getBoundingClientRect().top / travel));
        const n = Math.min(STOPS.length - 1, Math.floor(p * STOPS.length));
        setBeat(n);
        // The clock moves on the way INTO a beat and then holds at that beat's
        // stated time, so the header and the sentence beside it never disagree
        // while somebody is reading them.
        const f = Math.min(STOPS.length - 0.0001, p * STOPS.length);
        const i = Math.floor(f);
        const ramp = Math.min(1, (f - i) / 0.3);
        const from = STOPS[i - 1] ?? STOPS[0]!;
        setMins(Math.round(from + ramp * (STOPS[i]! - from)));
        return;
      }
      // Small screens: the sentence sitting on the reading line — just under the
      // pinned window — is the beat you are on.
      const line = window.innerHeight * 0.66;
      let n = 0;
      noteRefs.current.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top <= line) n = i + 1;
      });
      setBeat(n);
      setMins(STOPS[n]!);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [pinned]);

  // Small screens only: keep the newest window in view by SCROLLING the column,
  // not by transforming it. A transform would need an inline style; scrollTo is
  // a DOM call and needs none.
  useEffect(() => {
    const stack = stackRef.current;
    if (pinned || !stack) return;
    const target = stack.children[Math.max(0, beat - 1)] as HTMLElement | undefined;
    stack.scrollTo({
      top: beat === 0 || !target ? 0 : target.offsetTop - 12,
      behavior: 'smooth',
    });
  }, [beat, pinned]);

  const lit = litBy(beat);
  const active = beat > 0 ? BEATS[beat - 1]! : null;

  const railRow = (
    <nav
      aria-label="Apps"
      // Both the rail and the desk carry an EXPLICIT cell. The desk had
      // `row-start-2` and the rail had none, so grid placed the definite item
      // first and the auto one after it — the desk took the 70px rail column and
      // the rail took the desk, which left the hero rendering into a 70px box.
      className="bg-base-100 border-base-300 col-start-1 row-start-3 grid grid-cols-8 justify-items-center gap-1 border-t px-2.5 py-2 lg:col-start-1 lg:row-start-2 lg:flex lg:flex-col lg:items-center lg:gap-0.5 lg:border-t-0 lg:border-r lg:px-0 lg:py-3"
    >
      {APPS.map((app) => {
        const Icon = appIcon(app.id);
        const isLit = lit.has(app.id);
        const isHot = active?.lights[0] === app.id;
        return (
          <span
            key={app.id}
            data-group={app.group}
            title={app.label}
            className={[
              'rounded-field grid size-8 place-items-center transition-colors duration-300 lg:size-10',
              isHot
                ? 'bg-module text-module-content scale-105'
                : isLit
                  ? 'bg-module bg-soft text-module'
                  : 'text-base-content/45',
            ].join(' ')}
          >
            <Icon aria-hidden className="size-4 lg:size-5" strokeWidth={1.8} />
          </span>
        );
      })}
    </nav>
  );

  const coldOpen = (
    <div
      className={`px-4 transition-opacity duration-500 lg:absolute lg:inset-0 lg:grid lg:place-items-center lg:px-[7%] lg:text-center ${
        beat === 0 ? 'opacity-100' : 'lg:pointer-events-none lg:opacity-0'
      }`}
    >
      <div>
        <h1 className="text-4xl leading-[1.02] font-black sm:text-5xl lg:text-7xl">
          Your whole business.
          <br className="hidden lg:inline" /> One screen.
        </h1>
        <p className="mt-5 max-w-[52ch] text-lg sm:text-xl lg:mx-auto">
          Fifteen apps that already know about each other. Here is an ordinary Thursday, on one
          login.
        </p>
        <div className="mt-7 flex flex-wrap gap-3 lg:justify-center">
          <a
            className={buttonClasses({ color: 'primary', size: 'xl' })}
            href={accountUrl('signup', 'home-hero')}
          >
            Start free
          </a>
          <a
            className={buttonClasses({ color: 'neutral', variant: 'outline', size: 'xl' })}
            href="#apps"
          >
            See what&rsquo;s included
          </a>
        </div>
        <ul className="mt-6 flex flex-wrap gap-x-7 gap-y-2 lg:justify-center">
          {['Free for 14 days', 'All fifteen apps included', 'No card needed'].map((line) => (
            <li key={line} className="text-base font-semibold">
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <div ref={filmRef} className="relative lg:h-[640vh]">
      {/* The ground — a field of the fifteen glyphs in their own group hues.
          The app icons rather than the mark: a repeated logo is stationery,
          these are the fifteen things the page is about, so the texture states
          the claim before a word of it is read.

          It never goes inside the desk. The desk depicts the software, and no
          real workspace has patterned wallpaper — putting it there would be the
          one place the picture of the product stops being true.

          Sticky with its height reclaimed on the stage below, so its range ends
          exactly where the film does. Pinned any longer and the glyphs sit
          behind the trade wall's body copy, which reads as clutter. */}
      <div
        aria-hidden
        className="pointer-events-none sticky top-0 z-0 hidden h-screen overflow-hidden opacity-[0.13] lg:block"
      >
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-y-14">
          {Array.from({ length: 120 }, (_, i) => {
            const app = APPS[i % APPS.length]!;
            const Icon = appIcon(app.id);
            return (
              <span
                key={i}
                data-group={app.group}
                // Cycled rather than random: a perfect grid reads as wallpaper
                // and a re-rolled one would crawl on every resize. Five offsets
                // over fifteen icons never line up, so the field looks scattered
                // and stays reproducible. Literal class strings — Tailwind scans
                // this file, and a template would generate nothing.
                className={`text-module grid place-items-center ${JITTER[i % JITTER.length]}`}
              >
                <Icon aria-hidden className={GLYPH[i % GLYPH.length]} strokeWidth={1.7} />
              </span>
            );
          })}
        </div>
      </div>

      <div className="z-[1] grid content-center justify-items-center gap-2.5 px-2.5 pt-2.5 pb-4 lg:sticky lg:top-0 lg:-mt-[100vh] lg:h-screen lg:gap-3.5 lg:px-4 lg:pt-4.5 lg:pb-5">
        {/* On a small screen the hero sits ABOVE the pinned window; it could
            never fit inside a 58vh desk. */}
        <div className="w-full lg:hidden">{coldOpen}</div>

        <div className="bg-base-200 rounded-section border-base-300 grid h-[58vh] max-h-[470px] w-full grid-rows-[2.875rem_1fr_auto] overflow-hidden border lg:h-[min(730px,calc(100vh-124px))] lg:max-h-none lg:w-[min(1440px,100%)] lg:grid-cols-[4.375rem_1fr] lg:grid-rows-[3.25rem_1fr]">
          <div className="bg-base-100 border-base-300 col-span-full flex items-center gap-3.5 border-b px-4.5">
            <span className="flex gap-1.5" aria-hidden>
              <i className="bg-base-300 size-2.5 rounded-full" />
              <i className="bg-base-300 size-2.5 rounded-full" />
              <i className="bg-base-300 size-2.5 rounded-full" />
            </span>
            <span className="truncate text-sm font-semibold">
              Wildroot Flowers{' '}
              <span className="hidden font-normal sm:inline">— an example workspace</span>
            </span>
            <span className="ml-auto flex items-center gap-2 text-sm whitespace-nowrap">
              <b className="text-base font-bold tabular-nums">{clockOf(mins)}</b>
              <span className="font-medium">Thursday</span>
            </span>
          </div>

          {railRow}

          <div className="day-desk relative col-start-1 row-start-2 overflow-hidden lg:col-start-2">
            <div className="hidden lg:block">{coldOpen}</div>

            {/* Desktop: the six windows in their fixed places on the desk.
                A window that hasn't happened yet is an outline where it will
                land, so the shape of the whole day is visible from the first
                beat and filling it up reads as progress. */}
            <div className={`hidden lg:block ${beat === 0 ? 'lg:opacity-0' : ''}`}>
              {BEATS.map((b, i) => (
                <div key={b.when} className={`absolute ${b.place}`}>
                  <DeskWindow beat={b} state={beat === i + 1 ? 'hot' : beat > i ? 'on' : 'ghost'} />
                </div>
              ))}
            </div>

            {/* Small screens: the desk cannot hold a six-window cascade at
                390px, so they stack in a column and the column scrolls to keep
                the newest in view — the same accumulation, read vertically. */}
            <div
              ref={stackRef}
              className="grid auto-rows-max gap-3 overflow-hidden p-3 pb-16 lg:hidden"
            >
              {BEATS.map((b, i) => (
                <DeskWindow
                  key={b.when}
                  beat={b}
                  state={beat === i + 1 ? 'hot' : beat > i ? 'on' : 'ghost'}
                />
              ))}
            </div>

            {/* Desktop: the sentence sits ON the desk, in the space the windows
                are laid out to leave clear, so it reads as annotation on the
                software rather than as a caption beside a screenshot. */}
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

            <div className="pointer-events-none absolute right-2.5 bottom-2 lg:right-auto lg:bottom-[2%] lg:left-[4.5%]">
              <PigglesMascot
                key={active?.pose ?? 'wave'}
                pose={active?.pose ?? 'wave'}
                size="sm"
                priority
                className="w-16 lg:w-36"
              />
            </div>
          </div>
        </div>

        {/* The film's own controls. The hint used to live inside the cold open,
            where it vanished the moment the day started — so from beat one there
            was nothing saying how long this goes on for or how to get out of it.
            Six screens of pinned scroll needs both, and the way out has to be on
            screen the whole time rather than only at the start. */}
        <div className="bg-base-100 border-base-300 rounded-field flex w-full items-center justify-between gap-4 border py-2 pr-2 pl-4 lg:w-[min(1440px,100%)] lg:pl-5">
          <div className="flex min-w-0 items-center gap-3 text-sm font-semibold lg:text-base">
            {beat === 0 ? (
              <>
                <ArrowDown className="text-primary size-4.5 motion-safe:animate-bounce" />
                Scroll to run the day
              </>
            ) : (
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
            )}
          </div>
          <a className={buttonClasses({ color: 'neutral', variant: 'outline' })} href="#whoever">
            Skip the day <ArrowRight className="size-4" />
          </a>
        </div>
      </div>

      {/* Small screens: one sentence per screenful, scrolling past the pinned
          window. This is what makes the film SURVIVE on a phone instead of
          collapsing into a static list of six cards — which is not a degraded
          version of the idea, it is the absence of it. */}
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
    </div>
  );
}

function BeatCopy({ beat }: { beat: Beat }) {
  return (
    <div data-group={beat.group}>
      <span className="bg-module bg-soft text-module inline-flex items-center rounded-full px-3.5 py-2 text-sm font-semibold tabular-nums">
        {beat.when}
      </span>
      <h2 className="mt-4 text-[clamp(1.55rem,6.4vw,2.1rem)] leading-[1.07] font-extrabold lg:text-[clamp(1.75rem,2.7vw,2.625rem)]">
        {beat.heading}
      </h2>
      <p className="mt-3.5 text-lg">{beat.body}</p>
    </div>
  );
}
