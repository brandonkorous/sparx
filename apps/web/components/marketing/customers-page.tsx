import { Badge, Card, CardBody, Heading, Text } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Band } from './band';
import { Faq } from './faq';
import { MODULES } from './modules-catalog';
import type { MarketingModule } from './primitives';
import { signupHref, SALES_HREF } from './cta';
import { VERTICALS } from './verticals/registry';
import { VerticalCard } from './verticals/vertical-card';

/**
 * `/customers` — the "is this for me?" page, and the hub for the industry
 * landing pages at /for/<industry>.
 *
 * ## What was wrong with the page this replaces
 *
 * It was titled "Who runs on sparx" and named exactly one business — a
 * flagship client write-up that took a third of the page. A customers page
 * whose customer list is one entry has a structural problem no restyling can
 * fix: it promises social proof and then does not have any. Removing that
 * section is not a subtraction, it is the correction; what a pre-launch
 * platform can honestly tell a visitor is *what it does for a business like
 * theirs and what it costs*, so that is what this page now does. There are no
 * logos, no invented quotes and no "trusted by" counts anywhere on it, and
 * there will not be until there are real ones to show.
 *
 * It also spent its middle on six cards that each wore a module-tinted `bg-soft`
 * wash — six competing washes, which is the exact pattern DESIGN.md calls out
 * (tint the one card that earns it, not all of them), and `soft` applied
 * everywhere drains the emphasis it exists to carry (RULE #3).
 *
 * ## What it is now
 *
 * A hub with a job: hand a visitor to the page written for their trade, or —
 * if their trade is not one of the six yet — show them the SHAPE of business
 * they are, which is the honest general answer. The six industry cards lead
 * with a real monthly price computed from that industry's stack, so the grid
 * says six different things instead of six versions of "a complete platform
 * for your business".
 */

/** The shapes a business takes, for a visitor whose trade is not one of the six
 *  yet. Each names the module that leads it, which is also what colors it —
 *  the hue identifies a function rather than decorating a card. */
const SHAPES: { module: MarketingModule; name: string; blurb: string; runs: string[] }[] = [
  {
    module: 'cms',
    name: 'You publish',
    blurb:
      'Words, pictures and an audience, with no cart anywhere in sight. Publish on your own domain, send the newsletter, and keep the list. Selling is a thing you can add later, not a thing you have to accept now.',
    runs: ['Builder', 'CMS', 'Email'],
  },
  {
    module: 'commerce',
    name: 'You sell things',
    blurb:
      'Products, a checkout that does not lose people, and one customer record that ties every order to the emails they opened and the question they asked. One system rather than four with a spreadsheet taped across the middle.',
    runs: ['Builder', 'Commerce', 'CRM', 'Email'],
  },
  {
    module: 'scheduling',
    name: 'You book time',
    blurb:
      'Your day is a calendar, not a catalog. Appointments, classes, tables, rooms or vans — booked by the customer, held with a deposit if you want one, and never double-booked.',
    runs: ['Builder', 'Scheduling', 'CRM'],
  },
  {
    module: 'b2b',
    name: 'You supply the trade',
    blurb:
      'Agreed prices per account, purchase orders, payment on terms and requests for quote — wholesale the way it actually works, built into the platform rather than sold as a five-figure upgrade.',
    runs: ['Commerce', 'B2B', 'CRM', 'Invoicing'],
  },
  {
    module: 'builder',
    name: 'You run several businesses',
    blurb:
      'More than one site, brand or client, each with its own name, look, domain and content — managed from one place and billed on one invoice, without a separate account per site.',
    runs: ['Builder', 'CMS', 'multiple sites'],
  },
  {
    module: 'ai',
    name: 'You want to build on it',
    blurb:
      'Everything is an interface first, so you can drive the whole platform from your own code — or point your own AI assistant at your live business data with a key you issue and can revoke.',
    runs: ['AI', 'the API', 'headless Builder'],
  },
];

/** The industries the blueprint catalog already covers beyond the six that have
 *  their own page. Mirrors marketplace-catalog/blueprints — each of these is a
 *  real, installable starting site, not a coming-soon. */
