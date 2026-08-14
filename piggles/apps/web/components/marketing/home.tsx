import Link from 'next/link';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { badgeClasses, buttonClasses } from '@wizeworks/silicaui-react/server';
import { PIGGLES_GROUPS, type PigglesGroup } from '@piggles/brand';
import { accountUrl, appsInGroup, PRODUCT } from '@piggles/config';
import { HeroVideo } from './hero-video';
import { PhotoBand, PhotoStrip } from './photo-band';
import { CloseBand } from './close-band';
import { GROUP_COPY } from './groups';

// meetpiggles.com — the homepage.
//
// THE ARGUMENT, in order, because the order is the whole thing:
//
//   1. promise      — software for people who have a business to run
//   2. recognition  — the day is already full
//   3. false fix    — so you buy the simple one, and simple means de-featured
//   4. THE TURN     — it was never about how much the software does. It's that
//                     every tool makes you learn its vocabulary first.
//   5. consequence  — named properly, everything can be here, and work together
//   6. resolution   — one price, no module math
//
// Beat 4 is load-bearing and is the section this page exists for. "All-in-one for
// one price" is a category claim every competitor also makes; "you don't have a
// CRM, you have customers" is one only this product can make, because the
// vocabulary really is different all the way down (@piggles/config's lexicon).
//
// MEDIA IS ARGUMENT, NOT DECORATION. The first version of this page was type and
// colour only, and it read as basic — accurately. Each picture here is carrying a
// claim the prose would otherwise have to make alone:
//   • the hero IS the montage — eight kinds of business on screen before the copy
//     says "any", which is the one thing type cannot do;
//   • the photo strip shows eight trades in one glance, which is faster than a
//     sentence and is the test for whether an image earned its place;
//   • the bands give the two most abstract sections (a full day, many things open
//     at once) something concrete to sit against.
// Anything added later has to pass the same test.
//
// LAYOUT. Every section commits to a two-column structure or deliberately fills
// the measure. The first version set `max-w-2xl` prose inside a `max-w-5xl`
// container, which left the right-hand half of four sections empty and read as
// thin — a page can be correct and still look like a draft.
//
// SERVER COMPONENT. Calls-to-action are real anchors styled with `buttonClasses`
// / `badgeClasses` from `@wizeworks/silicaui-react/server`, NOT `<Button render={
// <a/>}>`. That package is a "use client" module: an element passed to `render`
// from a server component is serialised across the boundary and arrives without
// its props, so the link renders perfectly and goes nowhere. Only `SiteHeader`,
// which is already a client component, may use `render`.

/** The turn, as data. Left is what the industry calls it; right is what the
 *  person doing it would say. Each row carries its group, so the right-hand
 *  column already wears the colour it wears inside the product — the translation
 *  and the product are the same translation. */
const TRANSLATIONS: { jargon: string; plain: string; href: string; group: PigglesGroup }[] = [
  { jargon: 'CRM', plain: 'Customers', href: '/apps/customers', group: 'people' },
  { jargon: 'CMS', plain: 'Content', href: '/apps/content', group: 'web' },
  { jargon: 'SEO', plain: 'Get Found', href: '/apps/get_found', group: 'web' },
  { jargon: 'Inventory management', plain: 'Stock', href: '/apps/stock', group: 'sell' },
  { jargon: 'Scheduling', plain: 'Bookings', href: '/apps/bookings', group: 'people' },
  { jargon: 'Financial reporting', plain: 'Money', href: '/apps/money', group: 'money' },
];

