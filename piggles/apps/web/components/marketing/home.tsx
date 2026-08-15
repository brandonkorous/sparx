import Link from 'next/link';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { PIGGLES_GROUPS, type PigglesGroup } from '@piggles/brand';
import { accountUrl, appIcon, appsInGroup, PRODUCT } from '@piggles/config';
import { PigglesMascot } from '@piggles/mascot/react';
import { CloseBand } from './close-band';
import { Faq } from './faq';
import { GROUP_COPY } from './groups';
import { TheDay } from './the-day';

// meetpiggles.com — the home page.
//
// ── THE SHAPE ───────────────────────────────────────────────────────────────
//
//   1  The day        — one app window, pinned, with a Thursday running through it
//   2  Whoever        — whatever kind of business you have
//   3  The turn       — you don't have a CRM, you have customers
//   4  All fifteen    — grouped the way a business is
//   5  Two questions  — what actually happens when you sign up
//   6  $49
//   7  Trust          — the boring things, done properly
//   8  Questions      — the six people ask before signing anything
//   9  Close
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

/** A section is an inset rounded panel on the warm ground. */
function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className="px-4 sm:px-6">
      <div
        className={`rounded-section mx-auto max-w-7xl px-6 py-16 sm:px-10 sm:py-20 lg:px-14 ${className}`}
      >
        {children}
      </div>
    </section>
  );
}

// ── 2 · WHOEVER ──────────────────────────────────────────────────────────────
//
// The one section with no panel under it. It is nothing but display type, it
// wants air rather than a container, and it sits directly above the dark turn —
// so the open ground is also what gives that panel its entrance.
//
// Ink first, then the five group hues. NOT the brand pink: it measures 2.5:1 on
// this ground and fails even the 3:1 large-text floor. Pink is a FILL colour
// here — the theme pairs it with white on-fill ink — and using a fill as an ink
// is how a heading ends up decorative rather than read.
const TRADES: { word: string; group?: PigglesGroup }[] = [
  { word: 'A bakery.' },
  { word: 'A barber.', group: 'people' },
  { word: 'A potter.', group: 'sell' },
  { word: 'A garage.', group: 'web' },
  { word: 'A market stall.', group: 'money' },
  { word: 'A salon.', group: 'run' },
  { word: 'A tailor.' },
  { word: 'A studio.', group: 'people' },
  { word: 'A workshop.', group: 'sell' },
  { word: 'A supplier.', group: 'web' },
  { word: 'A shed.', group: 'money' },
];

