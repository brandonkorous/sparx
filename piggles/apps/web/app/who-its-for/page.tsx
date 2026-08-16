import type { Metadata } from 'next';
import { Section } from '@piggles/ui';
import Link from 'next/link';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import type { PigglesGroup } from '@piggles/brand';
import { accountUrl, APP_BY_ID, type PigglesAppId } from '@piggles/config';
import type { MascotPoseId } from '@piggles/mascot';
import { PigglesMascot } from '@piggles/mascot/react';
import { PageHero } from '@/components/marketing/page-hero';
import { CloseBand } from '@/components/marketing/close-band';

// /who-its-for — the destination behind the home page's trade wall.
//
// ── WHY THIS PAGE HAD TO EXIST ──────────────────────────────────────────────
//
// The home page shows eleven trades on a moving wall and then offers the reader
// nowhere to go with the recognition it just created. A visitor who sees a
// barber and thinks "but does it actually work for a barber" had exactly one
// route out of that section, which was to keep scrolling past it. The wall makes
// a promise the home page cannot keep in three seconds, and this is where it is
// kept.
//
// ── IT IS THE HONEST SUBSTITUTE FOR A LOGO WALL ─────────────────────────────
//
// DESIGN.md §10 forbids inventing customers, counts and testimonials, which
// rules out the page every competitor puts here. What is left that is TRUE is
// the shape of the work: a barber sells time, a bakery sells the same forty
// things every morning, a supplier sells to businesses on account. None of that
// requires anybody to have signed up, and it is more use to a reader than a wall
// of strangers' logos would be.
//
// So every trade below says (a) what is actually different about running that
// business and (b) which of the fifteen apps that shape leans on. The apps are
// the real registry entries — renaming one carries here — and the claim in each
// sentence is about the TRADE, never about a customer we have.
//
// ── AND IT IS DELIBERATELY NOT ELEVEN LANDING PAGES ─────────────────────────
//
// The obvious build is /for/barber, /for/bakery, ×11. That is eleven pages
// competing for the same searches, each thin, each needing its own maintenance,
// and each claiming a specialisation the product does not have — Piggles is not
// a barber product. One page that shows eleven shapes side by side makes the
// actual argument, which is that the differences are smaller than they look.

export const metadata: Metadata = {
  title: 'Who Piggles is for',
  description:
    'A bakery, a barber, a potter, a garage, a market stall — what is different about running each of them, and which of the fifteen apps that shape leans on.',
};

interface Trade {
  pose: MascotPoseId;
  /** The trade, as its owner would say it. */
  name: string;
  /** What is genuinely different about the SHAPE of this business. */
  shape: string;
  /** The apps that shape leans on hardest. Three or four, never all fifteen —
   *  a list that names everything distinguishes nothing. */
  leans: PigglesAppId[];
  group: PigglesGroup;
}

// Ordered so the first four cover the four genuinely different shapes a small
// business comes in — selling goods, selling time, selling made-to-order, and
// selling a service with parts. Everything after is a variation a reader can
// map onto one of those, which is the argument this page is making.
const TRADES: Trade[] = [
  {
    pose: 'bakery',
    name: 'A bakery',
    shape:
      'You sell the same forty things every morning and they are gone by two. What matters is what is left, what sold out early, and never having to write the list twice.',
    leans: ['sell', 'stock', 'money'],
    group: 'sell',
  },
  {
    pose: 'barber',
    name: 'A barber',
    shape:
      'You are not selling a thing, you are selling Tuesday at half past three. The diary is the business, and an empty chair is the only stock that never comes back.',
    leans: ['bookings', 'customers', 'messages'],
    group: 'people',
  },
  {
    pose: 'potter',
    name: 'A potter',
    shape:
      'Everything is made once, photographed once and sold once. The website is the shop, and the hard part is that a piece has to come off it the moment it goes.',
    leans: ['site', 'sell', 'stock'],
    group: 'run',
  },
  {
    pose: 'garage',
    name: 'A garage',
    shape:
      'A job is a booking, a pile of parts and an invoice that nobody can write until the work is done. The same car comes back in a year and the history has to still be there.',
    leans: ['bookings', 'invoices', 'customers'],
    group: 'web',
  },
  {
    pose: 'market-stall',
    name: 'A market stall',
    shape:
      'You trade three days a week from a folding table with no counter and no back office. Everything has to work on a phone, standing up, with one hand.',
    leans: ['sell', 'money', 'stock'],
    group: 'money',
  },
  {
    pose: 'salon',
    name: 'A salon',
    shape:
      'Several people are booked at once and not everyone can do everything. The rota and the diary are the same problem, and telling them apart is where the double-bookings come from.',
    leans: ['bookings', 'team', 'customers'],
    group: 'run',
  },
  {
    pose: 'tailor',
    name: 'A tailor',
    shape:
      'Every job is a set of measurements, two fittings and a date somebody is depending on. The work is bespoke; the chasing, the deposit and the reminder are not.',
    leans: ['bookings', 'customers', 'invoices'],
    group: 'sell',
  },
  {
    pose: 'art-studio',
    name: 'A studio',
    shape:
      'The work has to be seen before it can be sold, so writing about it is not marketing, it is the job. Being findable is what turns a portfolio into an income.',
    leans: ['content', 'get_found', 'site'],
    group: 'people',
  },
  {
    pose: 'workshop',
    name: 'A workshop',
    shape:
      'You take commissions, you keep materials, and you quote before you build. Knowing what a job actually cost you is the difference between busy and paid.',
    leans: ['invoices', 'stock', 'money'],
    group: 'web',
  },
  {
    pose: 'supplier',
    name: 'A supplier',
    shape:
      'You sell to other businesses, on account, at prices that are not the ones on the website. Terms, purchase orders and who owes what are the whole relationship.',
    leans: ['sell', 'customers', 'invoices'],
    group: 'money',
  },
  {
    pose: 'shed',
    name: 'A shed',
    shape:
      'It is you, evenings, and it might be a business by Christmas. What you need is somewhere to start that will not have to be replaced when it works.',
    leans: ['site', 'sell', 'home'],
    group: 'run',
  },
];

