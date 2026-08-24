import Link from 'next/link';
import { Section } from '@piggles/ui';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { TRADES, TradeLane } from './trade-wall';

/** Sticky, and completely still. The argument has to stay readable while the
 *  variety moves past it; a wall that carried the words too would be a
 *  carousel, and nobody reads a carousel. */
function TheArgument() {
  return (
    <div className="rise lg:sticky lg:top-24">
      <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
        Whatever kind of business you have.
      </h2>
      {/* Three sentences became one, and the one that survived is about the
              READER. The draft said "not a shop product with bookings bolted on,
              not a booking product that also does invoices" — a true sentence
              whose subject is our software. What the reader is living with is
              that every tool they have looked at was built for somebody else's
              trade and they have been settling. Say that instead.

              The rest of the old paragraph — what is actually different about
              running a bakery versus a barber — is /who-its-for, which exists
              because this section made that promise and then offered nowhere to
              take it. */}
      <p className="mt-5 text-lg">
        Piggles is built for the kind of business you actually run, not to make you run the kind of
        business we imagined. A bakery, a barber, a potter, a garage — whatever you do, it&rsquo;s
        already in the product.
      </p>
      {/* Three words, and the label is the reason this page stopped rocking
          sideways on a phone. `.btn` computes `white-space: nowrap`, so a label
          cannot wrap and its full width becomes the floor under whatever column
          holds it — "What is different about yours" put that floor at 288px in
          a 265px column, and the trade wall bleeds its padding from that
          column's edge. A button is a door, not a sentence: the paragraph above
          already says what is behind it. */}
      <Link
        className={`${buttonClasses({ color: 'secondary', size: 'lg' })} mt-7`}
        href="/who-its-for"
      >
        Find your trade
      </Link>
    </div>
  );
}

export function Whatever() {
  const half = Math.ceil(TRADES.length / 2);
  return (
    <Section variant="panel" id="Whatever">
      <div className="grid gap-8 lg:grid-cols-[1fr_34%] lg:items-start lg:gap-14">
        {/* Below `lg` this is a horizontal snap row — the motion axis the
            page itself is not using. From `lg` it becomes the two-lane wall,
            and globals.css takes over. `-mx-*` lets the row bleed the section's
            padding on a phone so a card is visibly cut at the edge rather than
            stopping short of it, which is what says there are more. */}
        <div className="trade-wall -mx-6 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-6 pb-2 sm:-mx-10 sm:px-10 lg:mx-0 lg:grid lg:h-[78vh] lg:max-h-[46rem] lg:min-h-[34rem] lg:grid-cols-2 lg:overflow-hidden lg:px-0 lg:pb-0">
          <TradeLane trades={TRADES.slice(0, half)} />
          <TradeLane trades={TRADES.slice(half)} down />
        </div>
        <TheArgument />
      </div>
    </Section>
  );
}
