import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@piggles/ui';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { accountUrl, APP_COUNT_WORD } from '@piggles/config';
import { PRICE_LABEL } from '@piggles/config/pricing';
import { CHECKED_ON, COMPARISONS } from '@/content/compare';
import { PageHero } from '@/components/marketing/page-hero';
import { CloseBand } from '@/components/marketing/close-band';
import { dayWords } from '@/components/marketing/date-words';
import { HeroPanel, HeroPanelBar, HeroRow, HeroRows } from '@/components/marketing/hero/panel';

// /compare: every named comparison, each with the one line that decides it.

export const metadata: Metadata = {
  title: 'Piggles compared: Square, Shopify, Wix, Squarespace, HubSpot and Zoho One',
  description:
    'Honest comparisons of Piggles with Square, Shopify, Wix, Squarespace, HubSpot and Zoho One: where each one is the better choice, every feature side by side, and how each bill is put together.',
  alternates: { canonical: '/compare' },
};

function IndexFigure() {
  return (
    <HeroPanel>
      <HeroPanelBar app="home" title="What each one is built around" />
      <HeroRows>
        {COMPARISONS.map((c) => (
          <HeroRow key={c.slug} label={c.name} sub={c.isA} />
        ))}
      </HeroRows>
    </HeroPanel>
  );
}

export default function CompareIndex() {
  return (
    <>
      <PageHero
        heading="Piggles, compared honestly."
        lede={`Six names small businesses ask us about, side by side with Piggles. Each page starts with where the other one is the better choice, because sometimes it is. Every fact about them was read from their own website on ${dayWords(CHECKED_ON)}.`}
        figure={<IndexFigure />}
        assurances={['No competitor prices', 'Their strengths first', 'Sources on every page']}
      >
        <a
          className={buttonClasses({ color: 'primary', size: 'lg' })}
          href={accountUrl('signup', 'compare')}
        >
          Start free for 14 days
        </a>
      </PageHero>

      <Section>
        <h2 className="text-3xl font-extrabold sm:text-4xl">Pick the one you are weighing up</h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMPARISONS.map((c) => (
            <li
              key={c.slug}
              className="bg-base-100 border-base-300 rounded-section flex flex-col border p-6"
            >
              <h3 className="text-2xl font-bold">Piggles or {c.name}</h3>
              <p className="mt-3 text-base">{c.turn}</p>
              <Link
                href={`/compare/${c.slug}`}
                className="mt-auto pt-5 text-base font-bold underline underline-offset-4"
              >
                Read the comparison
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section variant="panel" className="bg-base-100 shadow">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <h2 className="text-3xl font-extrabold sm:text-4xl">How these pages are written</h2>
          <ul className="list-disc space-y-3 pl-5 text-lg">
            <li>Where the other product is better, the page says so first.</li>
            <li>
              Their prices are not shown. They are theirs to publish, and they change without
              telling us.
            </li>
            <li>
              A feature we could not confirm on their own website is marked “Not confirmed”, never
              “No”.
            </li>
            <li>Every page lists the pages its facts were read from, and the date.</li>
            <li>
              What Piggles does not do is in the same table, in the same words: no card reader, no
              text messages, no payroll and no accounting.
            </li>
          </ul>
        </div>
      </Section>

      <CloseBand
        heading={`All ${APP_COUNT_WORD} apps, ${PRICE_LABEL} a month, fourteen days free.`}
        primary={{ label: 'Start free for 14 days', href: accountUrl('signup', 'compare-close') }}
        secondary={{ label: 'See what it costs', href: '/pricing' }}
      />
    </>
  );
}
