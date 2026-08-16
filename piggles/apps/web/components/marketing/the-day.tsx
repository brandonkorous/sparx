'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@piggles/ui';
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
// ── THE SIX POSES: WHERE THE BEAT HAPPENS, NOT WHERE SHE SITS ───────────────
//
//   07:40  Bookings     calendar-desk    a calendar propped beside the laptop
//   09:05  Customers    front-counter    somebody arriving at a service counter
//   11:20  Sell & Stock retail-shop      the shelf the count is coming off
//   13:45  Invoices     reports-desk     a calculator beside the laptop
//   15:30  My Site      desktop-computer a page layout on a monitor, being shown
//   17:50  That's it    desk-celebrate   both fists up, back at the desk
//
// The first version of this put all six at the same round table, and the reason
// was real: the page's premise is that the day never leaves the product, so a
// mascot who never gets up says that in the corner of every frame. Brandon
// pushed on it and he is right — the reason was real and I over-applied it.
//
// What it cost: three of the six beats are not about desk work at all. A
// customer arriving is a counter. A shelf count moving is a shelf. Building a
// website is somebody building. Sending all three back to the same table threw
// away the strongest thing the artwork does, which is TELL YOU WHICH BEAT THIS
// IS without you reading a word — and at this size a laptop is a laptop, so six
// laptops read as one picture that never changes.
//
// The spine survives in a smaller form and is the actual rule now: the day
// STARTS and ENDS at the desk (07:40 and 17:50), and the middle goes wherever
// the work goes. A new beat picks the place its own sentence describes.
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
    pose: 'calendar-desk',
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
    pose: 'front-counter',
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
    pose: 'retail-shop',
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
    pose: 'reports-desk',
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
    pose: 'desktop-computer',
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
    pose: 'desk-celebrate',
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

/** Who stands on the empty desk before the film starts. `active` is null at beat
 *  0, so this is the first mascot anybody sees on the site. */
