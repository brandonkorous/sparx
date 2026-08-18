import { Heading, Text } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Band } from '../band';
import type { Vertical } from './registry';

/**
 * The answer to "yes, but I'd still be starting from nothing".
 *
 * Every industry here has a real, installable blueprint in the catalog
 * (marketplace-catalog/blueprints), and a blueprint is not a theme: it installs
 * a working site — the pages, sample products, articles, a welcome email
 * sequence and a matching look — in one action. For a reader who has just been
 * told the price, the remaining objection is time, and this is the section that
 * answers it.
 *
 * Nothing here is a count. The blueprint files are edited like any other source
 * in this repo, so a hard-coded "42 products" would be wrong the first time
 * someone touched one. What IS stated is what a blueprint contains by
 * construction — pages, catalog, articles, emails, theme — which stays true.
 *
 * ## Why this is `surface` and not a painted tone
 *
 * It was `neutral`. A painted band sets a fill and an ink, but it is not a
 * theme scope — so the secondary `btn-outline` in here kept inking itself from
 * the light theme's `--color-base-content` and landed near-black on dark navy
 * at 1.29:1. See the `BandTone` doc comment: painted bands take solid controls
 * only. `surface` is a light lifted card where an outline control resolves
 * correctly, and it still breaks the run — the price table above it is `page`
 * and the FAQ below it is `page`.
 */
export function VerticalBlueprint({ vertical }: { vertical: Vertical }) {
  const { blueprint } = vertical;

  return (
    <Band tone="surface">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
        <div className="flex flex-col gap-6">
          <Heading level={2} size="display" className="text-5xl tracking-tight sm:text-6xl">
            You don&apos;t start from a blank page
          </Heading>
          <Text variant="lead" className="max-w-2xl text-xl">
            {`The ${blueprint.name} blueprint is a finished site for ${blueprint.tuned}, and installing ` +
              `it takes one click. Then you change the words to yours, put your own photographs in, ` +
              `and press publish — which is a very different afternoon from staring at an empty page.`}
          </Text>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`/market/blueprints/${blueprint.id}`}
              className={buttonClasses({ size: 'lg', color: 'primary', variant: 'solid' })}
            >
              {`See the ${blueprint.name} blueprint`}
            </a>
            {/* Colorless `outline` — see ./vertical-hero for why naming a
                color here would ink the label in that color's raw accent. */}
            <a
              href="/market/blueprints"
              className={buttonClasses({ size: 'lg', variant: 'outline' })}
            >
              Browse them all
            </a>
          </div>
        </div>

        <ul className="flex flex-col gap-4">
          {[
            'Pages that already exist — a shop, a journal, a booking page and a wholesale page, laid out and linked up.',
            'A starter catalog with real categories and photographs, so nothing looks like a demo while you fill it in.',
            'A few articles already written, to show what the journal is for and how a post should read.',
            'A welcome email sequence, ready to send from your own address the day someone signs up.',
            'A matching look — color, type and shape — that you can change in one place afterwards.',
          ].map((line) => (
            <li key={line} className="flex items-start gap-3">
              <span aria-hidden className="bg-primary mt-2.5 h-2 w-2 shrink-0 rounded-full" />
              <Text className="text-lg">{line}</Text>
            </li>
          ))}
        </ul>
      </div>
    </Band>
  );
}
