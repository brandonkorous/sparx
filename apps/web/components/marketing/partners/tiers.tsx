import { Heading, Text } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Band } from '../band';

/**
 * The three partner tiers.
 *
 * This replaces a 6-row × 3-column comparison matrix rendered at 14px with an
 * em-dash for every absent feature and `text-primary` for every present one. A
 * matrix is the right shape when a reader is auditing feature parity between
 * products they already understand; it is the wrong shape here, where the
 * question is "which one am I?" and the answer turns almost entirely on how much
 * work you are willing to do up front. Six rows of ✓/— cannot say that, and the
 * one thing the matrix DID have to say — that Certified is the only tier with
 * recurring revenue — was a cell like any other.
 *
 * So: three cards, the rate as the headline, and what it costs you to get in
 * stated before what it gets you. Certified carries a solid Ember header (the
 * filled-header device from /features, which measures 4.6:1+ where a soft tint
 * measures 2:1) because it genuinely is the recommendation — it is the only tier
 * that keeps paying.
 *
 * Rates and unlocks are docs/114 §B.4 and the partners spec §6/§7 verbatim.
 */

interface Tier {
  key: string;
  name: string;
  rate: string;
  rateNote: string;
  /** What it takes to get in — stated first, because it is the real difference. */
  entry: string;
  unlocks: string[];
  /** The one tier we actually recommend wears the fill. */
  featured?: boolean;
}

const TIERS: Tier[] = [
  {
    key: 'informal',
    name: 'Informal',
    rate: '20%',
    rateNote: 'of a client’s first payment',
    entry: 'Nothing. Sign up, take your link, start referring today.',
    unlocks: [
      'A referral link that starts working immediately',
      'Every partner resource and template',
      'A directory listing',
    ],
  },
  {
    key: 'registered',
    name: 'Registered',
    rate: '30%',
    rateNote: 'of a client’s first payment',
    entry: 'A short application and a look at your work. Three business days.',
    unlocks: [
      'Half again the commission of Informal',
      'A support channel that skips the queue',
      'A verified badge on your directory listing',
      'Bootcamps you can build but not yet publish',
    ],
  },
  {
    key: 'certified',
    name: 'Certified',
    rate: '30% + 5%',
    rateNote: 'first payment, then every month after',
    entry: 'Certification — a self-paced course on the platform you are selling.',
    unlocks: [
      'The only tier that keeps paying after month one',
      'A named partner manager, not a queue',
      'Top of the directory, with the Certified badge',
      'Bootcamps published publicly on sparx.works',
      'Co-marketing, and new modules before anyone else',
    ],
    featured: true,
  },
];

export function PartnersTiers() {
  return (
    <Band tone="surface">
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <Heading level={2} size="display" className="text-5xl tracking-tight sm:text-6xl">
            Three tiers. You pick the pace
            <span className="text-primary">.</span>
          </Heading>
          <Text variant="lead" className="max-w-3xl">
            Every tier earns on referrals and lists in the directory from day one. What separates
            them is how much you put in up front — and whether the money stops after the first
            invoice or keeps arriving.
          </Text>
        </div>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
          {TIERS.map((t) => (
            <TierCard key={t.key} tier={t} />
          ))}
        </div>
      </div>
    </Band>
  );
}

function TierCard({ tier }: { tier: Tier }) {
  return (
    <article
      className={[
        'flex h-full flex-col overflow-hidden rounded-4xl border',
        // `base-200` cards, because the band under them is `base-100`. A card
        // takes the OPPOSITE tone of its band or it does not read as a card.
        tier.featured ? 'border-primary bg-base-200' : 'border-base-300 bg-base-200',
      ].join(' ')}
    >
      {/* Fill + its PAIRED ink as one choice. `bg-primary` alone would leave the
          header inheriting whatever ink the surrounding surface had. */}
      <div
        className={[
          'flex flex-col gap-1 px-8 py-6',
          tier.featured ? 'bg-primary text-primary-content' : 'bg-base-100',
        ].join(' ')}
      >
        <Heading level={3} size={3} className="tracking-tight">
          {tier.name}
        </Heading>
        <span className="text-3xl font-medium tracking-[-0.02em] sm:text-4xl">{tier.rate}</span>
        <Text className="text-lg leading-snug">{tier.rateNote}</Text>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-8">
        <div className="flex flex-col gap-1.5">
          <Heading level={4} size={6} className="tracking-tight">
            What it takes
          </Heading>
          <Text className="text-lg">{tier.entry}</Text>
        </div>

        <div className="flex flex-col gap-1.5">
          <Heading level={4} size={6} className="tracking-tight">
            What it unlocks
          </Heading>
          <ul className="flex flex-col gap-2">
            {tier.unlocks.map((u) => (
              <li key={u} className="text-md">
                {u}
              </li>
            ))}
          </ul>
        </div>

        <a
          href="#apply"
          aria-label={`Apply as a ${tier.name} partner`}
          className={[
            buttonClasses(
              tier.featured
                ? { size: 'lg', color: 'primary', variant: 'solid' }
                : { size: 'lg', variant: 'outline' }
            ),
            'mt-auto',
          ].join(' ')}
        >
          {tier.key === 'informal' ? 'Start here' : `Apply as ${tier.name}`}
        </a>
      </div>
    </article>
  );
}
