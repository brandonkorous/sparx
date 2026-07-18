import { ArrowRight } from 'lucide-react';
// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's unconditional `cloneElement(render, …)` then throws
// "Element type is invalid … got: undefined" during prerender.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Section, Container, Display } from '../primitives';
import { TOOLS } from './registry';
import { ToolCard } from './tool-card';
import { TrustRow } from './trust-row';
import { ToolsValue } from './tools-value';

/**
 * The /tools hub — a grid of every free tool, plus the platform hand-off.
 * Nav/Footer come from the root layout.
 *
 * The hero is a SOLID `primary` band — the hub is the brand's own front door, so
 * it takes the brand hue outright rather than joining the per-tool
 * primary/secondary/accent rotation in `tool-shell`. Full-strength fill, paired
 * `primary-content` ink, no gradient and no `bg-soft`. Everything below it — the
 * card grid, the value pillars, the closing CTA — stays on the neutral chassis,
 * so the band reads as one confident moment instead of a page-wide wash.
 */
export function ToolsIndex() {
  return (
    <main>
      {/* A bare <section>, not <Section surface="page">: the band owns its fill,
          and `bg-primary` over Section's `bg-base-200` would be two
          same-specificity utilities racing on stylesheet order. */}
      <section className="px-page py-section-lg bg-primary text-primary-content">
        <Container>
          <div className="flex max-w-[820px] flex-col gap-5">
            {/* `currentColor` inherits the band ink; without it Display stamps
                the neutral `text-base-content`. */}
            <Display as="h1" size={60} color="currentColor">
              Free tools for people who build things.
            </Display>
            <p className="text-lede-lg m-0 font-sans">
              Favicons, QR codes, campaign links, social cards, email signatures, invoices, and a
              dozen more — the small jobs that eat an afternoon. Built for founders, makers, and
              small teams who&rsquo;d rather get it done and move on. Open one and start; your work
              stays on your machine, and nothing here costs a thing.
            </p>
            <TrustRow tone="oncolor" />
          </div>
        </Container>
      </section>

      <Section surface="surface" padding="lg">
        <div className="mkt-grid-3-2-1">
          {TOOLS.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      </Section>

      <ToolsValue />

      <Section surface="page" padding="lg">
        {/* silica's card via the plugin-emitted classes — this is a Server
            Component and the silicaui-react barrel is `'use client'`. */}
        <div className="card">
          <div className="card-body mkt-stack-on-tablet items-center justify-between gap-7 p-10">
            <div className="flex max-w-[640px] flex-col gap-3">
              <Display as="h2" size={30}>
                Same platform. From a free favicon to your whole business
              </Display>
              <p className="text-body text-ink-muted m-0 font-sans">
                sparx is the modular content and commerce OS — your website, CMS, CRM, email,
                commerce, B2B, and AI, each switched on when you need it, all on one data layer and
                one bill. These tools handle a single job for free. sparx handles the rest, for
                years.
              </p>
            </div>
            <a
              href="/platform"
              aria-label="Explore the platform"
              className={`${buttonClasses({ color: 'primary', variant: 'solid', size: 'lg' })} shrink-0`}
            >
              Explore the platform
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </Section>
    </main>
  );
}