// Every one of these has been opened and looked at, and the label describes what
// is in the frame rather than what the file is called. That is not a formality:
// the first version of this list called a wall of decorative plates a café,
// because the alt text was written from the file name. A photograph that
// contradicts its caption is worse than no photograph.
const TRADES = [
  { src: '/photos/bakery.jpg', alt: 'Fresh loaves on a bakery counter', label: 'Bakeries' },
  {
    src: '/photos/coffee-shop.jpg',
    alt: 'Staff working behind the counter of a busy café',
    label: 'Cafés',
  },
  { src: '/photos/barber.jpg', alt: 'A barber finishing a client’s cut', label: 'Barbers' },
  {
    src: '/photos/florist.jpg',
    alt: 'A hand-lettered sign and cut tulips at a florist',
    label: 'Florists',
  },
  {
    src: '/photos/pottery.jpg',
    alt: 'Clay-covered hands shaping a pot on a wheel',
    label: 'Makers',
  },
  { src: '/photos/garage.jpg', alt: 'A car on a lift above a bench of tools', label: 'Garages' },
  { src: '/photos/carpenter.jpg', alt: 'A joiner marking a length of timber', label: 'Trades' },
  {
    src: '/photos/market.jpg',
    alt: 'Punnets of tomatoes and corn on a market stall',
    label: 'Grocers',
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

// SURFACES ALTERNATE, STRICTLY. Every section down this page swaps between
// `base-200` (the body's warm off-white, the default here) and `base-100`
// (paper). Two adjacent sections on the SAME surface merge into one tall block
// with a 160px void through the middle of it, which is what the first pass
// looked like — the bakery band and the section under it were both `base-100`.
// The alternation is also the only thing separating sections, since this house
// bans shadows and decorative rules.
function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`px-6 py-20 sm:py-28 ${className}`}>
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

function Hero() {
  return (
    <HeroVideo>
      <h1 className="text-4xl leading-tight font-extrabold sm:text-5xl">{PRODUCT.tagline}</h1>

      <p className="mt-6 text-lg sm:text-xl">
        Your website, your customers, bookings, stock, invoices and messages — in one place, for one
        price. Named for what you are actually doing, not for what the software category is called.
      </p>

      <div className="mt-9 flex flex-wrap items-center gap-3">
        <a
          className={buttonClasses({ color: 'primary', size: 'lg' })}
          href={accountUrl('signup', 'home-hero')}
        >
          Get Piggles — $49/month
        </a>
        <Link
          className={buttonClasses({ color: 'neutral', variant: 'outline', size: 'lg' })}
          href="/apps"
        >
          See what&rsquo;s included
        </Link>
      </div>

      <p className="mt-4 text-base">Free for 14 days. No card needed.</p>
    </HeroVideo>
  );
}

/** Beat 3. Two columns of prose under one heading rather than a single narrow
 *  measure — the section is a short beat and should look like one, not like a
 *  page that ran out of things to say halfway across. */
function FalseFix() {
  return (
    <Section>
      <div className="grid gap-10 lg:grid-cols-3 lg:gap-16">
        <h2 className="text-3xl font-extrabold sm:text-4xl">So you try the simple one.</h2>
        <div className="lg:col-span-2 lg:pt-1">
          <p className="text-lg">
            And it is simple — because they left things out. It carries you through the first year
            beautifully. Then you need to take a deposit, or invoice in another currency, or give
            somebody access to just the bookings, and it cannot.
          </p>
          <p className="mt-4 text-lg">
            So you move everything. Again. Simple usually means you will outgrow it.
          </p>
        </div>
      </div>
    </Section>
  );
}

/** Beat 4 — the section the page exists for. The argument sits in the left
 *  column and the evidence in the right, so the translation list reads as proof
 *  of the sentence beside it rather than as a decorative list underneath it. */
function TheTurn() {
  return (
    <Section className="bg-base-100">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            Simple doesn&rsquo;t have to mean basic.
          </h2>
          <p className="mt-6 text-lg">
            Business software is rarely hard because it does too much. It is hard because it makes
            you learn its vocabulary before it will help you.
          </p>
          <p className="text-primary mt-6 text-2xl font-extrabold sm:text-3xl">
            You don&rsquo;t have a CRM. You have customers.
          </p>
          <p className="mt-6 text-lg">
            Nothing was removed to get those names. The capability underneath is the same one bigger
            companies pay a great deal more for — it just stopped asking you to translate.
          </p>
        </div>

        {/* Rules are per-row `border-b`, NOT `divide-y` + a divide colour: silicaui
            registers `border-base-300` but not `divide-base-300`, and an arbitrary
            `divide-[color:…]` does not compile — the dividers would silently fall
            back to `currentColor`. Verified in the built CSS. */}
        <ul className="border-base-300 border-t">
          {TRANSLATIONS.map((t) => (
            <li key={t.jargon} data-group={t.group} className="border-base-300 border-b">
              <Link
                href={t.href}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5"
              >
                <span className="text-base line-through">{t.jargon}</span>
                <span className="text-module text-xl font-bold sm:text-2xl">{t.plain}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/** Beat 5. Fifteen apps in six groups, each group wearing the hue it wears
 *  inside the product — so the page is teaching the colour system while it makes
 *  the point, and a visitor who signs up recognises the rail. */
function Included() {
  return (
    <Section>
      <div className="grid gap-10 lg:grid-cols-3 lg:gap-16">
        <div>
          <h2 className="text-3xl font-extrabold sm:text-4xl">Everything is already here.</h2>
          <p className="mt-6 text-lg">
            Fifteen apps, six parts of a business. Turn one on and your workspace changes. Your bill
            does not.
          </p>
          <Link
            className={`${buttonClasses({ color: 'primary', variant: 'outline' })} mt-6`}
            href="/apps"
          >
            Look at all fifteen
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {PIGGLES_GROUPS.map((group) => (
            /* Six cards, six hues, exactly one card per hue — the case the tint
               exists for. `bg-module bg-soft` is silica's universal soft
               treatment mixing the group colour into the surface, so it stays
               correct in dark and follows the token if a hue ever changes. */
            <Card key={group} data-group={group} className="bg-module bg-soft">
              <CardBody>
                <h3 className="text-module text-xl font-bold">{GROUP_COPY[group].title}</h3>
                <p className="text-base">{GROUP_COPY[group].blurb}</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {appsInGroup(group).map((app) => (
                    <li key={app.id}>
                      <Link
                        href={`/apps/${app.id}`}
                        className={badgeClasses({ color: 'module', variant: 'soft', size: 'lg' })}
                      >
                        {app.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Trades() {
  return (
    <Section>
      <div className="grid gap-10 lg:grid-cols-3 lg:gap-16">
        <h2 className="text-3xl font-extrabold sm:text-4xl">Whatever kind of business you have.</h2>
        <p className="text-lg lg:col-span-2 lg:pt-1">
          Piggles is not a shop product with appointments bolted on, or a booking product that also
          does invoices. A bakery, a barber and a potter are equally the point — and so is the
          garage, the market stall and the person who makes things in a shed.
        </p>
      </div>
      <PhotoStrip photos={TRADES} className="mt-12" />
    </Section>
  );
}

function Pricing() {
  return (
    <Section className="bg-base-100">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <h2 className="text-3xl font-extrabold sm:text-4xl">$49 a month. All of it.</h2>
          <p className="mt-6 text-lg">
            Every app is included from the first day. There are no tiers to compare, no modules to
            price up, and nothing behind an upgrade button.
          </p>
          <p className="mt-4 text-lg">
            Your bill changes when your <em>business</em> needs more room — more people on the team,
            more storage, more email going out. Not because you switched Bookings on.
          </p>
          <Link
            className={`${buttonClasses({ color: 'neutral', variant: 'outline' })} mt-6`}
            href="/pricing"
          >
            What counts as more room
          </Link>
        </div>

        <Card>
          <CardBody>
            <p className="text-5xl font-extrabold">
              $49<span className="text-xl font-bold">/month</span>
            </p>
            <ul className="mt-6 space-y-2 text-base">
              <li>All fifteen apps</li>
              <li>Your website and a Piggles address</li>
              <li>Three people on your team</li>
              <li>Everything exportable, always</li>
            </ul>
            <a
              className={`${buttonClasses({ color: 'primary', size: 'lg', block: true })} mt-8`}
              href={accountUrl('signup', 'home-pricing')}
            >
              Get Piggles
            </a>
            <p className="mt-3 text-center text-base">Free for 14 days. No card needed.</p>
          </CardBody>
        </Card>
      </div>
    </Section>
  );
}

function Trust() {
  return (
    <Section>
      <div className="grid gap-10 lg:grid-cols-3 lg:gap-16">
        <div>
          <h2 className="text-3xl font-extrabold sm:text-4xl">The boring things, done properly.</h2>
          <Link
            className={`${buttonClasses({ color: 'neutral', variant: 'outline' })} mt-6`}
            href="/trust"
          >
            How your data is handled
          </Link>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:col-span-2">
          {TRUST.map((t) => (
            <div key={t.title}>
              <h3 className="text-xl font-bold">{t.title}</h3>
              <p className="mt-2 text-base">{t.body}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Close() {
  return (
    <CloseBand
      heading="Go and run the business. Piggles will handle the business software."
      primary={{ label: 'Get Piggles', href: accountUrl('signup', 'home-close') }}
      secondary={{ label: 'Talk to a person', href: accountUrl('contact', 'home-close') }}
    />
  );
}

export function HomePage() {
  return (
    <>
      <Hero />

      <PhotoBand
        src="/photos/bakery.jpg"
        alt="Fresh loaves on a bakery counter partway through the day"
        side="right"
        className="bg-base-100"
      >
        <h2 className="text-3xl font-extrabold sm:text-4xl">
          You didn&rsquo;t start a business to become a software administrator.
        </h2>
        <p className="mt-6 text-lg">
          The day is already full. Somewhere in it you are also supposed to update the website,
          chase the two invoices nobody has paid, answer the person asking about Saturday, and work
          out whether you have any of the blue ones left.
        </p>
      </PhotoBand>

      <FalseFix />
      <TheTurn />
      <Included />

      {/* Two pairs of hands, pins, thread and scissors — several jobs going at
          once, which is precisely the claim this section makes. It replaced a
          photograph of an antique tool display: a museum piece cannot illustrate
          work in progress, because nothing in it is in progress. */}
      <PhotoBand
        src="/photos/seamstress.jpg"
        alt="Two people working on a garment together, with pins, thread and scissors laid out"
        side="left"
        className="bg-base-100"
      >
        <h2 className="text-3xl font-extrabold sm:text-4xl">
          Keep what you&rsquo;re working on open together.
        </h2>
        <p className="mt-6 text-lg">
          Most business software makes you finish one thing before you can look at another. Piggles
          does not. Edit a product with its stock beside it. Write to a customer with their whole
          history open next to the message. Change the website and watch the real page change as you
          type.
        </p>
        <p className="mt-4 text-lg">Leave it how you like it. It will be there tomorrow.</p>
      </PhotoBand>

      <Trades />
      <Pricing />
      <Trust />
      <Close />
    </>
  );
}
