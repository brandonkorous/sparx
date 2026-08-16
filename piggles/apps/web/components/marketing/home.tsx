import Image from 'next/image';
import { FaqSection, Section } from '@piggles/ui';
import Link from 'next/link';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import type { PigglesGroup } from '@piggles/brand';
import { accountUrl, APP_BY_ID, type PigglesAppId, PRODUCT } from '@piggles/config';
import { MASCOT_POSES, type MascotPoseId } from '@piggles/mascot';
import { PigglesMascot } from '@piggles/mascot/react';
import { CloseBand } from './close-band';
import { InsteadOf } from './instead-of';
import { TheDay } from './the-day';
import { TwoQuestionsForm } from './two-questions';

// meetpiggles.com — the home page.
//
// ── THE SHAPE ───────────────────────────────────────────────────────────────
//
//   1  The day        — one app window, pinned, with a Thursday running through it
//   1b Thursday    — and here is the Thursday night you actually had
//   2  Whatever        — whatever kind of business you have
//   3  The turn       — stop typing the same thing three times
//   4  The sixth place — one fact, six copies, and the fifteen that share one
//   5  Two questions  — what actually happens when you sign up
//   6  $49            — what your time is worth, then the one price
//   7  Instead of     — the ten bills this replaces, against the one
//   8  Questions      — the six people ask before signing anything
//   9  Close
//
// ── THE CONTRACT EVERY SECTION ON THIS PAGE IS HELD TO ──────────────────────
//
// **A section lands in three to five seconds, and points somewhere for the rest.**
// The film is the only exception — it is the thing being pointed at.
//
// Three to five seconds is roughly 15–40 words of PROSE. Names in a grid, trade
// captions on a wall and answers inside a closed accordion do not count against
// it, because those are scanned rather than read. What counts is the sentences a
// person has to take in sequence before the section means anything.
//
// This was measured on the live page and half of it failed. The turn was 146
// words, the bento 268, onboarding 202, price 192, trust 198 — and separately,
// the five sections that WERE short enough (Thursday night, the trade wall,
// onboarding, the questions, the close) linked to nothing at all. So every
// section was breaking one half of the rule or the other, and none was doing
// both. Sections were being written as arguments when the page needs signposts.
//
// The three legal homes for depth, in order of preference:
//
//   1. **A page of its own.** /apps, /pricing, /trust, /how-it-works,
//      /who-its-for. Two of those were built for this pass, because the sections
//      that had to be cut had nowhere to send anybody.
//   2. **A disclosure.** The FAQ passes at 80 words because six answers are
//      folded away until asked for.
//   3. **An optional interaction.** Something a reader can spend a minute on
//      while the section still lands in three seconds for somebody who ignores
//      it. The price section held one — a six-field calculator — and it went:
//      see the header of <Pricing> for why comparing bills was the wrong
//      argument to put in front of a price.
//
// A section that gets longer without earning one of those three is regressing,
// and the way to check is to read only the prose and count.
//
// ── SERVER COMPONENTS, DELIBERATELY ─────────────────────────────────────────
//
// Everything here is a server component. `<TheDay>` is the one client boundary
// on the page (it needs a scroll position) and `<Faq>` is the other (Base UI's
// accordion is interactive). That is why the CTAs are real anchors carrying
// `buttonClasses` rather than `<Button render={<a/>}>`: the render form is
// client-only, and it also hands jsx-a11y an empty `<a>` whose text lives in a
// sibling prop.
//
// ── WHAT WAS REMOVED, AND WHY IT IS NOT COMING BACK ─────────────────────────
//
// The page used to open with a headline, a mascot and four product cards, then
// show the SAME four things again 3000px later in a different layout under
// "keep what you're working on open together". One screen depicted twice is the
// page arguing with its own headline. `<TheDay>` is the single depiction, and
// `workbench-glimpse.tsx`, `trade-film.tsx` and `photo-band.tsx` are deleted
// rather than parked — an unused marketing component is a thing somebody
// re-adds.
//
// It also carried a "Three doors. One Piggles." section explaining why the
// product has three domains. That is OUR problem; nobody arrives wondering
// about it. Section 5 answers what somebody actually worries about after being
// shown fifteen apps — "do I have to set all that up?" — and every line of it is
// something the account app genuinely does today (STATUS.md, "Onboarding").

