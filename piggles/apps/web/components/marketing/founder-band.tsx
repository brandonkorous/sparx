import { Progress } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { accountUrl } from '@piggles/config';
import { founderOpen, PRICE_LABEL, type FounderOffer } from '@piggles/config/pricing';
import { Section } from '@piggles/ui';

// The founding offer, with the live count. Two versions: places left, and all
// taken. Nothing at all when the count cannot be read: an unread number is never shown.

function OpenOffer({ offer, from }: { offer: FounderOffer; from: string }) {
  const taken = offer.limit - offer.remaining;
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:items-center lg:gap-16">
      <div>
        <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          The first {offer.limit} businesses pay ${offer.monthly} a month. For good.
        </h2>
        <p className="mt-6 max-w-[58ch] text-lg">
          Not for a year, and not as an introductory rate. Add a card and you pay ${offer.monthly}{' '}
          instead of {PRICE_LABEL} every month for as long as you stay subscribed. There is no code
          to type and nothing to apply for: the price is taken off when you add your card.
        </p>
        <div className="mt-8">
          <a
            className={buttonClasses({ color: 'primary', size: 'lg' })}
            href={accountUrl('signup', `${from}-founding`)}
          >
            Start free for 14 days
          </a>
        </div>
      </div>
      <div>
        <p className="text-6xl font-extrabold">{offer.remaining}</p>
        <p className="mt-1 text-xl font-bold">of {offer.limit} founding places left</p>
        <Progress
          className="mt-5"
          color="primary"
          size="lg"
          value={taken}
          max={offer.limit}
          aria-label={`${String(taken)} of ${String(offer.limit)} founding places taken`}
        />
      </div>
    </div>
  );
}

function ClosedOffer({ offer }: { offer: FounderOffer }) {
  return (
    <div className="max-w-[62ch]">
      <h2 className="text-3xl font-extrabold sm:text-4xl">
        All {offer.limit} founding places are taken.
      </h2>
      <p className="mt-6 text-lg">
        Thank you to the businesses that took them. They keep their price for as long as they stay.
        Piggles is {PRICE_LABEL} a month, with every app included.
      </p>
    </div>
  );
}

/** `from` names the page, so a signup from here is credited to it. */
export function FounderBand({ offer, from }: { offer: FounderOffer | null; from: string }) {
  if (!offer) return null;
  return (
    <Section id="founding" variant="panel" className="bg-accent bg-soft">
      {founderOpen(offer) ? <OpenOffer offer={offer} from={from} /> : <ClosedOffer offer={offer} />}
    </Section>
  );
}
