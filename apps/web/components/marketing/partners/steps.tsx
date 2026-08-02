import { Heading, Text } from '@wizeworks/silicaui-react';
import { Band } from '../band';

/**
 * How it works — four steps.
 *
 * Structurally the same beat as before, rebuilt without the bespoke
 * `.mkt-steprail` grid (four columns, absolutely-positioned "→" connectors that
 * had to be hidden per-breakpoint with `:nth-child(2n)` rules) and without the
 * 2px Ember rule that sat above each step title. That rule was a decorative
 * divider standing in for the `01/02/03` numerals someone had already removed as
 * eyebrows — the same slot, wearing a border instead of a numeral (RULE #2 bans
 * the SLOT). The arrows went with it: a left-to-right grid already reads as a
 * sequence, and the connectors existed mainly to justify the custom CSS.
 */

const STEPS: { t: string; d: string }[] = [
  {
    t: 'Apply',
    d: 'Tell us who you are and how you work with clients. Informal needs no review at all; the other two take about three days.',
  },
  {
    t: 'Set up',
    d: 'You get a partner dashboard with your referral link, every client account in one login, and the decks and proposal templates to pitch with.',
  },
  {
    t: 'Refer',
    d: 'Bring a client over on your link. It is credited to you for 30 days, and your rate is locked in at that moment — a later rate change never rewrites your history.',
  },
  {
    t: 'Get paid',
    d: 'Commission clears once the client’s first payment does. Payouts run monthly to your own Stripe account, once you are over $50.',
  },
];

export function PartnersSteps() {
  return (
    <Band tone="page">
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <Heading level={2} size="display" className="text-5xl tracking-tight sm:text-6xl">
            Application to first payout
            <span className="text-primary">.</span>
          </Heading>
          <Text variant="lead" className="max-w-3xl">
            Four steps, and none of them is a sales call. There is no onboarding programme to sit
            through and nobody decides whether you are allowed to sell.
          </Text>
        </div>

        <div className="grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.t} className="flex flex-col gap-2.5">
              <Heading level={3} size={4} className="tracking-tight">
                {s.t}
              </Heading>
              <Text className="text-lg">{s.d}</Text>
            </div>
          ))}
        </div>
      </div>
    </Band>
  );
}
