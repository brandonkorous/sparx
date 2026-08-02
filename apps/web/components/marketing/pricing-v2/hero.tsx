import { Badge, Heading, Text } from '@wizeworks/silicaui-react';
// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's unconditional `cloneElement(render, …)` then throws
// "Element type is invalid … got: undefined" during prerender.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { signupHref } from '../cta';
import { MODULE_HEX } from '../modules-catalog';

/**
 * The v2 pricing hero — the promise, not the tool. A DOM-scoped
 * `data-theme="dark"` island (same technique as landing-v3's hero) so every
 * color resolves from `color`/`variant` props and `bg-*`/`text-*` tokens with
 * zero hardcoded hex — except the module-dot `backgroundColor` on the starter
 * tag, which is dynamic per-entity hue (`MODULE_HEX`), the one sanctioned
 * inline-style exception (same as landing-v3's timeline chips).
 *
 * The device: fact chips carry the pricing model at a glance, and a floating
 * white "starter tag" makes "add a module, the bill follows" a physical object
 * rather than a claim — a light echo of the money-beat receipt below.
 */
const STARTER = [
  { key: 'builder', label: 'Builder', price: '$10/mo' },
  { key: 'commerce', label: 'Commerce', price: '+ $49/mo' },
  { key: 'email', label: 'Email', price: '+ $29/mo' },
] as const;

export function PricingV2Hero() {
  return (
    <section data-theme="dark" className="bg-base-100">
      <div className="mx-auto max-w-7xl px-6 py-24 sm:px-8 lg:py-32">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div className="flex flex-col gap-8">
            <Heading
              level={1}
              size="display"
              className="text-7xl leading-[0.94] tracking-tight sm:text-8xl"
            >
              Pay for what you use.
              <br />
              <span className="text-base-content">Nothing else</span>
              <span className="text-primary">.</span>
            </Heading>
            <Text variant="lead" className="text-base-content max-w-xl text-xl">
              Flat pricing, one module at a time. Switch on only the parts you need, get one
              invoice, and change your mind whenever the business does.
            </Text>
            {/* No `color` on these. They sat on `color="neutral"`, which inside
                this `data-theme="dark"` island resolved to `--color-neutral`
                (oklch(32%) — DARK) and painted dark ink on a near-black band:
                1.68:1, unreadable. Only the nested `text-primary` spans showed.
                A bare `badge-outline` inherits the island's own `-content` ink
                instead, which is the whole point of the surface pairing — and it
                keeps the chips quiet so the $10 / 14-day accents still carry.
                Neutral is earned by chassis, bare prose, or a dismiss action;
                four proof points are none of those. */}
            <div className="flex flex-wrap gap-2.5">
              <Badge variant="outline" size="lg">
                from&nbsp;<span className="text-primary font-semibold">$10</span>/mo
              </Badge>
              <Badge variant="outline" size="lg">
                one invoice
              </Badge>
              <Badge variant="outline" size="lg">
                <span className="text-primary font-semibold">14-day</span>&nbsp;free trial
              </Badge>
              <Badge variant="outline" size="lg">
                no card to start
              </Badge>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href={signupHref('pricing-v2-hero')}
                aria-label="Start free"
                className={buttonClasses({ size: 'xl', color: 'primary', variant: 'solid' })}
              >
                Start free &rarr;
              </a>
              <a
                href="#switchboard"
                aria-label="Price your stack"
                className={buttonClasses({ size: 'xl', variant: 'outline' })}
              >
                Price your stack &darr;
              </a>
            </div>
          </div>

          <StarterTag />
        </div>
      </div>
    </section>
  );
}

function StarterTag() {
  return (
    <div
      className="bg-base-100 border-base-300 mx-auto w-full max-w-sm rounded-3xl border p-7 shadow-2xl"
      data-theme="light"
    >
      {/* This was a wide-tracked mono "START HERE" kicker. It is the only
          title this card has, so it becomes a real heading rather than a
          label above nothing — scale and weight carry it. */}
      <Heading level={3} className="text-xl">
        Start here
      </Heading>
      <div className="mt-4 flex flex-col">
        {STARTER.map((row) => (
          <div
            key={row.key}
            className="border-base-300 flex items-center justify-between border-b border-dashed py-3.5"
          >
            <span className="flex items-center gap-3 font-medium">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: MODULE_HEX[row.key] }}
              />
              {row.label}
            </span>
            <span className="text-base-content tabular-nums">{row.price}</span>
          </div>
        ))}
      </div>
      <div className="border-base-content mt-4 flex items-baseline justify-between border-t-2 pt-4">
        <span className="text-base-content text-sm">Your monthly bill</span>
        <span className="text-primary text-4xl font-semibold tracking-[-0.02em]">
          $88<span className="text-base-content text-xl font-normal">/mo</span>
        </span>
      </div>
      <Text variant="caption" className="mt-3">
        Add or drop a module any time. The bill follows.
      </Text>
    </div>
  );
}