// ── 1b · RECOGNITION ─────────────────────────────────────────────────────────
//
// The film shows a day going well. This is the day the reader actually had, and
// it goes immediately after — because a page that only ever shows the good
// version is a page nobody sees themselves in. Pain first, then the product, is
// the usual advice; here the product came first because the film IS the
// argument, so this is the beat that earns it retrospectively: yes, that is a
// nice Thursday, and here is yours.
//
// ── SHORT, AND IT ASKS FOR SOMETHING ────────────────────────────────────────
//
// This was four paragraphs and no buttons first — a recognition beat written as
// an essay, which is the opposite of recognition: you either see yourself in it
// in one line or the extra sentences are you explaining somebody's own week back
// to them. Forty words now, and it ends where the reader is most likely to act,
// which is the moment they have just agreed the problem is theirs.
//
// ── WHY THE PAIN CLAUSE IS NOT PINK ─────────────────────────────────────────
//
// The reference this was built from sets the last line of the heading in the
// brand pink. It cannot ship that way: `--color-primary` measures 2.6:1 as ink
// on `base-100` and fails even the 3:1 large-text floor. Pink is a FILL in this
// palette — the theme pairs it with an on-fill ink — and using a fill as an ink
// is how a heading ends up decorative rather than read. Same measurement as
// <Whatever> records for the same reason.
//
// The emphasis is carried by SCALE instead, and the color goes where it can be
// read AND mean something: the four nouns in the paragraph wear the group hue of
// the app that eventually absorbs them. Every group hue is measured AA on white
// (4.99–6.98:1), so they are legible, and a reader meets the product's color
// system here — in a sentence about their own week — before the trade wall or
// the nav ever shows it to them.
function Thursday() {
  return (
    <Section variant="panel" className="bg-base-100 shadow">
      <div id="why" className="grid gap-10 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-16">
        <div className="rise">
          <h2 className="text-4xl leading-[1.04] font-black sm:text-5xl lg:text-6xl">
            It&rsquo;s Thursday night, and you&rsquo;re still doing the admin.
          </h2>

          <p className="mt-6 max-w-[46ch] text-lg sm:text-xl">
            <b data-group="people" className="text-module font-bold">
              Bookings
            </b>{' '}
            in one app,{' '}
            <b data-group="money" className="text-module font-bold">
              invoices
            </b>{' '}
            in another,{' '}
            <b data-group="sell" className="text-module font-bold">
              stock
            </b>{' '}
            in a spreadsheet,{' '}
            <b data-group="people" className="text-module font-bold">
              customers
            </b>{' '}
            in your phone. None of them have ever spoken to each other.
          </p>

          <p className="font-heading mt-7 text-2xl leading-[1.1] font-black sm:text-3xl">
            That is why we built Piggles.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              className={buttonClasses({ color: 'primary', size: 'lg' })}
              href={accountUrl('signup', 'home-why')}
            >
              Start free for 14 days
            </a>
            {/* `/apps`, not the in-page `#apps` anchor it pointed at. An anchor
                is not a destination — it drops somebody 3,000px down the same
                page they were already reading, which is the scroll they were
                going to do anyway. */}
            <Link className={buttonClasses({ variant: 'outline', size: 'lg' })} href="/apps">
              See what&rsquo;s included
            </Link>
          </div>
        </div>

        {/* The alt describes WHAT IS IN THE FRAME, not what the section wants it
            to mean — public/photos/README.md records a caption written from a
            filename that shipped describing a picture nobody had opened. */}
        <Image
          src="/photos/working-late-portrait.jpg"
          alt="Someone still working at a laptop after dark, city lights in the window behind them"
          width={1200}
          height={1500}
          sizes="(min-width: 1024px) 42vw, 100vw"
          className="settle rounded-section h-auto w-full"
        />
      </div>
    </Section>
  );
}