function Whoever() {
  return (
    <section className="px-4 sm:px-6" id="whoever">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[34%_1fr] lg:items-start lg:gap-14 lg:px-14">
        <div className="rise">
          <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
            Whatever kind of business you have.
          </h2>
          <p className="mt-5 text-lg">
            Piggles is not a shop product with appointments bolted on, or a booking product that
            also does invoices. A bakery, a barber and a potter are equally the point — and so is
            the garage, the market stall and the person who makes things in a shed.
          </p>
        </div>
        <ul className="font-heading flex flex-wrap gap-x-[0.42em] text-[clamp(1.75rem,3.8vw,3.6rem)] leading-[1.12] font-black tracking-tight">
          {TRADES.map((t) => (
            <li key={t.word} data-group={t.group} className={t.group ? 'text-module' : ''}>
              {t.word}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── 3 · THE TURN ─────────────────────────────────────────────────────────────
//
// Left is what the industry calls it; right is what the person doing it would
// say. Each row carries its group, so the plain word already wears the colour it
// wears inside the product — the translation and the product are the same
// translation.
//
// The plain word takes `ink-module`, NOT `text-module`. The group hues are
// measured against white and this is a dark theme island; the raw hue drops
// under 3:1 here. See the rule in globals.css — the lifted value is derived from
// `--color-module`, so it still follows a change to the group's colour.
const TRANSLATIONS: { jargon: string; plain: string; href: string; group: PigglesGroup }[] = [
  { jargon: 'CRM', plain: 'Customers', href: '/apps/customers', group: 'people' },
  { jargon: 'CMS', plain: 'Content', href: '/apps/content', group: 'web' },
  { jargon: 'SEO', plain: 'Get Found', href: '/apps/get_found', group: 'web' },
  { jargon: 'Inventory management', plain: 'Stock', href: '/apps/stock', group: 'sell' },
  { jargon: 'Scheduling', plain: 'Bookings', href: '/apps/bookings', group: 'people' },
  { jargon: 'Financial reporting', plain: 'Money', href: '/apps/money', group: 'money' },
];

function TheTurn() {
  return (
    <section className="px-4 sm:px-6">
      <div
        data-theme="dark"
        className="rounded-section bg-base-200 mx-auto grid max-w-7xl gap-10 px-6 py-16 sm:px-10 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-14"
      >
        <div className="rise">
          <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
            Simple doesn&rsquo;t have to mean basic.
          </h2>
          <p className="mt-6 text-lg">
            Business software is rarely hard because it does too much. It is hard because it makes
            you learn its vocabulary before it will help you.
          </p>
          <p className="text-accent font-heading mt-7 text-2xl font-black sm:text-3xl lg:text-4xl">
            You don&rsquo;t have a CRM.
            <br />
            You have customers.
          </p>
          <p className="mt-7 text-lg">
            Nothing was removed to get those names. The capability underneath is the same one bigger
            companies pay a great deal more for — it just stopped asking you to translate.
          </p>
        </div>

        {/* Per-row `border-b`, NOT `divide-y`: silicaui registers
            `border-base-300` but not `divide-base-300`, and an arbitrary
            `divide-[color:…]` does not compile — the dividers would silently
            fall back to `currentColor`. */}
        <ul className="stagger border-base-300 border-t">
          {TRANSLATIONS.map((t) => (
            <li key={t.jargon} data-group={t.group} className="border-base-300 border-b">
              <Link
                href={t.href}
                className="flex items-center gap-4 py-4 sm:gap-7 sm:py-5 lg:gap-8 lg:py-6"
              >
                <span className="flex-1 text-base sm:text-lg lg:text-xl">
                  <span className="strike">{t.jargon}</span>
                </span>
                <span className="ink-module font-heading flex-1 text-right text-xl font-extrabold sm:text-2xl lg:text-[1.75rem]">
                  {t.plain}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── 4 · ALL FIFTEEN ──────────────────────────────────────────────────────────
//
// Six columns, six tiles, three rows:
//
//     Your day ██   ·  Your website ████
//     Selling ███   ·  People ███
//     Money ██      ·  Running it ████
//
// The point of a bento is that the things in it are NOT the same size, because
// they are not the same size. Six equal cards said the opposite — that Home (one
// app) and Running it (three) carry equal weight in a day.
//
// WIDTH VARIES, HEIGHT DOES NOT. Tiles stretch flush to their row, which is what
// makes it read as a tiled panel rather than a ragged card wall. Spanning ROWS
// is the trap: a tall tile for Home, which is a single app, produced a tinted
// rectangle with 200px of nothing under it. The void is fixed with CONTENT — the
// two thin tiles carry the group's `long` description instead of its one-line
// blurb, and the two wide tiles lay their apps out in two internal columns.
//
// One tinted tile per hue and no more. The root contract's warning about tinted
// cards is about a WALL of them competing; here the tint IS the group, six hues,
// six tiles.
const BENTO: Record<PigglesGroup, { span: string; cols: string; copy: 'blurb' | 'long' }> = {
  home: { span: 'lg:col-span-2', cols: '', copy: 'long' },
  web: { span: 'lg:col-span-4', cols: 'lg:grid-cols-2 lg:gap-x-7', copy: 'blurb' },
  sell: { span: 'lg:col-span-3', cols: '', copy: 'blurb' },
  people: { span: 'lg:col-span-3', cols: '', copy: 'blurb' },
  money: { span: 'lg:col-span-2', cols: '', copy: 'long' },
  run: { span: 'lg:col-span-4', cols: 'lg:grid-cols-2 lg:gap-x-7', copy: 'blurb' },
};

function Fifteen() {
  return (
    <Section className="bg-base-100">
      <div className="rise max-w-[62ch]">
        <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          All fifteen, grouped the way a business is.
        </h2>
        <p className="mt-6 text-lg">
          Not a features list — the six things a day is actually made of. Every one is included from
          the first day, and every one is a real place in the software rather than a bullet point on
          this page.
        </p>
      </div>

      <div className="mt-10 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-6">
        {PIGGLES_GROUPS.map((group) => {
          const copy = GROUP_COPY[group];
          const tile = BENTO[group];
          return (
            <div
              key={group}
              data-group={group}
              className={`bg-module bg-soft border-base-300 rounded-box flex flex-col border p-5 sm:p-7 ${tile.span}`}
            >
              <h3 className="text-module text-xl font-black sm:text-2xl">{copy.title}</h3>
              <p className="mt-2.5 max-w-[48ch] text-base">{copy[tile.copy]}</p>

              {/* `mt-auto` anchors the list to the bottom of the tile. With
                  tiles stretched to their row the alternative is copy at the top
                  and a ragged pocket of nothing underneath — this makes the gap
                  between the description and the list the thing that varies,
                  which is what a bento wants. */}
              <ul className={`mt-auto grid gap-3.5 pt-6 ${tile.cols}`}>
                {appsInGroup(group).map((app) => {
                  const Icon = appIcon(app.id);
                  return (
                    <li key={app.id} className="flex items-start gap-3">
                      <span className="bg-module text-module-content grid size-9 shrink-0 place-items-center rounded-[0.625rem]">
                        <Icon aria-hidden className="size-4" strokeWidth={1.9} />
                      </span>
                      <span>
                        <Link href={`/apps/${app.id}`} className="block font-bold">
                          {app.label}
                        </Link>
                        <span className="mt-0.5 block text-base">{app.purpose}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ── 5 · TWO QUESTIONS ────────────────────────────────────────────────────────
const FIRSTS = [
  {
    title: 'Set up, not just switched on',
    body: 'Customers arrives with a pipeline in it. Sell arrives knowing about tax and postage. Money arrives with its accounts. Turning an app on and leaving you an empty screen is not turning it on.',
  },
  {
    title: 'What you didn’t pick isn’t locked',
    body: 'Every one of the fifteen sits behind one tap, permanently, in the same place. The button says Add app and carries no price — because there isn’t one.',
  },
  {
    title: 'You can change your mind on Tuesday',
    body: 'The answer sets what you see first, not what you are allowed to have. Nothing you choose now is a door you have to pay to reopen later.',
  },
];

/** Which groups the depicted signup has ticked. Three of six, because the answer
 *  sets what you SEE first and never what you are allowed to have. */
const PICKED: PigglesGroup[] = ['web', 'people', 'money'];

function TwoQuestions() {
  return (
    <Section className="bg-base-100">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-14">
        <div className="rise">
          <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
            You answer two questions. It arrives set up.
          </h2>
          <p className="mt-6 text-lg">
            Fifteen apps is a lot to look at and nothing to set up. You are not handed an empty
            workspace and a manual — signing up asks what the business is called and what you want
            to start with, and the rest is already done when you get there.
          </p>

          <ul className="stagger mt-9 grid gap-6">
            {FIRSTS.map((f) => (
              <li key={f.title} className="border-base-content border-t-2 pt-4">
                <h3 className="text-xl font-bold">{f.title}</h3>
                <p className="mt-2 max-w-[56ch] text-base">{f.body}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* The SIGNUP, not the console. The page already depicts the workspace
            once, in <TheDay>; showing it again here in a different layout is the
            exact duplication this page was rebuilt to remove. */}
        <Card className="settle">
          <CardBody>
            <p className="text-base font-bold">Signing up</p>

            <p className="mt-6 text-base font-semibold">What is the business called?</p>
            <p className="bg-base-200 border-base-300 rounded-field mt-2.5 border px-4 py-4 text-lg">
              Wildroot Flowers
            </p>

            <p className="mt-7 text-base font-semibold">What do you want to start with?</p>
            <ul className="mt-2.5 flex flex-wrap gap-2.5">
              {PIGGLES_GROUPS.map((group) => {
                const on = PICKED.includes(group);
                return (
                  <li
                    key={group}
                    data-group={group}
                    className={`rounded-field border px-4 py-3 text-base font-semibold ${
                      on
                        ? 'bg-module bg-soft border-module text-module'
                        : 'bg-base-100 border-base-300'
                    }`}
                  >
                    {GROUP_COPY[group].title}
                  </li>
                );
              })}
            </ul>

            <p className="mt-7 text-base font-semibold">
              That is the whole form. No card, free for fourteen days.
            </p>
          </CardBody>
        </Card>
      </div>
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
    <Section className="bg-accent bg-soft">
      <div id="price" className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className="rise">
          <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
            $49 a month. All of it.
          </h2>
          <p className="mt-6 text-lg">
            Every app is included from the first day. There are no tiers to compare, no modules to
            price up, and nothing behind an upgrade button.
          </p>
          <p className="mt-4 text-lg">
            Your bill changes when your <em>business</em> needs more room — more people on the team,
            more storage, more email going out. Not because you switched Bookings on.
          </p>
          <Link
            className={`${buttonClasses({ color: 'neutral', variant: 'outline' })} mt-7`}
            href="/pricing"
          >
            What counts as more room
          </Link>
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
                  {/* Colour on the marker, weight on the sentence. Colouring the
                      whole row would make five equal facts look like five links. */}
                  <span className="text-primary">
                    <Tick />
                  </span>
                  {line}
                </li>
              ))}
            </ul>

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

// ── 7 · TRUST ────────────────────────────────────────────────────────────────
//
// The section's argument is what it REFUSES to put here, so the refusal is drawn
// rather than described — in the same dashed outline <TheDay> uses for "hasn't
// happened yet". Three empty frames where every competing page puts its proof,
// each saying why it is empty.
const ABSENT = [
  {
    title: 'A certification badge',
    body: 'We don’t have one. A badge on a page is the cheapest lie in this industry.',
  },
  {
    title: 'An uptime percentage',
    body: 'Nobody is measuring it yet. A number nobody measures is a decoration.',
  },
  {
    title: 'A wall of customer logos',
    body: 'We would have to invent them, and you would have no way of knowing.',
  },
];

const TRUST = [
  {
    title: 'Your data is yours',
    body: 'Export your customers, products, orders and content whenever you want, in formats other software can read. Leaving is not a support ticket.',
  },
  {
    title: 'Kept separate, kept safe',
    body: 'Your business is isolated from every other business on Piggles at the database itself, not just in the app. Encrypted in transit and at rest.',
  },
  {
    title: 'It stays up',
    body: 'Backed up continuously, monitored around the clock, with a public status page so you never have to guess whether it is you.',
  },
  {
    title: 'A person answers',
    body: 'Support from people who know the product, not a queue that closes your ticket for being inactive.',
  },
];

function Trust() {
  return (
    <Section className="bg-base-100">
      <div className="rise max-w-[62ch]">
        <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          The boring things, done properly.
        </h2>
        <p className="mt-6 text-lg">
          No badges, no uptime percentage, and no number nobody is measuring yet. Four things that
          are true, and a page that explains each of them.
        </p>
        <Link
          className={`${buttonClasses({ color: 'neutral', variant: 'outline' })} mt-7`}
          href="/trust"
        >
          How your data is handled
        </Link>
      </div>

      <ul className="mt-10 grid gap-3.5 sm:grid-cols-3">
        {ABSENT.map((a) => (
          <li
            key={a.title}
            className="border-base-300 rounded-box border-[1.5px] border-dashed p-5 sm:p-7"
          >
            <h3 className="text-lg font-extrabold sm:text-xl">{a.title}</h3>
            <p className="mt-2 text-base">{a.body}</p>
          </li>
        ))}
      </ul>

      <p className="font-heading mt-11 text-2xl font-extrabold sm:text-3xl">
        Here is what is left when you take those out.
      </p>

      <ul className="stagger mt-7 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
        {TRUST.map((t) => (
          <li key={t.title} className="border-base-content border-t-2 pt-5">
            <h3 className="text-xl font-bold">{t.title}</h3>
            <p className="mt-2 text-base">{t.body}</p>
          </li>
        ))}
      </ul>
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
    <Section className="bg-base-100">
      {/* Two columns with the heading pinned. A full-width stack of six
          disclosures under a heading left half of the panel empty and was the
          most "laid out rather than designed" thing on the page. */}
      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-start lg:gap-14">
        <div className="rise lg:sticky lg:top-24">
          <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
            Questions people actually ask.
          </h2>
          <p className="mt-5 text-lg">
            The six that come up before anybody signs anything. Every answer is the one on the
            pricing and trust pages, not a shorter version of it.
          </p>
        </div>
        <Faq items={QUESTIONS} />
      </div>
    </Section>
  );
}

export function HomePage() {
  return (
    <div className="space-y-8 pt-4 pb-8 sm:space-y-14">
      <TheDay />
      <Whoever />
      <TheTurn />
      <Fifteen />
      <TwoQuestions />
      <Pricing />
      <Trust />
      <Questions />
      <CloseBand
        heading={`Go and run the business. ${PRODUCT.name} will handle the business software.`}
        primary={{ label: 'Get Piggles', href: accountUrl('signup', 'home-close') }}
        secondary={{ label: 'Talk to a person', href: accountUrl('contact', 'home-close') }}
        note="$49 a month · free for 14 days · no card needed"
      />
      {/* She closes the page rather than sitting inside the band — the band is
          two columns of heading and decision, and a third thing in there makes
          the decision share a row.

          Small, and pulled up tight against the band. At `lg` in the page's own
          rhythm she left a 300px empty stripe between the last thing said and
          the footer, which reads as the page having stopped rather than ended. */}
      <div className="-mt-4 flex justify-center sm:-mt-8">
        <PigglesMascot pose="celebrate" size={{ base: 'sm', lg: 'md' }} />
      </div>
    </div>
  );
}
