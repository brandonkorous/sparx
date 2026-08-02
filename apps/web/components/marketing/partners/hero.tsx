import { Heading, Text } from '@wizeworks/silicaui-react';
// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's unconditional `cloneElement(render, …)` then throws
// "Element type is invalid … got: undefined" during prerender.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Band } from '../band';

/**
 * The /partners hero — a flush dark band, same opening as /pricing and
 * /features.
 *
 * It replaces a full-bleed `bg-primary bg-soft` wash: a pale pink field roughly
 * 470px tall that was the largest and loudest thing on the page while the
 * primary CTA under it was a colourless `<Button size="lg">`. That inverts the
 * only rule that matters here — the ACTION should be the solid coloured shape
 * and the surface should be quiet. Ember now appears exactly where it is doing
 * work: the apply button, and the spark.
 *
 * The three "what you earn" facts were `font-mono text-sm` in `text-primary` on
 * that same pink — measured a hair over 2:1 and unreadable. They are metrics
 * now, at metric size, which is also where a reader looks for them.
 */

/**
 * Deliberately not four restatements of the commission rate. Two carry the
 * money, and two answer what an agency assumes about a "partner program" before
 * it reads a word: that there is a contract with a quota, and that a decision
 * takes a month. Both are no.
 */
const FACTS = [
  { v: '30%', s: 'of what a client first pays you brings in — 20% before you apply.' },
  { v: '5%', s: 'every month after, for as long as a managed client stays.' },
  { v: '$0', s: 'to join. No reseller contract, no minimum, no quota.' },
  { v: '3 days', s: 'is the longest an application sits before you hear back.' },
] as const;

export function PartnersHero() {
  return (
    <Band tone="dark" flush>
      <div className="flex flex-col gap-16">
        <div className="flex flex-col gap-8">
          <Heading
            level={1}
            size="display"
            className="max-w-4xl text-7xl leading-[0.94] tracking-tight sm:text-8xl"
          >
            Build your practice on sparx
            <span className="text-primary">.</span>
          </Heading>
          <Text variant="lead" className="text-base-content max-w-2xl text-xl">
            Your clients run their whole business on one platform instead of five subscriptions — so
            the pitch gets easier, your fee stays yours, and you earn on every client that goes live
            and keeps paying.
          </Text>
          <div className="flex flex-wrap gap-3">
            <a
              href="#apply"
              aria-label="Apply to become a partner"
              className={buttonClasses({ size: 'xl', color: 'primary', variant: 'solid' })}
            >
              Apply to become a partner &rarr;
            </a>
            <a
              href="#earnings"
              aria-label="Work out what you would earn"
              className={buttonClasses({ size: 'xl', variant: 'outline' })}
            >
              Work out what you&rsquo;d earn &darr;
            </a>
          </div>
        </div>

        <div className="border-base-300 grid grid-cols-2 gap-x-10 gap-y-8 border-t pt-10 lg:grid-cols-4">
          {FACTS.map((f) => (
            <div key={f.s} className="flex flex-col gap-1.5">
              <span className="text-4xl font-medium tracking-[-0.02em] sm:text-5xl">{f.v}</span>
              <Text className="text-lg leading-snug">{f.s}</Text>
            </div>
          ))}
        </div>
      </div>
    </Band>
  );
}
