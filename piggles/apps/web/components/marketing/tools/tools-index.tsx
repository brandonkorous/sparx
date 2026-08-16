import Link from 'next/link';
import { Section } from '@piggles/ui';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { PIGGLES_GROUPS } from '@piggles/brand';
import { accountUrl } from '@piggles/config';
import { PigglesMascot } from '@piggles/mascot/react';
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

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:items-end lg:gap-16">
          <div>
            <h1 className="text-5xl leading-[0.95] font-extrabold text-balance sm:text-6xl lg:text-7xl">
              Seventeen small tools.
              <br />
              <span className="text-primary">No sign-up, no catch.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg sm:text-xl">
              The odd jobs that come up when you are running a business — a favicon, an invoice, a
              QR code for the table, the sum you always redo on the back of an envelope. All free,
              all in your browser, and none of them asking for an email address first.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                className={buttonClasses({ color: 'primary', size: 'lg' })}
                href={accountUrl('signup', 'tools-hub')}
              >
                Get Piggles — $49/month
              </a>
              <Link
                className={buttonClasses({ color: 'neutral', variant: 'outline', size: 'lg' })}
                href="/apps"
              >
                See the actual product
              </Link>
            </div>
          </div>

          <PigglesMascot
            intent="welcome"
            size={{ base: 'md', lg: 'lg' }}
            className="mx-auto lg:mx-0"
          />
        </div>

        {/* The browser is part of the same section as the heading that
            introduces it — a gap here would read as two unrelated blocks. */}
        <div className="mt-12">
          <ToolBrowser items={items} groups={chips} />
        </div>
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
              your website, your customers, your stock, your money — for $49 a month with everything
              included. These seventeen are the corners of it that fit in a page.
            </p>
          </div>
        </div>
      </Section>

      <CloseBand
        heading="The tools are free. The business software is $49."
        primary={{ label: 'Start free for 14 days', href: accountUrl('signup', 'tools-close') }}
        secondary={{ label: 'See what it costs', href: '/pricing' }}
        note="$49 a month · free for 14 days · no card needed"
      />
    </>
  );
}