// ── 2 · Whatever ──────────────────────────────────────────────────────────────
//
// The one section with no panel under it. It wants air rather than a container,
// and it sits directly above the dark turn — so the open ground is also what
// gives that panel its entrance. That decision is what makes this the right
// section to run a full-bleed wall in: nothing has to be cut into a panel.
//
// ── IT WAS A LIST OF WORDS, AND WORDS ARE THE SLOW WAY TO DO THIS ───────────
//
// The section's job is RECOGNITION — it is the honest substitute DESIGN.md §10
// names for a logo wall, letting a florist recognise herself without anybody
// claiming she has already signed up. Reading "A barber." is slower than seeing
// one, and this was also the only section on the page with no picture in it,
// sitting between the film and the dark turn. Batch 07 is eleven trades drawn
// for exactly this: the same character, the same apron, eleven jobs.
//
// ── SIZING IS ITS OWN PROBLEM, AND IT IS BELOW ─────────────────────────────
//
// Batch 07 is not uniformly framed: aspect ratios run 0.998 (`workshop`) to
// 1.422 (`supplier`), and how much of a frame Piggles occupies runs 0.439
// (`shed`) to 0.779 (`supplier`). With eleven scenes on screen together that
// spread is the whole difficulty of this section — see `scene()` below.
//
// ── HUES ───────────────────────────────────────────────────────────────────
//
// Five group hues over eleven trades, arranged so no two adjacent cards in a
// lane share one AND the last does not match the first — the lane loops, so the
// wrap is an adjacency too. Not the brand pink: it is the CTA color on this
// page and a label wearing it competes with the button.
interface Trade {
  pose: MascotPoseId;
  word: string;
  group: PigglesGroup;
}

const TRADES: Trade[] = [
  { pose: 'bakery', word: 'A bakery.', group: 'sell' },
  { pose: 'barber', word: 'A barber.', group: 'people' },
  { pose: 'potter', word: 'A potter.', group: 'run' },
  { pose: 'garage', word: 'A garage.', group: 'web' },
  { pose: 'market-stall', word: 'A market stall.', group: 'money' },
  { pose: 'salon', word: 'A salon.', group: 'run' },
  { pose: 'tailor', word: 'A tailor.', group: 'sell' },
  { pose: 'art-studio', word: 'A studio.', group: 'people' },
  { pose: 'workshop', word: 'A workshop.', group: 'web' },
  { pose: 'supplier', word: 'A supplier.', group: 'money' },
  { pose: 'shed', word: 'A shed.', group: 'run' },
];

// ── HOW BIG A SCENE IS, AND WHY IT IS NEITHER OF THE OBVIOUS ANSWERS ────────
//
// There are two defensible ways to size eleven scenes in eleven cards and they
// disagree, so this splits the difference on purpose.
//
//   Normalise the CHARACTER — <PigglesMascot size="md"> — and Piggles is exactly
//   the same height in all eleven. It is the mathematically correct answer and
//   it looks wrong, because nobody reads the pig: they read the card. A potter
//   at a wheel is a compact composition and fills 224px of a 350px card; a
//   garage is a wide one and wants 416px. Same pig, and the potter card reads as
//   half empty next to a garage that overflows.
//
//   Normalise the SCENE — every image the card's width — and every card is
//   equally full, but the pig then swings from 131px in the garage to 246px in
//   the potter. At that size she stops being a character in a shop and becomes a
//   close-up, and the wall stops looking like one character in eleven jobs.
//
// So: the midpoint of the two. Each scene renders half way between the width
// that equalises the character and the width that fills the card. Measured on
// screen against both extremes — the extremes are each visibly wrong in their
// own direction and this is not.
//
// It is COMPUTED from the catalog rather than eleven hand-tuned numbers, which
// is what keeps it honest when the art is re-cut: `subject` and the aspect ratio
// are the two things that decide how pig-dominant a scene is, the ingest
// measures both, and a new batch re-tunes this with no edit here.
//
// Quantised onto a ladder of literal percentage classes for the same reason
// <PigglesMascot> quantises its widths: Tailwind scans source TEXT, so a
// computed `w-[${n}%]` generates no class at all and the scene silently falls
// back to its container. Percentages rather than pixels so it survives a card
// that is 350px on one screen and 420px on another.
const CARD_REF = 350;
const CHARACTER_TARGET = 152;
const SCENE_STEPS = [
  { pct: 80, w: 'w-[80%]' },
  { pct: 85, w: 'w-[85%]' },
  { pct: 90, w: 'w-[90%]' },
  { pct: 95, w: 'w-[95%]' },
  { pct: 100, w: 'w-[100%]' },
  { pct: 105, w: 'w-[105%]' },
  { pct: 110, w: 'w-[110%]' },
];