const MORE_INDUSTRIES = [
  'Schools & tutoring',
  'Clinics & wellness',
  'Hotels & short stays',
  'Accountants & law',
  'Publishers & newsletters',
  'Photography & design studios',
  'Music, theatre & ticketed events',
  'Florists, weddings & events',
  'Wine, beer & spirits',
  'Farming & landscaping',
  'Freight, trucking & equipment rental',
  'Consulting & B2B agencies',
  'Fabrication, carpentry & trade',
  'Artists, makers & portfolios',
];

const FAQ = [
  {
    id: 'customers-not-a-shop',
    question: 'I don’t sell anything. Is this still for me?',
    answer:
      'Yes, and it is not an afterthought. Selling is one capability out of thirteen, and plenty of businesses here never turn it on — a publisher runs the site, the writing and the newsletter; a consultant runs the site, the calendar and the invoices. You pay for the parts you switch on and nothing else, so a business that does not sell is never subsidising a checkout it does not use.',
  },
  {
    id: 'customers-not-listed',
    question: 'My trade isn’t one of the six. What then?',
    answer:
      'The six pages exist because those trades ask the most specific questions, not because the platform only fits them. The blueprint catalog already covers twenty industries with a complete starting site each, and the modules underneath are the same whatever you do — a calendar is a calendar whether it holds appointments, deliveries or fittings. If you tell us what you run, we will map it out with you.',
  },
  {
    id: 'customers-more-than-one',
    question: 'Can I run more than one business on one account?',
    answer:
      'Yes. One account can hold several sites, each with its own name, domain, look, content and customers — which is how agencies run client work and how one owner runs two unrelated shops. They stay properly separate from each other; only the bill is shared.',
  },
  {
    id: 'customers-outgrow',
    question: 'What if I start small and grow?',
    answer:
      'You switch modules on as you need them and the data you already have stays where it is. A salon that adds retail, a shop that starts supplying the trade, a publisher that starts selling a course — none of those are migrations, they are a switch. Nothing has to be rebuilt and nothing has to be exported and re-imported.',
  },
];

