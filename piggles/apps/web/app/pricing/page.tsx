import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody, Table } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { accountUrl, PRODUCT } from '@piggles/config';
import { PageHero } from '@/components/marketing/page-hero';
import { Faq } from '@/components/marketing/faq';
import { CloseBand } from '@/components/marketing/close-band';

// /pricing — one plan, and the part everyone actually wants to know: what makes
// the number go up.
//
// The page is structured as a promise followed by its own small print, in that
// order, because the promise is only worth anything if the small print is on the
// same page. A pricing page that says "one simple price" and hides the limits
// behind a support article is the thing this product is positioned against.
//
// NO COMPARISON GRID. Not a stylistic choice — piggles/CLAUDE.md RULE #2 forbids
// tiers, and a three-column grid is how tiers get reintroduced by a designer who
// only meant to fill the width. There is one plan, so there is one card.
//
// ── NUMBERS ─────────────────────────────────────────────────────────────────
// The allowances below come from the approved source pack
// (docs/initial/docs/commercial/PRICING_AND_ENTITLEMENTS.md), which states two of
// them as ranges — 10–25 GB storage, 5,000–10,000 email sends — and says
// explicitly that final numbers must be validated against infrastructure cost.
//
// This page publishes the LOW end of each range. Deliberate: an allowance can be
// raised later and every existing customer is pleased, but lowering a published
// number is a repricing you have to write to people about. Confirm the final
// figures against real infrastructure cost before launch; until then these are
// the safe end of a hypothesis, not a measured limit.

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Piggles is $49 a month with all fifteen apps included. No tiers, no per-feature unlocks. Your bill changes when your business needs more room, not when you switch an app on.',
};

const INCLUDED = [
  { what: 'All fifteen apps', amount: 'Every one', note: 'No app is an upgrade' },
  { what: 'Your business', amount: '1', note: 'A second business is its own subscription' },
  { what: 'Locations', amount: '1', note: 'Shops, units, vans — add more any time' },
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
    body: 'Bookings is not a tier. Invoices is not an add-on. If it is one of the fifteen, it is in the price.',
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
    a: 'Nothing you already have is touched, and nothing you are part way through is stopped. You get a quiet notice as you approach it, and the option to add more room in one tap at the moment it matters — with the price on the button, not behind it. If you do nothing, only new additions of that one kind pause. Your website stays up, your customers stay visible, and order confirmations and password resets always go out regardless.',
  },
  {
    q: 'Can I get rid of extra capacity later?',
    a: 'Yes, without talking to anybody. Adding room is one tap, and removing it is the same. A purchase that is easy to make and hard to undo is a trap, not a feature.',
  },
  {
    q: 'Do I need a card to try it?',
    a: 'No. The trial is fourteen days with no card. If you decide not to carry on, nothing happens — there is no charge to cancel before.',
  },
  {
    q: 'What if I run two businesses?',
    a: 'Each business is its own subscription, with its own website, customers and books kept completely separate. That is deliberate: sharing them is almost always a mistake you find out about at tax time.',
  },
  {
    q: 'Can I take my data with me if I leave?',
    a: 'All of it, whenever you want, in formats other software can actually read — customers, products, orders, invoices and everything you have written. You do not have to ask, and you do not have to be leaving.',
  },
  {
    q: 'Is there a discount for paying yearly?',
    a: 'Not yet. When there is, it will be a straightforward reduction rather than a different plan with different limits.',
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        heading="$49 a month. All fifteen apps. No upgrade buttons."
        lede="You are not charged for what the software is allowed to do. You are charged when your business needs more room — more people, more storage, more email going out."
      >
        <a
          className={buttonClasses({ color: 'primary', size: 'lg' })}
          href={accountUrl('signup', 'pricing-hero')}
        >
          Start free for 14 days
        </a>
        <Link
          className={buttonClasses({ color: 'neutral', variant: 'outline', size: 'lg' })}
          href="/apps"
        >
          See the fifteen apps
        </Link>
      </PageHero>

      <section className="px-6 py-16 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-3xl font-extrabold sm:text-4xl">What you get for it</h2>
            <p className="mt-6 text-lg">
              The allowances below are what one subscription includes. Most businesses never come
              near any of them — they exist so that the price can stay the same for everybody who
              does not.
            </p>
            {/* Spelled out, not `{APPS.length}`. The derived count is more
                robust but it renders "15" three lines under a heading that says
                "fifteen", and mixed numerals in one passage read as an
                oversight. The registry is still the source of truth — if an app
                is ever added, this page is one of the places to update, which is
                why /apps derives its own list rather than repeating one here. */}
            <p className="mt-4 text-lg">
              Fifteen apps, and the two things that usually cost extra everywhere else — your own
              domain and your own sending address — are in here too.
            </p>
          </div>

          <Card>
            <CardBody>
              <p className="text-6xl font-extrabold">
                $49<span className="text-xl font-bold">/month</span>
              </p>
              <p className="mt-2 text-base">Per business. Cancel any time.</p>
              <a
                className={`${buttonClasses({ color: 'primary', size: 'lg', block: true })} mt-8`}
                href={accountUrl('signup', 'pricing-card')}
              >
                Start free for 14 days
              </a>
              <p className="mt-3 text-center text-base">No card needed to start.</p>
            </CardBody>
          </Card>
        </div>

        <div className="mx-auto mt-12 max-w-7xl">
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
      </section>

      <section className="bg-base-100 border-base-300 border-y px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-3 lg:gap-16">
            <div>
              <h2 className="text-3xl font-extrabold sm:text-4xl">
                What we will never charge you for.
              </h2>
              <p className="mt-6 text-lg">
                This is the part worth reading twice, because it is where most business software
                gets you and where this one has decided not to.
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
        </div>
      </section>

      <section className="px-6 py-16 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-3 lg:gap-16">
          <h2 className="text-3xl font-extrabold sm:text-4xl">The questions everybody asks.</h2>
          <div className="lg:col-span-2">
            <Faq items={FAQ} />
          </div>
        </div>
      </section>

      <CloseBand
        heading="Fourteen days, no card, all fifteen apps."
        primary={{ label: `Get ${PRODUCT.name}`, href: accountUrl('signup', 'pricing-close') }}
        secondary={{
          label: 'Ask us something first',
          href: accountUrl('contact', 'pricing-close'),
        }}
      />
    </>
  );
}