function scene(pose: MascotPoseId) {
  const art = MASCOT_POSES[pose];
  // The width that would put her at CHARACTER_TARGET — the component's own
  // arithmetic, repeated here because we need the number rather than the class.
  const even = (CHARACTER_TARGET / art.subject) * (art.width / art.height);
  const wanted = ((even + CARD_REF) / 2 / CARD_REF) * 100;
  let step = SCENE_STEPS[0]!;
  for (const s of SCENE_STEPS) {
    if (Math.abs(s.pct - wanted) < Math.abs(step.pct - wanted)) step = s;
  }
  // `sizes` is a plain string, so it is NOT quantised — it states the real
  // rendered width at each breakpoint. A `sizes` that disagrees with the
  // rendered width is invisible: the image looks right and arrives
  // under-resolved. Card is ~CARD_REF from `lg` and 74vw below it.
  return {
    width: step.w,
    sizes: `(min-width: 1024px) ${Math.round((CARD_REF * step.pct) / 100)}px, ${Math.round((74 * step.pct) / 100)}vw`,
  };
}

/** The cards are CONTENT-HEIGHT on purpose. A fixed aspect ratio would leave a
 *  pocket of empty panel above every scene shorter than the tallest one, and
 *  the ragged rhythm a wall of cards wants is already sitting in the artwork.
 *  Taking the height from the art gets that variation for free and leaves no
 *  hole anywhere.
 *
 *  The wall and floor are `.trade-card` in globals.css, derived from this
 *  card's `data-group` hue. No border: the two tones already separate the card
 *  from the ground, and a hairline on top of them is a second answer to a
 *  question that has one. */
function TradeCard({ trade }: { trade: Trade }) {
  const { width, sizes } = scene(trade.pose);
  return (
    <figure
      data-group={trade.group}
      className="trade-card rounded-section flex w-[74vw] shrink-0 snap-center flex-col overflow-hidden shadow sm:w-[46vw] lg:w-auto lg:shrink"
    >
      <figcaption className="text-module font-heading px-5 pt-5 text-xl font-black sm:text-2xl lg:px-6 lg:pt-6">
        {trade.word}
      </figcaption>
      {/* No bottom padding, and the scene sits on the card's bottom edge: every
          cut in the batch is anchored on a counter, bench or table that runs
          most of its width, so putting that edge ON the card's edge — and on
          the floor the card draws there — is what makes her stand IN the card
          rather than float on it.

          `self-center` rather than a centring margin, because the widest scenes
          are OVER 100% and are meant to crop. An auto margin resolves to zero
          once the box is wider than its container, so the overflow would go
          entirely to one side and a garage would sit visibly off-centre; cross-
          axis centring in a column flex overflows both edges evenly. */}
      <div className={`mt-4 self-center ${width}`}>
        <PigglesMascot pose={trade.pose} size="fill" sizes={sizes} />
      </div>
    </figure>
  );
}

/** One column: two copies of the same cards, travelling exactly one copy's
 *  height so the second arrives where the first began.
 *
 *  `lg:self-start` IS LOAD-BEARING. The two lanes hold different numbers of
 *  cards, and as grid items of a fixed-height wall they are both sized to the
 *  TALLER one's row. The short lane then stretches, and a grid distributes that
 *  slack between its rows — which are the two copies. The visible symptom was a
 *  ~390px hole between the last card of one copy and the first of the next, in
 *  the right-hand column only; the invisible one is worse, because a lane taller
 *  than its content means -50% is no longer one copy and the loop drifts. Both
 *  vanish when the lane stays content-height.
 *
 *  THE GAP BELONGS TO THE COPY, NOT TO THE LANE, and this is the second half of
 *  the same arithmetic. With `gap` on the lane its height is `2C + gap`, so a -50%
 *  translation moves `C + gap/2` — half a gap short of where the next copy
 *  starts, and the wall visibly jumps once every cycle. Giving each copy a
 *  trailing `pb` equal to its internal gap makes a copy `C + gap` tall and the
 *  lane exactly twice that, so -50% is precisely one copy. The lane itself must
 *  therefore carry NO gap. */
