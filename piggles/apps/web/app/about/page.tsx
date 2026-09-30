import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@piggles/ui';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { accountUrl, APP_COUNT_WORD, PRODUCT } from '@piggles/config';
import { PRICE_LABEL } from '@piggles/config/pricing';
import { PageHero } from '@/components/marketing/page-hero';
import { CloseBand } from '@/components/marketing/close-band';
import { HeroPanel, HeroPanelBar, HeroRow, HeroRows } from '@/components/marketing/hero/panel';

// /about: who makes Piggles and why it is shaped the way it is.
//
// Only facts that are true today. WizeWorks LLC, Visalia, California,
// incorporated 2026 (the same facts /terms states). The beliefs are the product
// principles in piggles/docs/initial/docs/product/PRODUCT_PRINCIPLES.md, each
// told with the thing in the product that keeps it. No team photo, no customer
// count, no invented milestone (piggles/DESIGN.md §10).

export const metadata: Metadata = {
  title: 'About Piggles',
  description:
    'Why Piggles exists, what it believes about small-business software, and who makes it: WizeWorks LLC, in Visalia, California.',
  alternates: { canonical: '/about' },
};

const BELIEFS = [
  {
    title: 'Simple does not mean basic',
    body: 'A florist and a parts supplier both deserve real stock control, real invoices and real bookings. Piggles makes them easy to use without cutting them down.',
    kept: 'Stock counts per location, quotes that become invoices, and staff calendars are in the box.',
  },
  {
    title: 'You think in jobs, not software categories',
    body: 'Nobody wakes up wanting a “CRM”. They want to know who has not paid. The apps are named for the work, and the words on the screen are the ones you would use.',
    kept: 'The apps are called Customers, Bookings, Money and My Team.',
  },
  {
    title: 'Turning on an app should never cost more',
    body: 'Most software charges you for understanding more of it. We charge for room, not for features.',
    kept: `One price, ${PRICE_LABEL} a month, with all ${APP_COUNT_WORD} apps included.`,
  },
  {
    title: 'Defaults you can change',
    body: 'Piggles arrives set up from two questions, and every choice it made for you can be changed later without starting over.',
    kept: 'Apps you did not pick are out of your way, not out of your reach.',
  },
  {
    title: 'Serious work deserves serious behavior',
    body: 'The mascot is friendly. The software is careful: it shows you what will happen before it writes anything, and it asks before it deletes.',
    kept: 'Moving in previews every row before a single one is saved.',
  },
  {
    title: 'Your business is yours',
    body: 'Your data is kept apart from every other business, it is never used to train AI, and you can take it with you whenever you like.',
    kept: 'Every main list has an Export button, and there is no charge to leave.',
  },
];

const HONEST = [
  'We do not show a customer count, logos or reviews, because we will not invent them. When real customers want to be named, they will be.',
  'We do not claim certifications or uptime figures we have not earned or measured.',
  'Where another product is the better choice for you, our comparison pages say so first.',
  'What Piggles does not do is written down: no card reader, no text messages, no payroll and no full accounting.',
];

function AboutFigure() {
  return (
    <HeroPanel>
      <HeroPanelBar app="home" title="Piggles, in short" />
      <HeroRows>
        <HeroRow label="Made by" sub="WizeWorks LLC" />
        <HeroRow label="Based in" sub="Visalia, California" />
        <HeroRow label="Built for" sub="Owners and small teams" />
        <HeroRow label="Apps" sub={`All ${APP_COUNT_WORD}, in one price`} />
        <HeroRow label="Price" sub={`${PRICE_LABEL} a month, 14 days free`} />
      </HeroRows>
    </HeroPanel>
  );
}

export default function About() {
  return (
    <>
      <PageHero
        heading="Software for people who have a business to run."
        lede={`${PRODUCT.name} exists because a small business should not need ten subscriptions, ten logins and a weekend of copying between them to know how it is doing. It is one place for the website, the selling, the customers, the money and the team, made by WizeWorks in Visalia, California.`}
        figure={<AboutFigure />}
      >
        <a
          className={buttonClasses({ color: 'primary', size: 'lg' })}
          href={accountUrl('contact', 'about')}
        >
          Talk to a person
        </a>
        <Link className={buttonClasses({ variant: 'outline', size: 'lg' })} href="/how-it-works">
          How it works
        </Link>
      </PageHero>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Why Piggles exists</h2>
          <div className="space-y-5 text-lg">
            <p>
              Watch a small business owner at the end of a week. The bookings are in one app, the
              invoices in another, the stock in a spreadsheet, the customers in an email inbox and
              the website somewhere else again. Each one sends its own bill. None of them knows
              about the others, so the owner becomes the thing that joins them up.
            </p>
            <p>
              The usual answer is a bigger suite: more apps, more tiers, more to set up. That works
              for a company with an office manager. It does not work for a salon owner between
              clients or a baker at five in the morning.
            </p>
            <p>
              Piggles takes the other route. The apps are few enough to learn and share one
              customer, one catalog and one set of numbers, so a sale on the website is already in
              Stock, Customers and Money. There is one plan, so there is nothing to upgrade to.
            </p>
          </div>
        </div>
      </Section>

      <Section variant="panel" className="bg-primary text-primary-content">
        <p className="max-w-[30ch] text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          We charge for room, never for understanding more of the product.
        </p>
      </Section>

      <Section>
        <h2 className="text-3xl font-extrabold sm:text-4xl">
          What we believe, and how you can tell
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BELIEFS.map((b) => (
            <Card key={b.title}>
              <CardBody>
                <h3 className="text-xl font-bold">{b.title}</h3>
                <p className="mt-2 text-base">{b.body}</p>
                <p className="mt-3 text-base font-semibold">{b.kept}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </Section>

      <Section variant="panel" className="bg-base-100 shadow">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-3xl font-extrabold sm:text-4xl">What you will not find here</h2>
            <p className="mt-5 text-lg">
              Most software websites carry the same furniture. Some of it we have not earned yet, so
              it is not here.
            </p>
          </div>
          <ul className="list-disc space-y-3 pl-5 text-lg">
            {HONEST.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-3xl font-extrabold sm:text-4xl">Who makes it</h2>
            <p className="mt-5 text-lg">
              Piggles is made by WizeWorks LLC, a software company in Visalia, California, founded
              in 2026. WizeWorks runs the service, keeps your data and answers when you write. The
              agreement you make when you sign up is with WizeWorks.
            </p>
          </div>
          <ul className="grid content-start gap-3 text-lg">
            <li>
              <Link href="/trust" className="font-bold underline underline-offset-4">
                How your data is kept safe
              </Link>
            </li>
            <li>
              <Link href="/terms" className="font-bold underline underline-offset-4">
                The terms of service
              </Link>
            </li>
            <li>
              <Link href="/status" className="font-bold underline underline-offset-4">
                Whether Piggles is working right now
              </Link>
            </li>
            <li>
              <Link href="/whats-new" className="font-bold underline underline-offset-4">
                What has changed recently
              </Link>
            </li>
            <li>
              <a
                href={accountUrl('contact', 'about-list')}
                className="font-bold underline underline-offset-4"
              >
                Write to a person
              </a>
            </li>
          </ul>
        </div>
      </Section>

      <CloseBand
        heading="See if it fits your business. It costs nothing to find out."
        primary={{ label: 'Start free for 14 days', href: accountUrl('signup', 'about-close') }}
        secondary={{ label: 'See what it costs', href: '/pricing' }}
      />
    </>
  );
}
