import { Heading, Text } from '@wizeworks/silicaui-react';
// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's unconditional `cloneElement(render, …)` then throws
// "Element type is invalid … got: undefined" during prerender.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import type { MarketingModule } from '../primitives';
import { Band } from '../band';
import { TOOLS } from './registry';
import { ToolCard } from './tool-card';
import { TrustRow } from './trust-row';
import { ToolsValue } from './tools-value';

/**
 * The /tools hub.
 *
 * It opened on a full-bleed solid `bg-primary` band roughly 430px tall, with a
 * fifty-five-word lede set at 24px — and the 24px was not a typographic choice.
 * The file's own comment explained it: *"white on the Ember band is 4.13:1, under
 * WCAG AA for normal-size text. 24px clears the large-text bar."* The copy was
 * that long because the type had to be that big, and the type had to be that big
 * because the surface could not carry a normal sentence. It is the house dark
 * hero now, and the lede is two sentences.
 *
 * Below it, eighteen identical cards ran in one undifferentiated wall — no
 * heading, no count, no grouping, so a favicon generator and a privacy-policy
 * generator arrived with exactly the same weight. They are grouped by the part
 * of sparx each one belongs to, which is data the registry already carries
 * (`tool.module`) and which every card was already showing as a badge; all that
 * was missing was letting it organise the page.
 */

/**
 * Group order + plain-language names. The registry keys are module slugs, which
 * are the right thing to GROUP by and the wrong thing to LABEL with — a reader
 * looking for an invoice generator is not looking for "b2b". The module name
 * still rides each card's badge, so nothing is hidden; the heading just says
 * what the group is FOR.
 */
const GROUPS: { module: MarketingModule; title: string; blurb: string }[] = [
  {
    module: 'builder',
    title: 'Your site and your brand',
    blurb: 'The bits every site needs before it can go live.',
  },
  {
    module: 'commerce',
    title: 'Selling and pricing',
    blurb: 'Work out what to charge, and label what you ship.',
  },
  {
    module: 'cms',
    title: 'Content and being found',
    blurb: 'How your pages read to people, to search, and to AI.',
  },
  {
    module: 'crm',
    title: 'Customers and contacts',
    blurb: 'Getting people onto your list, and back onto your site.',
  },
  {
    module: 'email',
    title: 'Email',
    blurb: 'Sending that arrives, and signs off properly.',
  },
  {
    module: 'b2b',
    title: 'Getting paid',
    blurb: 'The paperwork side, done in a browser tab.',
  },
];

export function ToolsIndex() {
  const grouped = GROUPS.map((g) => ({
    ...g,
    tools: TOOLS.filter((t) => t.module === g.module),
  })).filter((g) => g.tools.length > 0);

  // Anything whose module is not in GROUPS still has to render — a new tool
  // should never fall off the hub because nobody updated a list here.
  const placed = new Set(grouped.flatMap((g) => g.tools.map((t) => t.slug)));
  const rest = TOOLS.filter((t) => !placed.has(t.slug));

  return (
    <main>
      <Band tone="dark" flush>
        <div className="flex flex-col gap-12">
          <div className="flex flex-col gap-7">
            <Heading
              level={1}
              size="display"
              className="max-w-4xl text-6xl leading-[0.95] tracking-tight sm:text-7xl"
            >
              {TOOLS.length} small jobs, already done
              <span className="text-primary">.</span>
            </Heading>
            <Text variant="lead" className="text-base-content max-w-2xl text-xl">
              Favicons, QR codes, campaign links, social cards, signatures, invoices — the things
              that quietly eat an afternoon. Open one and start; nothing uploads, nothing costs
              anything, and there is no account to make.
            </Text>
            <div className="flex flex-wrap gap-3">
              <a
                href="#tools"
                aria-label="See every tool"
                className={buttonClasses({ size: 'xl', color: 'primary', variant: 'solid' })}
              >
                See every tool &darr;
              </a>
            </div>
          </div>

          <TrustRow />
        </div>
      </Band>

      <Band id="tools" tone="page">
        <div className="flex flex-col gap-16">
          {grouped.map((g) => (
            <section key={g.module} className="flex flex-col gap-8">
              <div className="flex flex-col gap-3">
                <Heading level={2} size="display" className="text-4xl tracking-tight sm:text-5xl">
                  {g.title}
                  <span className="text-primary">.</span>
                </Heading>
                <Text variant="lead" className="max-w-2xl">
                  {g.blurb}
                </Text>
              </div>
              <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {g.tools.map((tool) => (
                  <ToolCard key={tool.slug} tool={tool} headingLevel="h3" />
                ))}
              </div>
            </section>
          ))}

          {rest.length > 0 ? (
            <section className="flex flex-col gap-8">
              <Heading level={2} size="display" className="text-4xl tracking-tight sm:text-5xl">
                Everything else
                <span className="text-primary">.</span>
              </Heading>
              <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((tool) => (
                  <ToolCard key={tool.slug} tool={tool} headingLevel="h3" />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </Band>

      <ToolsValue />

      <Band tone="dark">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-3xl flex-col gap-6">
            <Heading
              level={2}
              size="display"
              className="text-5xl leading-[0.95] tracking-tight sm:text-6xl"
            >
              The same people built the rest of it
              <span className="text-primary">.</span>
            </Heading>
            <Text variant="lead" className="text-base-content max-w-xl">
              These handle one job each, free, forever. sparx is the whole thing — site, store,
              content, customers, email — switched on a module at a time, on one bill.
            </Text>
          </div>
          <div className="flex flex-col items-start gap-3.5">
            <a
              href="/platform"
              aria-label="See how sparx works"
              className={buttonClasses({ size: 'xl', color: 'primary', variant: 'solid' })}
            >
              See how sparx works &rarr;
            </a>
            <a
              href="/pricing"
              aria-label="See pricing"
              className={buttonClasses({ size: 'xl', variant: 'outline' })}
            >
              See pricing
            </a>
          </div>
        </div>
      </Band>
    </main>
  );
}
