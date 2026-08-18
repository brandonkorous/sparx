import { Heading, Text } from '@wizeworks/silicaui-react';
import { getModuleColor } from '../primitives';
import { money, verticalStack } from './stack';
import type { Vertical } from './registry';

/**
 * One industry, as a card on the /customers hub.
 *
 * The card leads with the PRICE for that industry's stack, because that is the
 * question the visitor is actually holding and the one thing that genuinely
 * differs between these six. A grid of six cards that each said "a complete
 * platform for your business" would be six copies of one card.
 *
 * The whole card is the link — not a "learn more" at the bottom. A person
 * scanning six of these should be able to hit the one that is theirs anywhere
 * on it, which is also a bigger target on a phone.
 *
 * The module hue rides the icon chip as a FILL with its paired ink. It never
 * becomes the card's background: a wall of six tinted cards is competing
 * washes, not wayfinding (DESIGN.md — tint the one card that earns it).
 */
export function VerticalCard({ vertical }: { vertical: Vertical }) {
  const color = getModuleColor(vertical.lead);
  const stack = verticalStack(vertical);
  const Icon = vertical.icon;

  return (
    <a
      href={`/for/${vertical.slug}`}
      className="border-base-300 bg-base-100 hover:border-primary flex h-full flex-col gap-5 rounded-2xl border p-8 no-underline transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <span
          aria-hidden
          className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color.bg} ${color.content}`}
        >
          <Icon size={24} strokeWidth={1.6} />
        </span>
        <span className="text-primary text-2xl font-semibold tracking-tight tabular-nums">
          {`${money(stack.monthly)}/mo`}
        </span>
      </div>

      <Heading level={3} size={3} className="tracking-tight">
        {vertical.label}
      </Heading>

      {/* The trade names, not a summary of the platform. Someone scanning for
          "barbershop" or "food truck" finds their own word here. */}
      <Text className="text-lg">{vertical.alsoCalled.slice(0, 5).join(' · ')}</Text>

      {/* Deliberately NOT `text-primary`. Ember on white measures 4.13:1 — fine
          for the 24px price above (large text clears at 3.0) and wrong for a
          16px line, which needs 4.5. It would also be the card's SECOND Ember
          element saying the same thing; the price already carries the accent,
          and the affordance here is the arrow plus the fact that the whole card
          is the link. */}
      <span className="text-md mt-auto pt-2 font-medium">
        {`What ${vertical.plural} pay `}&rarr;
      </span>
    </a>
  );
}
