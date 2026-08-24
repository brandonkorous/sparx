import { Section } from '@piggles/ui';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { accountUrl } from '@piggles/config';
import { PRICE_LABEL } from '@piggles/config/pricing';

// ── 6 · PRICE ────────────────────────────────────────────────────────────────
const INCLUDED = [
  'All fifteen apps, from the first day',
  'Your website, and a Piggles address for it',
  'Three people on your team',
  'Your own customer records, products and orders',
  'Everything exportable, always',
];

/** A tick. Inline rather than an icon import so it inherits `currentColor` and
 *  is correct on any surface without being told which one. */
function Tick() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="mt-1 size-4 shrink-0">
      <path
        d="m4 12.6 5 5L20 6.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PriceCard() {
  return (
    <Card className="settle">
      <CardBody>
        <p className="text-6xl font-extrabold">
          {PRICE_LABEL}
          <span className="text-xl font-bold">/month</span>
        </p>
        <p className="mt-1 text-base font-semibold">One plan. That is the whole price list.</p>

        <ul className="mt-6 space-y-3">
          {INCLUDED.map((line) => (
            <li key={line} className="flex gap-3 text-base">
              {/* Color on the marker, weight on the sentence. Coloring the
                      whole row would make five equal facts look like five links. */}
              <span className="text-primary">
                <Tick />
              </span>
              {line}
            </li>
          ))}
        </ul>

        {/* RULE #2, standing next to the number it qualifies. This was a
                paragraph in the left column, where it argued with a heading; the
                only place it is actually read is beside the price, and it is the
                one sentence on this page a competitor cannot copy without
                restructuring their business. */}
        <p className="mt-6 text-base">
          Your bill changes when the <em>business</em> needs more room — more people, more storage,
          more email going out. Never because you switched Bookings on.
        </p>

        <a
          className={`${buttonClasses({ color: 'primary', size: 'xl', block: true })} mt-8`}
          href={accountUrl('signup', 'home-pricing')}
        >
          Start free for 14 days
        </a>
        <p className="mt-3 text-center text-base">No card needed to start.</p>
      </CardBody>
    </Card>
  );
}

export function Pricing() {
  return (
    <Section variant="panel" className="bg-accent text-accent-content shadow">
      <div id="price" className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className="rise">
          <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
            How much is your time worth?
          </h2>
          <p className="mt-6 max-w-[46ch] text-xl font-semibold">
            Then why is so much of it spent joining up your own information &mdash; checking one app
            against another to work out what your business actually did this week?
          </p>
          <p className="mt-5 max-w-[46ch] text-lg">
            Piggles does the joining up. What that hour is worth is yours to decide, and yours to
            spend on something else.
          </p>
        </div>

        <PriceCard />
      </div>
    </Section>
  );
}