export function CustomersPage() {
  return (
    <main>
      {/* Hero */}
      <Band tone="dark" flush>
        <div className="flex flex-col gap-12">
          <div className="flex max-w-4xl flex-col gap-6">
            <Heading
              level={1}
              size="display"
              className="text-5xl leading-[0.98] tracking-tight sm:text-6xl"
            >
              Whatever it is you run
              <span className="text-primary">.</span>
            </Heading>
            <Text variant="lead" className="text-base-content max-w-3xl text-xl">
              A salon, a garage, a bakery, a bookstore, a magazine, a plumbing round. sparx is not a
              shop with extras bolted on — it is thirteen separate parts, and you switch on the ones
              your week actually needs. Here is what that looks like for a business like yours.
            </Text>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={signupHref('customers')}
                className={buttonClasses({ size: 'lg', color: 'primary', variant: 'solid' })}
              >
                Start free &rarr;
              </a>
              <a href="/pricing" className={buttonClasses({ size: 'lg', variant: 'outline' })}>
                See every price
              </a>
            </div>
          </div>

          {/* The four assumptions a small business arrives with, answered before
              anything else is claimed. */}
          <div className="border-base-300 grid grid-cols-2 gap-8 border-t pt-10 lg:grid-cols-4">
            {[
              { value: '12', label: 'Separate parts. Turn on what you need, ignore the rest.' },
              { value: '$0', label: 'Per person. Put the whole team on it at no extra cost.' },
              {
                value: '0%',
                label: 'Taken from what you sell. Your card fee is the only other cost.',
              },
              {
                value: 'Any month',
                label: 'Switch something off. There is no contract to escape.',
              },
            ].map((fact) => (
              <div key={fact.label} className="flex flex-col gap-2">
                <span className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                  {fact.value}
                </span>
                <Text className="text-md">{fact.label}</Text>
              </div>
            ))}
          </div>
        </div>
      </Band>

      {/* The six industries with their own page */}
      <Band tone="page">
        <div className="flex flex-col gap-12">
          <div className="flex max-w-3xl flex-col gap-5">
            <Heading level={2} size="display" className="text-5xl tracking-tight sm:text-6xl">
              Written for your trade
              <span className="text-primary">.</span>
            </Heading>
            <Text variant="lead" className="text-xl">
              Six pages, each one about a single kind of business — what it needs done, what that
              adds up to every month, and what the same tools cost bought separately. No jargon and
              no starting-from figures.
            </Text>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {VERTICALS.map((vertical) => (
              <VerticalCard key={vertical.slug} vertical={vertical} />
            ))}
          </div>
        </div>
      </Band>

      {/* The general answer, for a trade that has no page yet */}
      <Band tone="surface">
        <div className="flex flex-col gap-12">
          <div className="flex max-w-3xl flex-col gap-5">
            <Heading level={2} size="display" className="text-5xl tracking-tight sm:text-6xl">
              However you operate
              <span className="text-primary">.</span>
            </Heading>
            <Text variant="lead" className="text-xl">
              Underneath the trade names, most businesses are one of a handful of shapes. Find yours
              and you can see which parts you would switch on, whatever it is you happen to sell,
              publish or book.
            </Text>
          </div>

          <div className="columns-1 gap-5 lg:columns-2">
            {SHAPES.map((shape) => (
              <Card
                key={shape.name}
                className="border-base-300 bg-base-200 mb-5 w-full break-inside-avoid border shadow-none"
              >
                <CardBody className="flex flex-col items-start gap-4">
                  <Heading level={3} size={3} className="tracking-tight">
                    {shape.name}
                  </Heading>
                  <Text className="text-lg">{shape.blurb}</Text>
                  <div className="flex flex-wrap gap-2">
                    {shape.runs.map((run) => {
                      // A run entry is either a module (badge it in that
                      // module's own hue) or a plain phrase like "the API",
                      // which stays neutral — an untyped value, which is what
                      // RULE #4 reserves neutral for.
                      const entry = MODULES.find((m) => m.label === run);
                      return (
                        <Badge
                          key={run}
                          color={entry ? `module-${entry.id}` : undefined}
                          variant={entry ? 'solid' : 'outline'}
                          size="md"
                        >
                          {run}
                        </Badge>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </Band>

      <Faq
        id="faq"
        items={FAQ}
        heading={
          <>
            Before you decide
            <span className="text-primary">.</span>
          </>
        }
        lede="The four things people ask when they are working out whether a platform built for everyone is built for them."
      />

      {/* Beyond the six. `surface`, and it sits AFTER the FAQ deliberately —
          the FAQ is a shared section whose tone is fixed at `page`, so the bands
          either side of it must not be, and "not one of the six? here are twenty
          more" is the right last thing to say before the close. It was a
          `neutral` band: painted tones are not theme scopes, so the outline
          badges in here inked themselves from the LIGHT theme's near-black and
          landed on dark navy at 1.29:1. See the BandTone doc in ../band. */}
      <Band tone="surface">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div className="flex flex-col gap-6">
            <Heading level={2} size="display" className="text-5xl tracking-tight sm:text-6xl">
              Twenty more, already built
            </Heading>
            <Text variant="lead" className="max-w-2xl text-xl">
              A blueprint is a finished site for a particular kind of business — the pages, a
              starter catalog, a few articles, a welcome email sequence and a matching look — and
              installing one takes a click. These do not have a page of their own yet; they have
              something better, which is a working site waiting for your words.
            </Text>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/market/blueprints"
                className={buttonClasses({ size: 'lg', color: 'primary', variant: 'solid' })}
              >
                Browse the blueprints
              </a>
              <a href={SALES_HREF} className={buttonClasses({ size: 'lg', variant: 'outline' })}>
                Tell us what you run
              </a>
            </div>
          </div>

          <ul className="flex flex-wrap content-start gap-2 lg:pt-2">
            {MORE_INDUSTRIES.map((industry) => (
              <li key={industry}>
                <Badge variant="outline" size="lg">
                  {industry}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </Band>

      {/* Close */}
      <Band tone="dark">
        <div className="flex max-w-3xl flex-col gap-6">
          <Heading level={2} size="display" className="text-5xl tracking-tight sm:text-6xl">
            Yours goes here
            <span className="text-primary">.</span>
          </Heading>
          <Text variant="lead" className="text-xl">
            Open an account and try it on the business you actually run. Nothing is charged until
            you decide to keep it, no card is needed to find out, and if what you do does not fit
            any of the shapes above, that is the interesting conversation — tell us about it.
          </Text>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={signupHref('customers-final')}
              className={buttonClasses({ size: 'lg', color: 'primary', variant: 'solid' })}
            >
              Start free &rarr;
            </a>
            <a href="/contact" className={buttonClasses({ size: 'lg', variant: 'outline' })}>
              Talk to a person
            </a>
          </div>
        </div>
      </Band>
    </main>
  );
}