function TradeLane({ trades, down = false }: { trades: Trade[]; down?: boolean }) {
  return (
    <div className={`trade-lane contents lg:grid lg:self-start ${down ? 'trade-lane-down' : ''}`}>
      {[0, 1].map((copy) => (
        <div
          key={copy}
          // The duplicate exists to make the loop seamless and says
          // nothing new — eleven trades are announced once, not twice.
          // It is also hidden outright below `lg`, where the wall is a
          // horizontal row and there is no loop to be seamless.
          aria-hidden={copy === 1}
          className={`${copy === 1 ? 'hidden' : 'contents'} lg:grid lg:content-start lg:gap-3.5 lg:pb-3.5`}
        >
          {trades.map((trade) => (
            <TradeCard key={trade.pose} trade={trade} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Whatever() {
  const half = Math.ceil(TRADES.length / 2);
  return (
    <Section variant="panel" id="Whatever">
      <div className="grid gap-8 lg:grid-cols-[1fr_34%] lg:items-start lg:gap-14">
        {/* Below `lg` this is a horizontal snap row — the motion axis the
            page itself is not using. From `lg` it becomes the two-lane wall,
            and globals.css takes over. `-mx-*` lets the row bleed the section's
            padding on a phone so a card is visibly cut at the edge rather than
            stopping short of it, which is what says there are more. */}
        <div className="trade-wall -mx-6 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-6 pb-2 sm:-mx-10 sm:px-10 lg:mx-0 lg:grid lg:h-[78vh] lg:max-h-[46rem] lg:min-h-[34rem] lg:grid-cols-2 lg:overflow-hidden lg:px-0 lg:pb-0">
          <TradeLane trades={TRADES.slice(0, half)} />
          <TradeLane trades={TRADES.slice(half)} down />
        </div>
        {/* Sticky, and completely still. The argument has to stay readable
            while the variety moves past it; a wall that carried the words too
            would be a carousel, and nobody reads a carousel. */}
        <div className="rise lg:sticky lg:top-24">
          <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
            Whatever kind of business you have.
          </h2>
          {/* Three sentences became one, and the one that survived is about the
              READER. The draft said "not a shop product with bookings bolted on,
              not a booking product that also does invoices" — a true sentence
              whose subject is our software. What the reader is living with is
              that every tool they have looked at was built for somebody else's
              trade and they have been settling. Say that instead.

              The rest of the old paragraph — what is actually different about
              running a bakery versus a barber — is /who-its-for, which exists
              because this section made that promise and then offered nowhere to
              take it. */}
          <p className="mt-5 text-lg">
            Piggles is built for the kind of business you actually run, not to make you run the kind
            of business we imagined. A bakery, a barber, a potter, a garage — whatever you do,
            it&rsquo;s already in the product.
          </p>
          <Link
            className={`${buttonClasses({ color: 'secondary', size: 'lg' })} mt-7`}
            href="/who-its-for"
          >
            What is different about yours
          </Link>
        </div>
      </div>
    </Section>
  );
}

function AppName({ app }: { app: PigglesAppId }) {
  const def = APP_BY_ID[app]!;
  return (
    <Link href={`/apps/${app}`} data-group={def.group} className="ink-module font-bold">
      {def.label}
    </Link>
  );
}

const ONCE: { act: string; then: React.ReactNode }[] = [
  {
    act: 'You type a customer’s name once.',
    then: (
      <>
        It is already in <AppName app="bookings" />, <AppName app="customers" />,{' '}
        <AppName app="invoices" /> and <AppName app="messages" />.
      </>
    ),
  },
  {
    act: 'You change a price once.',
    then: (
      <>
        <AppName app="sell" />, <AppName app="stock" /> and <AppName app="site" /> are all showing
        the new one.
      </>
    ),
  },
  {
    act: 'You write something once.',
    then: (
      <>
        <AppName app="content" /> keeps it, <AppName app="site" /> shows it,{' '}
        <AppName app="get_found" /> gets it noticed.
      </>
    ),
  },
  {
    act: 'You check one screen in the morning.',
    then: (
      <>
        <AppName app="home" /> has what <AppName app="bookings" />, <AppName app="money" /> and{' '}
        <AppName app="messages" /> did overnight.
      </>
    ),
  },
];

function TheTurn() {
  return (
    // A theme ISLAND, as close-band.tsx is. `bg-secondary` was a navy panel
    // only because `--color-secondary` happens to be dark in the LIGHT
    // theme; it is #d7dbe3 in the dark one, so with a theme toggle on the
    // site this section turned pale and took `text-primary` pink with it.
    // An island is dark in both, and the pink lands on the ground it was
    // measured against.
    <Section variant="panel" theme="dark" className="bg-base-200 shadow">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className="rise">
          {/* "Stop wiring your business together" was the draft, and wiring is
              one abstraction above where the reader lives. Nobody lies awake
              thinking about integrations; they think about having just typed the
              same person's name into the fourth thing. The heading has to name
              the chore, not our word for the category of chore. */}
          <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
            Stop typing the same thing three times.
          </h2>
          {/* `text-primary`, NOT `text-accent`. This is the same dark island
              close-band.tsx measured — `accent` resolves to a dark rose here and
              lands at 2.44:1, under the 3:1 floor even at this size, so the
              loudest line in the section was the least readable one. `primary`
              measures 6.56:1 on the same ground. */}
          <p className="text-primary font-heading mt-7 text-2xl font-black sm:text-3xl lg:text-4xl">
            There is nothing here to connect.
            <br />
            It was never apart.
          </p>
          <Link className={`${buttonClasses({ color: 'primary', size: 'lg' })} mt-8`} href="/apps">
            See how the fifteen fit together
          </Link>
        </div>

        {/* Per-row `border-t`, NOT `divide-y`: silicaui registers
            `border-base-300` but not `divide-base-300`, and an arbitrary
            `divide-[color:…]` does not compile — the dividers would silently
            fall back to `currentColor`.

            The dividers separate and nothing else. The version before this drew
            a rule INSIDE each row as a piece of meaning, which is what made the
            column a diagram; the only lines left are chassis. */}
        <ul className="stagger">
          {ONCE.map((o) => (
            <li
              key={o.act}
              className="border-base-300 border-t py-6 first:border-t-0 first:pt-0 last:pb-0"
            >
              {/* The gap between these two is the row's whole legibility. At one
                  step apart the claim and the consequence read as two sentences
                  of equal weight and the eye has to work out which is which;
                  `text-2xl`/`text-lg` puts the action first at a glance and the
                  places second, which is the order the row is meant to be read
                  in. */}
              <p className="font-heading text-2xl font-extrabold sm:text-[1.75rem]">{o.act}</p>
              <p className="mt-2 text-lg">{o.then}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function TwoQuestions() {
  return (
    <Section variant="panel" className="bg-base-100 shadow">
      <div className="rise max-w-[62ch]">
        <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          You answer two questions. It arrives set up.
        </h2>
        <p className="mt-6 text-lg">
          No empty workspace, no manual. What you pick changes what you see first &mdash; never what
          you are allowed to have. Here are the two, and here is what they cost.
        </p>
      </div>

      <TwoQuestionsForm />
    </Section>
  );
}

// ── 6 · PRICE ────────────────────────────────────────────────────────────────
const INCLUDED = [
  'All fifteen apps, from the first day',
  'Your website, and a Piggles address for it',
  'Three people on your team',
  'Your own customer records, products and orders',
  'Everything exportable, always',
];

/** A tick. Inline rather than an icon import so it inherits `currentColor` and
 *  is correct on any surface without being told which one. */
function Tick() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="mt-1 size-4 shrink-0">
      <path
        d="m4 12.6 5 5L20 6.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Pricing() {
  return (
    <Section variant="panel" className="bg-accent text-accent-content shadow">
      <div id="price" className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className="rise">
          <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
            How much is your time worth?
          </h2>
          <p className="mt-6 max-w-[46ch] text-xl font-semibold">
            Then why is so much of it spent joining up your own information &mdash; checking one app
            against another to work out what your business actually did this week?
          </p>
          <p className="mt-5 max-w-[46ch] text-lg">
            Piggles does the joining up. What that hour is worth is yours to decide, and yours to
            spend on something else.
          </p>
        </div>

        <Card className="settle">
          <CardBody>
            <p className="text-6xl font-extrabold">
              $49<span className="text-xl font-bold">/month</span>
            </p>
            <p className="mt-1 text-base font-semibold">One plan. That is the whole price list.</p>

            <ul className="mt-6 space-y-3">
              {INCLUDED.map((line) => (
                <li key={line} className="flex gap-3 text-base">
                  {/* Color on the marker, weight on the sentence. Coloring the
                      whole row would make five equal facts look like five links. */}
                  <span className="text-primary">
                    <Tick />
                  </span>
                  {line}
                </li>
              ))}
            </ul>

            {/* RULE #2, standing next to the number it qualifies. This was a
                paragraph in the left column, where it argued with a heading; the
                only place it is actually read is beside the price, and it is the
                one sentence on this page a competitor cannot copy without
                restructuring their business. */}
            <p className="mt-6 text-base">
              Your bill changes when the <em>business</em> needs more room — more people, more
              storage, more email going out. Never because you switched Bookings on.
            </p>

            <a
              className={`${buttonClasses({ color: 'primary', size: 'xl', block: true })} mt-8`}
              href={accountUrl('signup', 'home-pricing')}
            >
              Start free for 14 days
            </a>
            <p className="mt-3 text-center text-base">No card needed to start.</p>
          </CardBody>
        </Card>
      </div>
    </Section>
  );
}

// ── 8 · QUESTIONS ────────────────────────────────────────────────────────────
//
// Verbatim from /pricing and /trust. A shorter version of an answer on the page
// somebody is about to be held to is how the two drift apart.
const QUESTIONS = [
  {
    q: 'Do I need a card to try it?',
    a: 'No. The trial is fourteen days with no card. If you decide not to carry on, nothing happens — there is no charge to cancel before.',
  },
  {
    q: 'What happens if I go over one of the limits?',
    a: 'Nothing you already have is touched, and nothing you are part way through is stopped. You get a quiet notice as you approach it, and the option to add more room in one tap at the moment it matters — with the price on the button, not behind it. If you do nothing, only new additions of that one kind pause. Your website stays up, your customers stay visible, and order confirmations and password resets always go out regardless.',
  },
  {
    q: 'Can I take my data with me if I leave?',
    a: 'All of it, whenever you want, in formats other software can actually read — customers, products, orders, invoices and everything you have written. You do not have to ask, and you do not have to be leaving.',
  },
  {
    q: 'What if I run two businesses?',
    a: 'Each business is its own subscription, with its own website, customers and books kept completely separate. That is deliberate: sharing them is almost always a mistake you find out about at tax time.',
  },
  {
    q: 'Do you use my business data to train AI?',
    a: 'No. Not to train a model, not to improve a shared assistant, not anonymised, not aggregated. Any AI feature runs on a key you connect yourself, which means the data goes where you agreed and nowhere else — and you can revoke it whenever you want.',
  },
  {
    q: 'Is there a discount for paying yearly?',
    a: 'Not yet. When there is, it will be a straightforward reduction rather than a different plan with different limits.',
  },
];

function Questions() {
  return (
    <FaqSection
      heading={
        <>
          Questions people <span className="text-primary">actually</span> ask.
        </>
      }
      lede="The six that come up before anybody signs anything."
      items={QUESTIONS}
    />
  );
}

export function HomePage() {
  return (
    // No top padding: the film is the first child and it is a full-bleed dark
    // act, so any page ground above it reads as a seam under the header rather
    // than as spacing. The breathing room around the demo is the mat's own
    // padding, inside the dark — see the-day.tsx.
    <div className="space-y-8 pb-8 sm:space-y-14">
      <TheDay />
      <Thursday />
      <Whatever />
      <TheTurn />
      <TwoQuestions />
      <Pricing />
      <InsteadOf />
      <Questions />
      <CloseBand
        heading={`Go and run the business. ${PRODUCT.name} will handle the business software.`}
        primary={{ label: 'Get Piggles', href: accountUrl('signup', 'home-close') }}
        secondary={{ label: 'Talk to a person', href: accountUrl('contact', 'home-close') }}
        note="$49 a month · free for 14 days · no card needed"
      />
    </div>
  );
}
