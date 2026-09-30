import type { Metadata } from 'next';
import { Section } from '@piggles/ui';
import Link from 'next/link';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { accountUrl, APP_BY_ID, APP_COUNT, APP_COUNT_WORD, numberWord } from '@piggles/config';
import { PRICE_LABEL } from '@piggles/config/pricing';
import { PigglesMascot } from '@piggles/mascot/react';
import { PageHero } from '@/components/marketing/page-hero';
import { TradesFigure } from '@/components/marketing/hero/trades-figure';
import { CloseBand } from '@/components/marketing/close-band';
import { TRADES, type TradePage } from '@/content/trades';

// /who-its-for — the eleven trades side by side. Each card links to its own
// /for/<trade> page, where the week is told in full.

export const metadata: Metadata = {
  title: 'Who Piggles is for',
  description: `A bakery, a barber, a potter, a garage, a market stall: what is different about running each of them, and which of the ${APP_COUNT_WORD} apps that shape leans on.`,
};

function TradeCard({ trade }: { trade: TradePage }) {
  return (
    <li
      data-group={trade.group}
      className="bg-base-100 border-base-300 rounded-section flex flex-col gap-5 border p-6 sm:p-8"
    >
      {/* `md`: each card is read on its own here, unlike the home page's wall. */}
      <PigglesMascot pose={trade.pose} size="md" className="self-center" />

      <div>
        <h2 className="ink-module font-heading text-2xl font-black">
          <Link href={`/for/${trade.slug}`}>{trade.name}</Link>
        </h2>
        <p className="mt-2.5 text-base">{trade.shape}</p>
        <Link
          href={`/for/${trade.slug}`}
          className="ink-module mt-3 inline-block text-base font-bold underline underline-offset-4"
        >
          A week for {trade.plural.toLowerCase()}, on Piggles
        </Link>
      </div>

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
        . The other {numberWord(APP_COUNT - trade.leans.length)} are there too.
      </p>
    </li>
  );
}

export default function WhoItsForPage() {
  return (
    <>
      <PageHero
        heading="A bakery, a barber, a potter, and the person who makes things in a shed."
        lede="Every tool you have looked at was built for somebody else's trade, and you have been settling. Here is what is genuinely different about eleven kinds of business, and how little of it the software needs to care about."
        figure={<TradesFigure />}
        assurances={['Free for 14 days', 'No card needed']}
      >
        <a
          className={buttonClasses({ color: 'primary', size: 'lg' })}
          href={accountUrl('signup', 'who-its-for')}
        >
          Start free for 14 days
        </a>
        <Link className={buttonClasses({ variant: 'outline', size: 'lg' })} href="/apps">
          See all {APP_COUNT_WORD} apps
        </Link>
      </PageHero>

      <Section>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRADES.map((trade) => (
            <TradeCard key={trade.slug} trade={trade} />
          ))}
        </ul>
      </Section>

      {/* The turn: eleven shapes, then the thing they share. */}
      <Section className="bg-base-100 border-base-300 border-y">
        <h2 className="max-w-[24ch] text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          None of them needed a different Piggles.
        </h2>
        <p className="mt-6 max-w-[62ch] text-lg">
          A barber sells time and a bakery sells bread, and underneath they are the same four
          things: someone to remember, something to sell, a bill to send, and a website that says
          you exist. If your trade is not on this page, it is not missing. It is one of these eleven
          with a different word on the door.
        </p>
        <Link className={`${buttonClasses({ color: 'secondary', size: 'lg' })} mt-8`} href="/apps">
          See what you would actually get
        </Link>
      </Section>

      <CloseBand
        heading={`Whatever is on your door, it is ${PRICE_LABEL} a month.`}
        primary={{ label: 'Start free for 14 days', href: accountUrl('signup', 'who-close') }}
        secondary={{ label: 'See what it costs', href: '/pricing' }}
      />
    </>
  );
}
