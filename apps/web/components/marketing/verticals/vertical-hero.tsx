import { Badge, Heading, Text } from '@wizeworks/silicaui-react';
// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's unconditional `cloneElement` then throws during
// prerender. Same reason the homepage's WhoeverYouAre does it this way.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Band } from '../band';
import { getModuleColor } from '../primitives';
import { signupHref } from '../cta';
import { money, verticalStack } from './stack';
import type { Vertical } from './registry';

/**
 * The industry page's opening band — the house dark hero, the same one
 * /features, /pricing, /partners and every tool page opens on.
 *
 * The module hue arrives as a HIGHLIGHT, never as the band's fill: it fills the
 * icon chip (a shape, legible at any hue), and inks the headline's closing
 * period. A full-bleed hue wash was tried on the tool pages and rejected — it
 * carried no information and forced 24px type to clear the contrast bar.
 *
 * ## The row under the rule
 *
 * Four facts, each answering a cost this reader has already assumed. A small
 * business owner comparing platforms is braced for a per-person charge, a slice
 * of every sale, a setup project, and a twelve-month contract — so those are the
 * four, and they are the reason this row is not a list of features. The monthly
 * figure is this industry's actual stack (see ./stack.ts), not a from-price.
 *
 * An explicit 2×2 / 1×4 grid, never `justify-between`: the earlier hand-rolled
 * version of this row wrapped 3+1 the moment a label ran long.
 */
export function VerticalHero({ vertical }: { vertical: Vertical }) {
  const color = getModuleColor(vertical.lead);
  const stack = verticalStack(vertical);
  const Icon = vertical.icon;

  const facts: { value: string; label: string }[] = [
    { value: `${money(stack.monthly)}/mo`, label: `The usual stack for ${vertical.plural}.` },
    { value: '$0', label: 'Per person. Put the whole team on it.' },
    { value: '0%', label: 'Taken from what you sell. Ever.' },
    { value: 'Any month', label: 'Cancel or switch a module off. No contract.' },
  ];

  return (
    <Band tone="dark" flush>
      <div className="flex flex-col gap-12">
        <div className="flex flex-col gap-7">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2">
            <a href="/customers" className="text-md text-primary font-medium">
              Who it&apos;s for
            </a>
            <span aria-hidden className="text-md">
              /
            </span>
            <span className="text-md font-medium">{vertical.label}</span>
          </nav>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {/* Fill + its PAIRED ink as one choice. A module hue is a FILL
                color — several measure ~2:1 as text — so the way to show one at
                size is to fill a shape and write on top in its own `-content`. */}
            <span
              aria-hidden
              className={`inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${color.bg} ${color.content}`}
            >
              <Icon size={30} strokeWidth={1.6} />
            </span>

            <div className="flex min-w-0 flex-col items-start gap-6">
              <Heading
                level={1}
                size="display"
                className="text-5xl leading-[0.98] tracking-tight sm:text-6xl"
              >
                {vertical.headline}
                {/* Module ink is legible here and only here. On the dark island
                    these hues clear AA comfortably; on a light band the same
                    class measures 2.3–2.8:1. */}
                <span className={color.ink}>.</span>
              </Heading>
              <Text variant="lead" className="text-base-content max-w-3xl text-xl">
                {vertical.lede}
              </Text>

              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={signupHref(`for-${vertical.slug}`)}
                    className={buttonClasses({ size: 'lg', color: 'primary', variant: 'solid' })}
                  >
                    Start free &rarr;
                  </a>
                  {/* `outline` with NO color. Naming a color on an outline
                      control paints its label in that color's RAW accent, and
                      inside the dark island `--color-neutral` is a dark gray —
                      measured 1.68:1 on this band. Colorless, it inherits the
                      surface's own `-content` ink and measures 16:1. Same trap
                      as the `soft` defect in docs/silicaui/02-core-asks.md §2. */}
                  <a href="#cost" className={buttonClasses({ size: 'lg', variant: 'outline' })}>
                    {`See what ${vertical.subject} pays`}
                  </a>
                </div>
                <Text className="text-md">No card needed · Live the same day</Text>
              </div>
            </div>
          </div>
        </div>

        {/* Real page content, not a keyword shelf: someone who runs a barbershop
            is scanning for the word "barbershop" before they trust that a page
            headed "salons" is about them. */}
        <div className="flex flex-wrap items-center gap-2">
          <Text as="span" className="text-md">
            Also for
          </Text>
          {vertical.alsoCalled.map((name) => (
            // Deliberately colorless. A trade name is a genuinely untyped
            // value, so no hue should claim it (RULE #4) — but ``
            // is NOT how you say that on an outline control: it inks the label
            // in neutral's raw accent, which on this dark island is a dark gray
            // at 1.68:1. Omitting the color inherits the surface ink instead.
            <Badge key={name} variant="outline" size="md">
              {name}
            </Badge>
          ))}
        </div>

        <div className="border-base-300 grid grid-cols-2 gap-8 border-t pt-10 lg:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label} className="flex flex-col gap-2">
              <span className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                {fact.value}
              </span>
              <Text className="text-md">{fact.label}</Text>
            </div>
          ))}
        </div>
      </div>
    </Band>
  );
}
