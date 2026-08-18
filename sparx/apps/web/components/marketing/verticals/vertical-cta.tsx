import { Heading, Text } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Band } from '../band';
import { signupHref, SALES_HREF } from '../cta';
import { VERTICALS, type Vertical } from './registry';

/**
 * The closing band, and the page's link graph.
 *
 * The sibling links are not filler. Every one of these pages is a landing
 * target for an ad or a post, which means most visitors arrive on ONE of them
 * with nothing above it in their history — so each page has to be able to hand
 * someone to the right neighbor when they have landed on the wrong one, and to
 * the hub when they want the whole picture. Six pages that each link to the
 * other five and to /customers is a crawlable cluster rather than six orphans.
 *
 * `dark`, closing the page on the tone it opened with, with the price table's
 * lifted surface and the blueprint's neutral island in between.
 */
export function VerticalCta({ vertical }: { vertical: Vertical }) {
  const siblings = VERTICALS.filter((v) => v.slug !== vertical.slug);

  return (
    <Band tone="dark">
      <div className="flex flex-col gap-14">
        <div className="flex max-w-3xl flex-col gap-6">
          <Heading level={2} size="display" className="text-5xl tracking-tight sm:text-6xl">
            Start it this afternoon
            <span className="text-primary">.</span>
          </Heading>
          <Text variant="lead" className="text-xl">
            {`Open an account, turn on the parts ${vertical.plural} need, install the ` +
              `${vertical.blueprint.name} blueprint and put your own words in it. Nothing is charged ` +
              `until you decide to keep it, and no card is needed to find out.`}
          </Text>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={signupHref(`for-${vertical.slug}-final`)}
              className={buttonClasses({ size: 'lg', color: 'primary', variant: 'solid' })}
            >
              Start free &rarr;
            </a>
            {/* Colorless `outline`/`ghost` — naming a color inks the label in
                that color's raw accent, and neutral's raw accent inside the
                dark island is a dark gray (1.68:1 measured). See ./vertical-hero. */}
            <a href="/pricing" className={buttonClasses({ size: 'lg', variant: 'outline' })}>
              See every price
            </a>
            <a href={SALES_HREF} className={buttonClasses({ size: 'lg', variant: 'ghost' })}>
              Talk to a person
            </a>
          </div>
        </div>

        <div className="border-base-300 flex flex-col gap-5 border-t pt-10">
          <Heading level={3} size={4} className="tracking-tight">
            Run something else?
          </Heading>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {siblings.map((sibling) => (
              <a key={sibling.slug} href={`/for/${sibling.slug}`} className="text-lg font-medium">
                {sibling.label}
              </a>
            ))}
            <a href="/customers" className="text-primary text-lg font-medium">
              Every kind of business &rarr;
            </a>
          </div>
        </div>
      </div>
    </Band>
  );
}
