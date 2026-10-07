import type { Metadata } from 'next';
import { FaqSection, Section } from '@piggles/ui';
import Link from 'next/link';
import { Table } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { accountUrl, APP_COUNT_WORD, APP_COUNT_WORD_CAP, PRODUCT } from '@piggles/config';
import { fetchFounderOffer, PRICE_LABEL } from '@piggles/config/pricing';
import { PageHero } from '@/components/marketing/page-hero';
import { PriceFigure } from '@/components/marketing/hero/price-figure';
import { WhatYouPay } from '@/components/marketing/what-you-pay';
import { CloseBand } from '@/components/marketing/close-band';
import { FounderBand } from '@/components/marketing/founder-band';

// /pricing: one plan, then what makes the number go up, then its small print, on
// one page. No comparison grid: RULE #2 forbids tiers, and a grid reintroduces them.
// Allowances publish the LOW end of the source pack's ranges until cost is measured.

export const metadata: Metadata = {
  title: 'Pricing',
  description: `Piggles is ${PRICE_LABEL} a month with all ${APP_COUNT_WORD} apps included. No tiers, no per-feature unlocks. Your bill changes when your business needs more room, not when you switch an app on.`,
};

const INCLUDED = [
  { what: `All ${APP_COUNT_WORD} apps`, amount: 'Every one', note: 'No app is an upgrade' },
  { what: 'Your business', amount: '1', note: 'A second business is its own subscription' },
  { what: 'Locations', amount: '1', note: 'Shops, units, vans: add more any time' },
  { what: 'Websites', amount: '1', note: 'On your own domain, certificate included' },
  { what: 'People on your team', amount: '3', note: 'Each with their own sign-in and access' },
  { what: 'Customer records', amount: '10,000', note: 'People and companies you deal with' },
  { what: 'Storage', amount: '10 GB', note: 'Images, documents, everything you upload' },
  { what: 'Email sends', amount: '5,000/month', note: 'Order and booking emails do not count' },
  { what: 'Products and services', amount: 'Unlimited', note: 'No count that triggers an upgrade' },
  {
    what: 'Orders, bookings, invoices',
    amount: 'Unlimited',
    note: 'Selling more is not a penalty',
  },
];

const NEVER = [
  {
    title: 'No app costs extra',
    body: `Bookings is not a tier. Invoices is not an add-on. If it is one of the ${APP_COUNT_WORD}, it is in the price.`,
  },
  {
    title: 'No plan to compare',
    body: 'There is one plan, so there is nothing to work out and nothing to regret choosing.',
  },
  {
    title: 'No penalty for growing',
    body: 'Nobody will ever tell you the eleventh product needs a bigger plan. Selling more is the point.',
  },
  {
    title: 'Nothing switches off',
    body: 'Reach a limit and your site stays up, your customers stay visible, and the thing you were part way through still finishes.',
  },
];

const FAQ = [
  {
    q: 'What happens if I go over one of the limits?',
    a: 'Nothing you already have is touched, and nothing you are part way through is stopped. You get a quiet notice as you approach it, and the option to add more room in one tap at the moment it matters, with the price on the button, not behind it. If you do nothing, only new additions of that one kind pause. Your website stays up, your customers stay visible, and order confirmations and password resets always go out regardless.',
  },
  {
    q: 'Can I get rid of extra capacity later?',
    a: 'Yes, without talking to anybody. Adding room is one tap, and removing it is the same. A purchase that is easy to make and hard to undo is a trap, not a feature.',
  },
  {
    q: 'Do I need a card to try it?',
    a: 'No. The trial is fourteen days with no card. If you decide not to carry on, nothing happens. There is no charge to cancel before.',
  },
  {
    q: 'What if I run two businesses?',
    a: 'Each business is its own subscription, with its own website, customers and books kept completely separate. That is deliberate: sharing them is almost always a mistake you find out about at tax time.',
  },
  {
    q: 'Can I take my data with me if I leave?',
    a: 'Whenever you want, as spreadsheets other software can actually read: customers, products, stock, orders, invoices, bookings and your articles, each from the list it lives on. You do not have to ask, and you do not have to be leaving.',
  },
  {
    q: 'Is there a discount for paying yearly?',
    a: 'Not yet. When there is, it will be a straightforward reduction rather than a different plan with different limits.',
  },
];

export default async function PricingPage() {
  const offer = await fetchFounderOffer();
  return (
    <>
      <PageHero
        heading={`${PRICE_LABEL} a month. All ${APP_COUNT_WORD} apps. No upgrade buttons.`}
        lede="You are not charged for what the software is allowed to do. You are charged when your business needs more room: more people, more storage, more email going out."
        figure={<PriceFigure />}
        assurances={['Free for 14 days', 'No card needed', 'Cancel by not carrying on']}
      >
        <a
          className={buttonClasses({ color: 'primary', size: 'lg' })}
          href={accountUrl('signup', 'pricing-hero')}
        >
          Start free for 14 days
        </a>
        <Link className={buttonClasses({ variant: 'outline', size: 'lg' })} href="/apps">
          See the {APP_COUNT_WORD} apps
        </Link>
      </PageHero>

      <WhatYouPay />

      <FounderBand offer={offer} from="pricing" />

      <Section>
        <div className="max-w-[62ch]">
          <h2 className="text-3xl font-extrabold sm:text-4xl">What you get for it</h2>
          <p className="mt-6 text-lg">
            The allowances below are what one subscription includes. Most businesses never come near
            any of them. They exist so that the price can stay the same for everybody who does not.
          </p>
          {/* Spelled out (APP_COUNT_WORD_CAP), so numerals never mix with words here. */}
          <p className="mt-4 text-lg">
            {APP_COUNT_WORD_CAP} apps, and the two things that usually cost extra everywhere else
            (your own domain and your own sending address) are in here too.
          </p>
        </div>

        <div className="mt-12">
          <Table zebra>
            <thead>
              <tr>
                <th>Included</th>
                <th>How much</th>
                <th>What that means</th>
              </tr>
            </thead>
            <tbody>
              {INCLUDED.map((row) => (
                <tr key={row.what}>
                  <td className="font-semibold">{row.what}</td>
                  <td className="font-bold whitespace-nowrap">{row.amount}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Section>

      <Section className="bg-base-100 border-base-300 border-y">
        <div className="grid gap-10 lg:grid-cols-3 lg:gap-16">
          <div>
            <h2 className="text-3xl font-extrabold sm:text-4xl">
              What we will never charge you for.
            </h2>
            <p className="mt-6 text-lg">
              This is the part worth reading twice, because it is where most business software gets
              you and where this one has decided not to.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-2">
            {NEVER.map((n) => (
              <div key={n.title}>
                <h3 className="text-xl font-bold">{n.title}</h3>
                <p className="mt-2 text-base">{n.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <FaqSection heading="The questions everybody asks." items={FAQ} />

      <CloseBand
        heading={`Fourteen days, no card, all ${APP_COUNT_WORD} apps.`}
        primary={{ label: `Get ${PRODUCT.name}`, href: accountUrl('signup', 'pricing-close') }}
        secondary={{
          label: 'Ask us something first',
          href: accountUrl('contact', 'pricing-close'),
        }}
      />
    </>
  );
}
