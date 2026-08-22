import Link from 'next/link';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Section } from '@piggles/ui';
import { PRICE_LABEL } from '@piggles/config/pricing';

// Ten bills against one, said spatially: a crowded column beside a single calm
// panel. The argument IS the asymmetry, so the layout has to carry it.
//
// An earlier draft made this a two-up table of small rows — name, our app icon,
// "included" — and it read as a spec sheet: short text in wide cells, half of
// each column empty, and a Piggles glyph sitting beside a competitor's name
// asking to be decoded. The names are now the only thing in the left column, at
// a size that makes ten of them feel like ten.
//
// Named on Brandon's instruction, against the standing rule on competitor names.
// Every one is a like-for-like capability Piggles ships today, and no price but
// ours appears: DESIGN.md §10, and theirs change weekly.
const REPLACED = [
  'Squarespace',
  'WordPress',
  'Semrush',
  'Shopify',
  'HubSpot',
  'Mailchimp',
  'Calendly',
  'FreshBooks',
  'QuickBooks',
  'A stock spreadsheet',
];

export function InsteadOf() {
  return (
    <Section variant="panel" className="bg-base-100 shadow">
      <div className="rise max-w-[62ch]">
        <h2 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          Cancel all ten. Keep everything they did.
        </h2>
        <p className="mt-6 text-lg">
          Ten subscriptions, ten renewal dates, ten logins, ten bills, and not one of them talks to
          the others.
        </p>
      </div>

      <div className="mt-10 grid gap-3.5 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
        {/* Two columns of five, not one of ten. Shrunk so the names recede —
              they are the setup, and the price is the thing that should be
              carrying the section — and paired up so the block still fills its
              side instead of becoming a narrow strip beside a wide panel. */}
        <ul className="stagger grid gap-x-8 gap-y-1 self-center sm:grid-cols-2">
          {REPLACED.map((was) => (
            <li key={was}>
              {/* A real <s>, not a line drawn in CSS: "no longer accurate" is
                    the meaning, and it reaches a screen reader that way too. */}
              <s className="font-heading block text-2xl leading-tight font-normal sm:text-3xl">
                {was}
              </s>
            </li>
          ))}
        </ul>

        {/* The one calm object, against ten of theirs. Navy rather than the
              brand pink: the section above this one is a full pink band.

              A theme ISLAND, not `bg-secondary` — that token is dark only in the
              light theme (#d7dbe3 in dark), so with a theme toggle on the site
              this panel turned pale under a 9xl pink price. */}
        <div
          data-theme="dark"
          className="bg-base-200 rounded-box flex flex-col justify-center p-8 text-center sm:p-10"
        >
          <p className="text-xl font-bold sm:text-2xl">All of it, replaced, for</p>
          <p className="font-heading text-primary text-8xl leading-none font-black lg:text-9xl">
            {PRICE_LABEL}
          </p>
          <p className="mt-3 text-xl font-bold sm:text-2xl">a month</p>

          <p className="mt-7 text-lg">
            One bill. One login. One renewal date. Ten of the fifteen apps you already have, doing
            what that lot used to.
          </p>

          <Link
            className={`${buttonClasses({ color: 'primary', size: 'xl' })} mt-8 self-center`}
            href="/pricing"
          >
            What is in the {PRICE_LABEL}
          </Link>
        </div>
      </div>
    </Section>
  );
}
