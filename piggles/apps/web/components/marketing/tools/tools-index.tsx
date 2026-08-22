import Link from 'next/link';
import { Section } from '@piggles/ui';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { PIGGLES_GROUPS } from '@piggles/brand';
import { accountUrl } from '@piggles/config';
import { PRICE_LABEL } from '@piggles/config/pricing';
import { PigglesMascot } from '@piggles/mascot/react';
import { PageHero } from '../page-hero';
import { GROUP_COPY } from '../groups';
import { CloseBand } from '../close-band';
import { TOOLS, toolGroup } from './registry';
import { ToolsIndexJsonLd } from './tool-jsonld';
import { ToolCard } from './card/tool-card';
import { ToolBrowser, type BrowserItem } from './card/tool-browser';
import type { ChipOption } from './card/filter-chips';

/** Every tool as what it makes, searchable and sortable. No group sections: the
 *  grouping is a filter you apply, not three walls you scroll past. */
export function ToolsIndex() {
  const items: BrowserItem[] = TOOLS.map((tool) => ({
    slug: tool.slug,
    name: tool.name,
    tagline: tool.tagline,
    keywords: tool.keywords.join(' '),
    group: toolGroup(tool),
    card: <ToolCard tool={tool} />,
  }));

  const chips: ChipOption[] = [
    { value: 'all', label: 'Everything', count: TOOLS.length },
    ...PIGGLES_GROUPS.map((group) => ({
      value: group,
      label: GROUP_COPY[group].title,
      group,
      count: TOOLS.filter((t) => toolGroup(t) === group).length,
    })).filter((chip) => chip.count > 0),
  ];

  return (
    <>
      <ToolsIndexJsonLd tools={TOOLS} />

      {/* On <PageHero> like every other page. It had a hand-built opening — a
          7xl heading, its own grid, the mascot beside it — which was the best of
          the interior heroes and still the one page whose top did not match the
          others.

          The figure is deliberately NOT a wall of the seventeen names: the
          browser below is a searchable, filterable index of exactly those
          seventeen, so listing them again a hundred pixels higher would be the
          page saying the same thing twice in two worse ways. She is what the
          fold has that the browser does not. */}
      <PageHero
        heading={
          <>
            Seventeen small tools. <span className="text-primary">No sign-up, no catch.</span>
          </>
        }
        lede="The odd jobs that come up when you are running a business — a favicon, an invoice, a QR code for the table, the sum you always redo on the back of an envelope. All free, all in your browser, and none of them asking for an email address first."
        figure={
          <PigglesMascot
            intent="welcome"
            size={{ base: 'md', lg: 'lg' }}
            className="float mx-auto"
          />
        }
        assurances={['Nothing to sign up for', 'No watermark', 'Nothing uploaded']}
      >
        <a
          className={buttonClasses({ color: 'primary', size: 'lg' })}
          href={accountUrl('signup', 'tools-hub')}
        >
          Get Piggles — {PRICE_LABEL}/month
        </a>
        {/* No `color` at all. It was pinned to `neutral`, which is Brandon's
            call every time (root RULE #4) — and an uncolored `.btn` resolves to
            `base-content`, which is the right ink here and stays right on any
            surface it is moved to. */}
        <Link className={buttonClasses({ variant: 'outline', size: 'lg' })} href="/apps">
          See the actual product
        </Link>
      </PageHero>

      <Section>
        <ToolBrowser items={items} groups={chips} />
      </Section>

      <Section className="bg-base-100 border-base-300 border-y">
        <div className="grid gap-10 lg:grid-cols-3 lg:gap-16">
          <h2 className="text-3xl font-extrabold text-balance sm:text-4xl">
            Why these are free, since you were wondering
          </h2>

          <div className="flex max-w-2xl flex-col gap-6 lg:col-span-2">
            <p className="text-lg">
              Because they are advertising, and we would rather advertise by being useful than by
              following you around the internet. You will use one, it will do the job, and some
              small number of people will remember the name later — when the thing they need is
              bigger than a browser tab.
            </p>
            <p className="text-lg">
              That is the whole arrangement. There is no email wall at the download step, nothing
              that stops working after three uses, and no free plan that turns into a bill. If you
              make one invoice here and never come back, the arrangement worked exactly as intended.
            </p>
            <p className="text-lg">
              The product these come from is Piggles: fifteen apps for running a small business —
              your website, your customers, your stock, your money — for {PRICE_LABEL} a month with
              everything included. These seventeen are the corners of it that fit in a page.
            </p>
          </div>
        </div>
      </Section>

      <CloseBand
        heading={`The tools are free. The business software is ${PRICE_LABEL}.`}
        primary={{ label: 'Start free for 14 days', href: accountUrl('signup', 'tools-close') }}
        secondary={{ label: 'See what it costs', href: '/pricing' }}
        note={`${PRICE_LABEL} a month · free for 14 days · no card needed`}
      />
    </>
  );
}
