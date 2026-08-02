'use client';

import { useCallback, useEffect, useState } from 'react';
import { Stack } from '@wizeworks/silicaui-react';
import {
  MODULES,
  MODULE_BACKGROUND_COLOR,
  MODULE_CONTENT_COLOR,
  MODULE_ICON,
} from '../modules-catalog';
import { LEDGER } from './data';

/**
 * The hero device — all fifteen modules as a peeking deck of cards, one face-up
 * at a time, auto-advancing.
 *
 * It replaces a white "starter tag" that listed three modules with prices and a
 * $88 total. That card had two problems no amount of styling fixes. It was a
 * still frame of the switchboard two beats below (modules, prices, a total —
 * minus the interaction), and it rehearsed the money beat's receipt (line items
 * over a ruled total on white paper) quietly, before the real one lands. Being
 * first, it made both weaker. It also led with the LARGEST number on the page,
 * $88, for a stack the reader never chose, at the moment of most hesitation.
 *
 * A deck collides with neither. The switchboard's shape is a grid — every tile
 * visible, all summing to one figure; its job is COMBINING. This shows one
 * module at a time at full size and never totals anything; its job is the UNIT:
 * what a module IS, what one costs, and what it replaces. Same relationship the
 * card's `replaces` line has to the money beat's twelve-line receipt — the atom
 * to its sum, drawn from the same LEDGER so the two can never disagree. And the
 * metaphor argues the pitch without a sentence: many capabilities, one thing in
 * your hand, which is "one platform, one invoice" as an object, not a claim.
 *
 * Each card is a saturated module hue with its PAIRED `-content` ink (silica
 * emits fill and ink as independent utilities, so a fill without its partner
 * inherits whatever ink the surrounding surface had — here, the dark island's).
 * That is also why the old inline `MODULE_HEX` dot is gone: the hero is now
 * entirely token-driven, with no `style` prop anywhere in it.
 *
 * `Stack` does the layering (`grid-area: 1/1`, front card flush, the next two
 * nudged back and scaled down) and animates re-stacking via a CSS transition on
 * `transform`. That transition fires on ANY order change, so this component
 * owns the order itself — rotating the array on a timer — rather than passing
 * `interactive`, which cycles on click only and would fight a second source of
 * truth. Click and Enter/Space still advance it manually, and doing so stops
 * the timer: once a reader takes hold of the deck, it stops moving under them.
 */
const ROTATE_MS = 3800;

/** What each module replaces, and what that costs elsewhere — keyed off the
 *  money beat's ledger rather than a second copy of the same figures. The three
 *  free capabilities (SEO, Automations, Social) have no ledger row and fall
 *  back to their own note below. */
const REPLACES = new Map(LEDGER.map((row) => [row.key, row]));

/** The one qualifying fact a module carries, if it carries one: free forever,
 *  bundled into a bigger module, or dependent on one. */
function moduleNote(m: (typeof MODULES)[number]): string | null {
  if (m.free) return 'Free on every site, always.';
  if (m.includedWith?.length) return `Included free with ${m.includedWith.join(' or ')}.`;
  if (m.requires) return `Runs on top of ${m.requires}.`;
  return null;
}

export function PricingModuleDeck() {
  const [order, setOrder] = useState(() => MODULES);
  const [held, setHeld] = useState(false);

  const advance = useCallback(() => {
    setOrder((o) => o.slice(1).concat(o.slice(0, 1)));
  }, []);

  useEffect(() => {
    // Respect reduced motion: no unattended movement. The deck still renders in
    // full and stays clickable, so nothing is lost but the automation.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || held) return;
    const id = window.setInterval(advance, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [advance, held]);

  const take = useCallback(() => {
    setHeld(true);
    advance();
  }, [advance]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      {/* pt-8 reserves room for the two cards peeking ABOVE the front one —
          their offset is a transform, so it claims no layout space and would
          otherwise ride up over the headline on narrow screens. */}
      <div className="pt-8">
        <Stack
          className="w-full"
          role="button"
          tabIndex={0}
          aria-label={`${MODULES.length} modules — activate to see the next`}
          onClick={take}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              take();
            }
          }}
        >
          {order.map((m) => {
            const Icon = MODULE_ICON[m.id];
            const alt = REPLACES.get(m.id);
            const note = moduleNote(m);
            return (
              <div
                key={m.id}
                // Fixed height so cycling through fifteen descriptions of very
                // different lengths never resizes the hero under the reader.
                className={`flex h-[30rem] cursor-pointer flex-col gap-5 rounded-3xl p-8 ${MODULE_BACKGROUND_COLOR[m.id]} ${MODULE_CONTENT_COLOR[m.id]}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <Icon size={30} strokeWidth={2} aria-hidden />
                  <p className="text-3xl font-semibold tabular-nums">
                    {m.free ? (
                      'Free'
                    ) : (
                      <>
                        ${m.price}
                        <span className="text-lg font-normal">/mo</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <p className="text-4xl font-semibold tracking-tight">{m.label}</p>
                  <p className="text-xl leading-snug font-medium">{m.title}</p>
                </div>

                <p className="text-lg leading-normal">{m.description}</p>

                {/* The qualifying fact and the comparison sit at the foot, after
                    the reader knows what the thing is. `mt-auto` pins them there
                    whatever the description's length. */}
                <div className="mt-auto flex flex-col gap-1.5">
                  {note ? <p className="text-md font-medium">{note}</p> : null}
                  {alt ? (
                    <p className="text-md">
                      Replaces {alt.alt} —{' '}
                      <span className="font-semibold tabular-nums">{alt.amt}/mo</span> elsewhere.
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </Stack>
      </div>
      <p className="text-base-content text-center text-lg">
        {MODULES.length} modules. Switch on the ones you need, skip the rest.
      </p>
    </div>
  );
}