function TradeCard({ trade }: { trade: Trade }) {
  return (
    <li
      data-group={trade.group}
      className="bg-module bg-soft border-base-300 rounded-section flex flex-col gap-5 border p-6 sm:p-8"
    >
      {/* `md`, not the home page's computed scene widths. There the eleven cards
          sit in one moving wall and any size difference between them reads as an
          error; here each card is read on its own, so the simple named size is
          right and the sizing ladder in home.tsx does not need to be shared. */}
      <PigglesMascot pose={trade.pose} size="md" className="self-center" />

      <div>
        <h2 className="text-module font-heading text-2xl font-black">{trade.name}</h2>
        <p className="mt-2.5 text-base">{trade.shape}</p>
      </div>

      {/* The apps are links, and the sentence around them is a real sentence —
          a bare row of names under a paragraph reads as tags, and nobody knows
          whether a tag is a claim or a category. */}
      <p className="mt-auto text-base">
        Leans hardest on{' '}
        {trade.leans.map((app, i) => (
          <span key={app}>
            {i > 0 && (i === trade.leans.length - 1 ? ' and ' : ', ')}
            <Link href={`/apps/${app}`} className="font-bold underline underline-offset-4">
              {APP_BY_ID[app]!.label}
            </Link>
          </span>
        ))}
        . The other twelve are there too.
      </p>
    </li>
  );
}

export default function WhoItsForPage() {
  return (
    <>
      <PageHero
        heading="A bakery, a barber, a potter, and the person who makes things in a shed."
        lede="Every tool you have looked at was built for somebody else's trade, and you have been settling. Here is what is genuinely different about eleven kinds of business — and how little of it the software needs to care about."
      >
        <a
          className={buttonClasses({ color: 'primary', size: 'lg' })}
          href={accountUrl('signup', 'who-its-for')}
        >
          Start free for 14 days
        </a>
        <Link className={buttonClasses({ variant: 'outline', size: 'lg' })} href="/apps">
          See all fifteen apps
        </Link>
      </PageHero>

      <Section>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRADES.map((trade) => (
            <TradeCard key={trade.pose} trade={trade} />
          ))}
        </ul>
      </Section>

      {/* The turn of this page: eleven shapes, then the thing they share. Without
          it the page is a directory and a reader who found no card matching their
          trade leaves believing Piggles is not for them — which is the opposite
          of what eleven examples were meant to prove. */}
      <Section className="bg-base-100 border-base-300 border-y">
        <h2 className="max-w-[24ch] text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          None of them needed a different Piggles.
        </h2>
        <p className="mt-6 max-w-[62ch] text-lg">
          A barber sells time and a bakery sells bread, and underneath they are the same four
          things: someone to remember, something to sell, a bill to send, and a website that says
          you exist. If your trade is not on this page, it is not missing — it is one of these
          eleven with a different word on the door.
        </p>
        <Link className={`${buttonClasses({ color: 'secondary', size: 'lg' })} mt-8`} href="/apps">
          See what you would actually get
        </Link>
      </Section>

      <CloseBand
        heading="Whatever is on your door, it is $49 a month."
        primary={{ label: 'Start free for 14 days', href: accountUrl('signup', 'who-close') }}
        secondary={{ label: 'See what it costs', href: '/pricing' }}
      />
    </>
  );
}
