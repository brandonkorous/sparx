import type { Metadata } from 'next';
import Link from 'next/link';
import { FaqSection, Section } from '@piggles/ui';
import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { accountUrl } from '@piggles/config';
import { SOURCE_GROUPS, SWITCHING_QUESTIONS } from '@/content/switching';
import { PageHero } from '@/components/marketing/page-hero';
import { CloseBand } from '@/components/marketing/close-band';
import { FaqJsonLd } from '@/components/marketing/faq-jsonld';
import { HeroPanel, HeroPanelBar, HeroRow, HeroRows } from '@/components/marketing/hero/panel';

// /switching: moving to Piggles from wherever you are now. The four steps of
// Move in, every platform it reads and what it reads from each, what stays
// behind, and the questions people ask before they commit a weekend to it.

export const metadata: Metadata = {
  title: 'Switching to Piggles',
  description:
    'Move to Piggles from Shopify, Square, Wix, Squarespace, WordPress, HubSpot and more. What comes across from each, what you set up by hand, and how to run both while you decide.',
  alternates: { canonical: '/switching' },
};

const STEPS = [
  {
    title: 'Say where you are coming from',
    body: 'Pick your old platform from the list in “Move in from somewhere else”. Piggles tells you which files to download and where to find them there.',
  },
  {
    title: 'Drop the files in, or paste a key',
    body: 'Drop in the exports your old platform made. Shopify, HubSpot, WordPress and WooCommerce can connect with a read-only key instead, so your records are fetched for you.',
  },
  {
    title: 'Check what will happen',
    body: 'Every row is shown before anything is saved: what will be added, what will be matched to something you already have, and what needs a fix, with the reason.',
  },
  {
    title: 'Bring it in',
    body: 'Press go and watch it arrive. Products land in Sell and Stock, people in Customers, orders in your history and posts in Content.',
  },
];

const BY_HAND = [
  {
    title: 'Your design',
    body: 'Designs never move between platforms. Pick a look, set your colors and fonts, and arrange ready-made sections around your content.',
  },
  {
    title: 'Taking payments',
    body: 'Connect Stripe, PayPal, Square, Authorize.net or 1stPayGateway. You need an account with them, and most take a few minutes.',
  },
  {
    title: 'Upcoming appointments',
    body: 'Bookings do not import. Add the ones still to come, or keep the old calendar running until they have passed.',
  },
  {
    title: 'Your domain',
    body: 'When you are ready, point your own domain at Piggles. Until then, your new site is live on a free Piggles address.',
  },
];

function SwitchingFigure() {
  return (
    <HeroPanel>
      <HeroPanelBar app="connections" title="Move in from somewhere else" note="Shopify" />
      <HeroRows>
        <HeroRow
          label="Products"
          sub="products_export.csv"
          right={
            <Badge color="success" variant="soft" size="lg">
              Ready
            </Badge>
          }
        />
        <HeroRow
          label="Customers"
          sub="customers_export.csv"
          right={
            <Badge color="success" variant="soft" size="lg">
              Ready
            </Badge>
          }
        />
        <HeroRow
          label="Orders"
          sub="orders_export.csv"
          right={
            <Badge color="success" variant="soft" size="lg">
              Ready
            </Badge>
          }
        />
        <HeroRow
          label="Pages and blog posts"
          sub="With a read-only key"
          right={
            <Badge color="info" variant="soft" size="lg">
              Key
            </Badge>
          }
        />
      </HeroRows>
      <p className="px-5 py-4 text-base font-semibold">
        Nothing is saved until you have seen every row.
      </p>
    </HeroPanel>
  );
}

export default function Switching() {
  return (
    <>
      <FaqJsonLd path="/switching" name="Switching to Piggles" items={SWITCHING_QUESTIONS} />
      <PageHero
        heading="Bring your business with you."
        lede="Moving software is the part everybody dreads. Piggles reads the exports your old platform already makes, shows you what will happen to every row, and only then saves anything. Your old platform is not touched."
        figure={<SwitchingFigure />}
        assurances={['Free for 14 days', 'Old platform untouched', 'Preview before saving']}
      >
        <a
          className={buttonClasses({ color: 'primary', size: 'lg' })}
          href={accountUrl('signup', 'switching')}
        >
          Start free and move in
        </a>
        <Link className={buttonClasses({ variant: 'outline', size: 'lg' })} href="#platforms">
          Find your platform
        </Link>
      </PageHero>

      <Section>
        <h2 className="text-3xl font-extrabold sm:text-4xl">
          Four steps, and you can stop at any of them
        </h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.title}>
              <Card className="h-full">
                <CardBody>
                  <h3 className="text-xl font-bold">{s.title}</h3>
                  <p className="mt-2 text-base">{s.body}</p>
                </CardBody>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="platforms" variant="panel" className="bg-base-100 shadow">
        <h2 className="text-3xl font-extrabold sm:text-4xl">What comes across, and from where</h2>
        <p className="mt-4 max-w-[62ch] text-lg">
          Each platform exports different things, so each one brings different things. Not on the
          list? Any spreadsheet works: Piggles guesses what each column means and you correct it.
        </p>
        <div className="mt-10 grid gap-12">
          {SOURCE_GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="text-2xl font-bold">{g.title}</h3>
              <p className="mt-2 text-base">{g.body}</p>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.sources.map((s) => (
                  <li key={s.name} className="border-base-300 rounded-section border p-5">
                    <div className="flex items-center justify-between gap-3">
                      <b className="text-lg font-bold">{s.name}</b>
                      {s.liveKey ? (
                        <Badge color="info" variant="soft">
                          Read-only key
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-base">{s.brings.join(', ')}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section variant="panel" className="bg-primary text-primary-content">
        <p className="max-w-[30ch] text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          Your old platform keeps working until you decide it can stop.
        </p>
      </Section>

      <Section>
        <h2 className="text-3xl font-extrabold sm:text-4xl">What you set up yourself</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {BY_HAND.map((b) => (
            <Card key={b.title}>
              <CardBody>
                <h3 className="text-xl font-bold">{b.title}</h3>
                <p className="mt-2 text-base">{b.body}</p>
              </CardBody>
            </Card>
          ))}
        </div>
        <p className="mt-8 text-lg">
          Weighing up a particular platform?{' '}
          <Link href="/compare" className="font-bold underline underline-offset-4">
            Read the side-by-side comparisons
          </Link>
          .
        </p>
      </Section>

      <FaqSection heading="Questions before moving" items={SWITCHING_QUESTIONS} />

      <CloseBand
        heading="Try it on a copy of your business, for free."
        primary={{ label: 'Start free for 14 days', href: accountUrl('signup', 'switching-close') }}
        secondary={{ label: 'Talk to a person', href: accountUrl('contact', 'switching') }}
        note="No card needed. Your old platform is not touched."
      />
    </>
  );
}
