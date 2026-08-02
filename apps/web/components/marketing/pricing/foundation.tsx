import { Heading, Text } from '@wizeworks/silicaui-react';
import { Reveal } from '../reveal';
import { INCLUDED } from './data';

/**
 * "Under every module, the same platform." — the always-included floor, cast as
 * the bedrock the modules sit on. A full-bleed `bg-neutral` (slate) island (the
 * same island technique as landing's timeline band) makes the platform
 * literally the dark ground everything else stands on, so "you pay for modules,
 * this comes under all of them" lands as layout, not a claim. Slate also keeps
 * this saturated band distinct from the violet switchboard and indigo dashboard
 * bands above it.
 *
 * Button-less by design, so `bg-neutral` needs no `data-theme` scoping: every
 * color is a `neutral-content` token (the theme's "content on neutral", white)
 * at plain Tailwind opacities — zero hardcoded hex, and white body reads ~18:1
 * on slate.
 */
export function PricingFoundation() {
  return (
    <section className="bg-neutral text-neutral-content m-6 rounded-4xl px-6 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 max-w-2xl">
          <Heading
            level={2}
            size="display"
            className="text-6xl leading-[0.95] tracking-tight sm:text-7xl"
          >
            Under every module,
            <br />
            the same platform.
          </Heading>
          <Text variant="lead" className="text-neutral-content/80 mt-5 max-w-xl text-2xl">
            You pay for modules. Everything underneath comes free on every plan: hosting, security,
            and the shared foundation your whole business runs on. From one module to all twelve.
          </Text>
        </div>

        <Reveal className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INCLUDED.map((it) => {
            const Icon = it.icon;
            return (
              <div
                key={it.title}
                className="border-neutral-content/20 bg-neutral-content/5 flex flex-col gap-3 rounded-2xl border p-5"
              >
                <span className="bg-neutral-content/15 text-neutral-content flex h-11 w-11 items-center justify-center rounded-xl">
                  <Icon size={20} strokeWidth={2} aria-hidden />
                </span>
                <div className="text-md font-medium">{it.title}</div>
                <Text className="text-neutral-content/75 text-sm">{it.body}</Text>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
