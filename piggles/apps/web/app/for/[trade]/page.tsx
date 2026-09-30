import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { FaqSection } from '@piggles/ui';
import { accountUrl, APP_COUNT_WORD, PRODUCT } from '@piggles/config';
import { PRICE_LABEL } from '@piggles/config/pricing';
import { TRADE_BY_SLUG, TRADES } from '@/content/trades';
import { PageHero } from '@/components/marketing/page-hero';
import { CloseBand } from '@/components/marketing/close-band';
import { TradeProblems } from '@/components/marketing/trade/trade-problems';
import { TradeWeek } from '@/components/marketing/trade/trade-week';
import { TradeFirstHour } from '@/components/marketing/trade/trade-first-hour';
import { TradeJsonLd } from '@/components/marketing/trade/trade-jsonld';
import { TradeFigure } from '@/components/marketing/trade/trade-figure';
import { TradeReplaces } from '@/components/marketing/trade/trade-replaces';
import { TradeInDepth } from '@/components/marketing/trade/trade-in-depth';
import { TradeCost } from '@/components/marketing/trade/trade-cost';
import { TradeRelated } from '@/components/marketing/trade/trade-related';

// /for/<trade>: one kind of business, told in order. The problem and the turn,
// what it replaces, a week on Piggles, the apps up close, moving over, the
// price, the questions asked before buying, and the nearest other trades.

export function generateStaticParams() {
  return TRADES.map((t) => ({ trade: t.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ trade: string }>;
}): Promise<Metadata> {
  const { trade: slug } = await params;
  const trade = TRADE_BY_SLUG[slug];
  if (!trade) return {};
  return {
    title: `${PRODUCT.name} for ${trade.plural.toLowerCase()}`,
    description: trade.lede,
    keywords: trade.searchTerms,
    alternates: { canonical: `/for/${trade.slug}` },
  };
}

export default async function TradePageRoute({ params }: { params: Promise<{ trade: string }> }) {
  const { trade: slug } = await params;
  const trade = TRADE_BY_SLUG[slug];
  if (!trade) notFound();

  return (
    <div data-group={trade.group}>
      <TradeJsonLd trade={trade} />
      <PageHero
        heading={trade.heading}
        lede={trade.lede}
        figure={<TradeFigure trade={trade} />}
        assurances={['Free for 14 days', 'No card needed', `All ${APP_COUNT_WORD} apps included`]}
      >
        <a
          className={buttonClasses({ color: 'primary', size: 'lg' })}
          href={accountUrl('signup', `for-${trade.slug}`)}
        >
          Start free for 14 days
        </a>
        <Link className={buttonClasses({ variant: 'outline', size: 'lg' })} href="/who-its-for">
          Other kinds of business
        </Link>
      </PageHero>

      <TradeProblems problems={trade.problems} turn={trade.turn} />
      <TradeReplaces plural={trade.plural} tools={trade.replaces} />
      <TradeWeek plural={trade.plural} week={trade.week} />
      <TradeInDepth plural={trade.plural} details={trade.inDepth} />
      <TradeFirstHour switching={trade.switching} steps={trade.firstHour} />
      <TradeCost slug={trade.slug} cost={trade.cost} />
      <FaqSection
        heading={`What ${trade.plural.toLowerCase()} ask before they start`}
        items={trade.questions}
      />
      <TradeRelated trade={trade} />

      <CloseBand
        heading={`Everything ${trade.plural.toLowerCase()} need, for ${PRICE_LABEL} a month.`}
        primary={{
          label: 'Start free for 14 days',
          href: accountUrl('signup', `for-${slug}-close`),
        }}
        secondary={{ label: 'See what it costs', href: '/pricing' }}
        mascot={trade.pose}
      />
    </div>
  );
}
