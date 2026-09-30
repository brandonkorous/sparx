import Link from 'next/link';
import { Section } from '@piggles/ui';
import { PigglesMascot } from '@piggles/mascot/react';
import { TRADES, type TradePage } from '@/content/trades';

// Three trades that lean on the most of the same apps. A reader whose business
// is "a bit like a salon" finds the nearest page instead of the back button.

function nearest(trade: TradePage): TradePage[] {
  return TRADES.filter((t) => t.slug !== trade.slug)
    .map((t) => ({ t, shared: t.leans.filter((a) => trade.leans.includes(a)).length }))
    .sort((a, b) => b.shared - a.shared)
    .slice(0, 3)
    .map(({ t }) => t);
}

export function TradeRelated({ trade }: { trade: TradePage }) {
  return (
    <Section>
      <h2 className="text-3xl font-extrabold sm:text-4xl">Businesses a lot like yours</h2>
      <ul className="mt-10 grid gap-4 sm:grid-cols-3">
        {nearest(trade).map((t) => (
          <li
            key={t.slug}
            data-group={t.group}
            className="bg-base-100 border-base-300 rounded-section flex flex-col items-center gap-4 border p-6 text-center"
          >
            <PigglesMascot pose={t.pose} size="sm" />
            <Link href={`/for/${t.slug}`} className="ink-module text-xl font-bold">
              Piggles for {t.plural.toLowerCase()}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
