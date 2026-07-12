import { Badge, Button, Heading, Text } from '@wizeworks/silicaui-react';
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
              <span className="text-base-content/55">Nothing else</span>
              <span className="text-primary">.</span>
            </Heading>
            <Text variant="lead" className="text-base-content/80 max-w-xl text-xl">
              Flat pricing, one module at a time. Switch on only the parts you need, get one
              invoice, and change your mind whenever the business does.
            </Text>
            <div className="flex flex-wrap gap-2.5">
              <Badge color="neutral" variant="outline" size="lg">
                from&nbsp;<span className="text-primary font-semibold">$10</span>/mo
              </Badge>
              <Badge color="neutral" variant="outline" size="lg">
                one invoice
              </Badge>
              <Badge color="neutral" variant="outline" size="lg">
                <span className="text-primary font-semibold">14-day</span>&nbsp;free trial
              </Badge>
              <Badge color="neutral" variant="outline" size="lg">
                no card to start
              </Badge>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                size="xl"
                color="primary"
                variant="solid"
                render={<a href={signupHref('pricing-v2-hero')} aria-label="Start free" />}
              >
                Start free &rarr;
              </Button>
              <Button
                size="xl"
                variant="outline"
                render={<a href="#switchboard" aria-label="Price your stack" />}
              >
                Price your stack &darr;
              </Button>
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
      className="bg-base-100 text-base-content border-base-300 mx-auto w-full max-w-sm rounded-3xl border p-7 shadow-2xl"
      data-theme="light"
    >
      <div className="text-base-content/45 font-mono text-xs tracking-[0.14em]">START HERE</div>
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
            <span className="text-base-content/60 tabular-nums">{row.price}</span>
          </div>
        ))}
      </div>
      <div className="border-base-content mt-4 flex items-baseline justify-between border-t-2 pt-4">
        <span className="text-base-content/60 text-sm">Your monthly bill</span>
        <span className="text-primary text-4xl font-semibold tracking-[-0.02em]">
          $88<span className="text-base-content/45 text-xl font-normal">/mo</span>
        </span>
      </div>
      <Text variant="caption" className="mt-3">
        Add or drop a module any time. The bill follows.
      </Text>
    </div>
  );
}