const OPENING_POSE: MascotPoseId = 'laptop-coffee';
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
  const glyph = appIcon(beat.lights[0]!);
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
          <Icon glyph={glyph} aria-hidden className="size-3" />
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
  const deskRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const noteRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [beat, setBeat] = useState(0);
  const [mins, setMins] = useState(OPENING);
  const [contained, setContained] = useState(true);

  // Which driver runs is a layout question, so it is answered by the same media
  // query the stylesheet uses rather than by a width read that can disagree with
  // it. Reduced motion falls back to the page-scrolled version, where nothing
  // moves except by the reader's own hand.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1081px)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setContained(mq.matches && !motion.matches);
    sync();
    mq.addEventListener('change', sync);
    motion.addEventListener('change', sync);
    return () => {
      mq.removeEventListener('change', sync);
      motion.removeEventListener('change', sync);
    };
  }, []);

  /** Where a scroll position lands: the beat, and the clock on the way into it.
   *  The clock ramps INTO a beat and then holds at that beat's stated time, so
   *  the title bar and the sentence beside it never disagree while somebody is
   *  reading them. */
  const settle = (p: number) => {
    const clamped = Math.min(1, Math.max(0, p));
    setBeat(Math.min(STOPS.length - 1, Math.floor(clamped * STOPS.length)));
    const f = Math.min(STOPS.length - 0.0001, clamped * STOPS.length);
    const i = Math.floor(f);
    const ramp = Math.min(1, (f - i) / 0.3);
    const from = STOPS[i - 1] ?? STOPS[0]!;
    setMins(Math.round(from + ramp * (STOPS[i]! - from)));
  };

  // ── THE DAY SCROLLS INSIDE THE DESK, NOT DOWN THE PAGE ──────────────────────
  //
  // This is the fix for a whole family of "waste of space" bugs, and it is worth
  // being explicit about the cause. The beats used to be driven by the PAGE
  // scrolling past a 640vh spacer with the window pinned to the viewport. Six
  // beats therefore cost six screens of page height that contained nothing —
  // and on a tall display that reservation is enormous (15,522px on a 2,425px
  // window). Every arrangement of that spacer just moved the emptiness around:
  // dark mat, blank page ground, or a cavernous desk. The reservation itself was
  // the bug.
  //
  // The desk is its own scrollport now. Its content is one deskful of visuals
  // plus a spacer, so the day advances by scrolling INSIDE the workspace — which
  // is also what you would do with the real thing — and the section costs the
  // page exactly one screen. Scroll chaining does the rest for free: reach the
  // last beat and the browser hands the scroll back to the page.
  const onDeskScroll = () => {
    const desk = deskRef.current;
    if (!contained || !desk) return;
    settle(desk.scrollTop / (desk.scrollHeight - desk.clientHeight));
  };

  useEffect(() => {
    if (contained) {
      const desk = deskRef.current;
      if (desk) settle(desk.scrollTop / (desk.scrollHeight - desk.clientHeight));
      return;
    }
    // Small screens: the sentence sitting on the reading line — just under the
    // window — is the beat you are on, and the page is what scrolls.
    const onScroll = () => {
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
  }, [contained]);

  // Small screens only: keep the newest window in view by SCROLLING the column,
  // not by transforming it. A transform would need an inline style; scrollTo is
  // a DOM call and needs none.
  useEffect(() => {
    const stack = stackRef.current;
    if (contained || !stack) return;
    const target = stack.children[Math.max(0, beat - 1)] as HTMLElement | undefined;
    stack.scrollTo({
      top: beat === 0 || !target ? 0 : target.offsetTop - 12,
      behavior: 'smooth',
    });
  }, [beat, contained]);

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
        const glyph = appIcon(app.id);
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
            <Icon glyph={glyph} aria-hidden className="size-4 lg:size-5" />
          </span>
        );
      })}
    </nav>
  );

  // ── THE HERO HAS ITS OWN GROUND ──────────────────────────────────────────────
  //
  // It used to have none, which meant it had the DESK's: on a wide screen the
  // cold open is absolutely positioned inside `.day-desk`, so the page's headline
  // was painted straight onto the depiction of the software — same warm off-white,
  // same dot grid, one undifferentiated field from the top of the window to the
  // bottom. Nothing said where the marketing stopped and the product started.
  //
  // `bg-accent bg-soft` is the pale pink wash DESIGN.md §7 sanctions as the one
  // decorative use of brand colour, and it earns three things at once: the hero
  // is now a surface rather than an absence, the desk underneath reads as the
  // product because it is the only thing in the window that ISN'T branded, and
  // beat 1 becomes a reveal — the pink lifts and the workspace is already there.
  //
  // Soft rather than solid `bg-accent`. Solid #FFB3C0 sits close enough to the
  // primary #FF6F86 that the Start free button would stop being the loudest thing
  // in the frame, which is the one job a hero CTA has.
  const coldOpen = (
    <div
      className={`rounded-section bg-accent bg-soft px-5 py-9 transition-opacity duration-500 sm:px-8 sm:py-11 lg:absolute lg:inset-0 lg:grid lg:place-items-center lg:rounded-none lg:px-[7%] lg:py-0 lg:text-center ${
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
          {/* NO COLOUR ON THE OUTLINE, and this one string has to be right on two
              different grounds: on a wide screen the cold open is inside the
              window's LIGHT island, on a phone it sits on the dark mat. Uncoloured,
              it resolves to `base-content` and is correct in both. Pinning
              `neutral` is the 2.52:1 failure close-band.tsx measured. */}
          <a className={buttonClasses({ variant: 'outline', size: 'xl' })} href="#apps">
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
    // ── THE FILM IS A DARK ACT WITH A LIT WINDOW IN IT ─────────────────────────
    //
    // The window is a picture of the console, and a picture needs a mat. It used
    // to have none: the desk canvas, the frame around it and the page behind it
    // were one continuous off-white separated by a hairline, so the thing the
    // whole page is built around did not read as an object at all.
    //
    // Answering that with a third off-white was the wrong instinct — six greys is
    // not a palette. This is a `data-theme="dark"` ISLAND, the same mechanism
    // close-band.tsx documents at length, and the whole point of it is that
    // nothing inside has to be told: the fifteen glyphs in the ground field pick
    // up the LIFTED dark group hues that theme.css already defines for exactly
    // this surface, and every ink flips with them.
    //
    // `bg-base-300` inside it, because the ladder does not change with the mode —
    // base-300 is the GROUND in dark exactly as it is in light. What lifts off it
    // is the window, which carries `data-theme="light"` of its own so the product
    // keeps looking like the product. That nesting is silica's intended idiom,
    // and it is what buys the border back: the frame's `border-base-300` hairline
    // resolves inside the LIGHT island, so it is now a pale edge against a near
    // black ground instead of a border painted its own background's colour.
    //
    // The act ends with the film and the page returns to its own ground for the
    // trade wall — the dark is one beat, not the site's temperament.
    <div data-theme="dark" className="bg-base-300 relative lg:bg-transparent">
      {/* The act costs the page ONE SCREEN, capped. It used to be `640vh` of
          spacer with the window pinned inside it, which is where every version of
          the blank rectangle came from — dark mat, empty page ground, cavernous
          desk. With the day scrolling inside the desk (see `onDeskScroll`) there
          is nothing left to reserve, so this is just a section, and the trade
          wall below it starts where it looks like it starts. */}
      {/* 71rem, not 62: the cap has to carry the mat as well as the demo. The
          window sits on a `1fr` row, so every pixel of padding added to the band
          came straight off the depiction — 876px of window became 731. 62rem +
          the 144px the mat and its gap grew by keeps the window exactly the size
          it was and spends the difference on the ground around it. */}
      <div className="grid lg:h-screen lg:max-h-[71rem]">
        {/* `grid-rows-[1fr_auto]`: the window TAKES the space and the controls sit
            under it. It used to be a content-height row centred in the band, which
            is what left a screenful of mat above and below a 730px window on a
            tall display — the act filled the screen and the depiction did not. */}
        {/* The padding IS the mat. At 18px the dark was a hairline around the
            window and the glyph field had nowhere to show; the window is on a
            `1fr` row, so widening this band is what gives the ground its say
            above and below the demo without the act growing. */}
        <div className="bg-base-300 relative grid w-full content-center justify-items-center gap-2.5 overflow-hidden px-2.5 pt-12 pb-12 lg:h-full lg:grid-rows-[1fr_auto] lg:gap-5 lg:px-4 lg:pt-24 lg:pb-20">
          {/* The ground — a field of the fifteen glyphs in their own group hues.
              The app icons rather than the mark: a repeated logo is stationery,
              these are the fifteen things the page is about, so the texture
              states the claim before a word of it is read.

              It never goes inside the desk. The desk depicts the software, and no
              real workspace has patterned wallpaper — putting it there would be
              the one place the picture of the product stops being true.

              Absolutely positioned inside the band now, so its extent IS the
              band's. It used to be a sticky `h-screen` sibling that the stage
              pulled back over with `-mt-[100vh]`; with the band no longer a
              viewport tall, that overlay had nothing left to align to. */}
          <div
            aria-hidden
            // 0.2 rather than 0.13: the field used to sit on an off-white ground,
            // and it is now on a near-black one carrying the lifted dark hues.
            // Same apparent weight, different arithmetic.
            className="pointer-events-none absolute inset-0 hidden overflow-hidden opacity-[0.2] lg:block"
          >
            {/* `h-full` + `auto-rows-fr` is what makes the field FILL rather than
                run out. It was `gap-y-14` over content-height rows, so the grid
                was as tall as its item count happened to make it — 120 glyphs
                over ~11 columns is ~11 rows of ~96px, which stops around 1050px
                and leaves the bottom of a taller mat bare. That is a bug that
                only appears on SOME screens, which is the worst kind: it looked
                finished on mine. Rows now take an equal share of the container's
                height instead, so the count decides DENSITY and the container
                decides EXTENT — no magic number to re-tune per screen size, and
                no hundreds of extra icons rendered just to be clipped. */}
            <div className="grid h-full auto-rows-fr grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))]">
              {Array.from({ length: 120 }, (_, i) => {
                const app = APPS[i % APPS.length]!;
                const glyph = appIcon(app.id);
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
                    <Icon glyph={glyph} aria-hidden className={GLYPH[i % GLYPH.length]} />
                  </span>
                );
              })}
            </div>
          </div>

          {/* On a small screen the hero sits ABOVE the pinned window; it could
              never fit inside a 58vh desk. */}
          <div className="relative w-full lg:hidden">{coldOpen}</div>

          {/* The lit window. `data-theme="light"` is what keeps the depiction
              honest inside the dark act — the console is a light product, and a
              band that flipped it dark would be showing software nobody uses.
              Everything below this line resolves against the light palette
              regardless of the mat, which is why not one class inside it changed.

              `relative` so it paints above the absolutely-positioned field, and
              `lg:h-full` so it fills its row rather than sitting at a fixed 730px
              in the middle of one. 730 was the whole problem on a tall display:
              it is a sensible size for a laptop and a postage stamp on a portrait
              monitor, and the difference was being paid in blank mat. The desk
              places its windows by PERCENTAGE, so it just gets roomier. */}
          <div
            data-theme="light"
            className="bg-base-200 rounded-section border-base-300 relative grid h-[58vh] max-h-[470px] w-full grid-rows-[2.875rem_1fr_auto] overflow-hidden border lg:h-full lg:max-h-none lg:w-[min(1440px,100%)] lg:grid-cols-[4.375rem_1fr] lg:grid-rows-[3.25rem_1fr]"
          >
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

            {/* THE DESK IS THE SCROLLPORT. Everything visible sits in a sticky
                layer one deskful tall; the spacer underneath it is what there is
                to scroll through, so the day advances inside the workspace and
                the page keeps its own scrollbar for the page. `overscroll-auto`
                is deliberate — reaching the last beat must hand the scroll back
                to the document rather than trap it. */}
            <div
              ref={deskRef}
              onScroll={onDeskScroll}
              className="day-desk relative col-start-1 row-start-2 overflow-hidden lg:col-start-2 lg:[scrollbar-width:none] lg:overflow-y-auto lg:overscroll-auto"
            >
              <div className="relative lg:sticky lg:top-0 lg:h-full">
                <div className="hidden lg:block">{coldOpen}</div>

                {/* Desktop: the six windows in their fixed places on the desk.
                A window that hasn't happened yet is an outline where it will
                land, so the shape of the whole day is visible from the first
                beat and filling it up reads as progress. */}
                <div className={`hidden lg:block ${beat === 0 ? 'lg:opacity-0' : ''}`}>
                  {BEATS.map((b, i) => (
                    <div key={b.when} className={`absolute ${b.place}`}>
                      <DeskWindow
                        beat={b}
                        state={beat === i + 1 ? 'hot' : beat > i ? 'on' : 'ghost'}
                      />
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

                {/* SIZED BY THE `size` PROP, NEVER BY A WIDTH CLASS — this is why
                she used to be blurry.

                It was `size="sm"` with `className="w-16 lg:w-36"`. `size` sets
                BOTH the Tailwind width and the `sizes` hint that decides which
                srcset entry the browser downloads; a width class lands last in
                the class string, so it won the layout while the hint still said
                96px. The browser fetched a 96px-wide image and CSS stretched it
                to 144 — a 1.5× upscale on every frame of the film. It is the
                exact failure @piggles/mascot's header warns about in capital
                letters: the image looks right and arrives under-resolved.

                `{ base: 'sm', lg: 'md' }` is 96px on a phone and 176px from `lg`,
                with the hint moving with it. Sharper AND bigger than what was
                there — and 176 is what these poses need, because they are scenes
                rather than the figure alone: at 144 the prop that says which beat
                this is was a smudge. On a phone she stays small on purpose; there
                the copy carries the beat and she is company, not information. */}
                {/* The fallback is the COLD OPEN's pose — `active` is null at beat
                    0 — so it is the first mascot anybody sees on the site, and it
                    ships with `priority`. It was `laptop-coffee` (batch 05); this
                    is the batch 07 cut. Named once, because it appeared twice and
                    the two are required to agree: React keys off it to re-mount
                    on a pose change. */}
                <div className="pointer-events-none absolute right-2.5 bottom-2 lg:right-auto lg:bottom-[2%] lg:left-[4.5%]">
                  <PigglesMascot
                    key={active?.pose ?? OPENING_POSE}
                    pose={active?.pose ?? OPENING_POSE}
                    size={{ base: 'sm', lg: 'md' }}
                    priority
                  />
                </div>
              </div>

              {/* The scroll budget, and the ONLY thing in the section that is
                  taller than what you can see. Six deskfuls for six beats — the
                  same pacing the page-scrolled version had, now costing the
                  document nothing. */}
              <div aria-hidden className="hidden lg:block lg:h-[600%]" />
            </div>
          </div>

          {/* The film's own controls. The hint used to live inside the cold open,
            where it vanished the moment the day started — so from beat one there
            was nothing saying how long this goes on for or how to get out of it.
            Six screens of pinned scroll needs both, and the way out has to be on
            screen the whole time rather than only at the start. */}
          <div className="bg-base-100 border-base-300 rounded-field relative flex w-full items-center justify-between gap-4 border py-2 pr-2 pl-4 lg:w-[min(1440px,100%)] lg:pl-5">
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
            {/* `#why`, not `#whoever`: this is the way OUT of the film, so it has to
                land on whatever comes next. It pointed at the trade wall when that
                was the next section; <Recognition> is now, and skipping the day
                should not also skip the beat that explains why the day matters. */}
            <a className={buttonClasses({ variant: 'outline' })} href="#why">
              Skip the day <ArrowRight className="size-4" />
            </a>
          </div>
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
