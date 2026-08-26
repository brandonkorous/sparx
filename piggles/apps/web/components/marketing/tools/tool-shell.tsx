import type * as React from 'react';
import { Icon, Section } from '@piggles/ui';
import Image from 'next/image';
import Link from 'next/link';
import { faBadgeCheck, faGlobe, faLaptop, faUserXmark } from '@fortawesome/pro-solid-svg-icons';
import type { PigglesIcon } from '@piggles/ui';
import { accountUrl } from '@piggles/config';
import { CloseBand } from '../close-band';
import type { PigglesTool } from './registry';
import { toolGroup, toolPhoto } from './registry';
import { ToolJsonLd } from './tool-jsonld';
import { ToolLearn } from './tool-learn';
import { ToolLadder } from './tool-ladder';
import { RelatedTools } from './related-tools';
import { ToolResultProvider } from './tool-result-context';
import { ToolEmailCapture } from './tool-email-capture';

/**
 * The frame every tool page wears.
 *
 * ── WHAT THIS REPLACED, AND WHY ─────────────────────────────────────────────
 *
 * The first version was a thin white heading band, a row of three grey
 * paragraphs, and then white cards on warm-white for the rest of the page. It
 * used the group hue on a 20px icon chip and on some 18px headings, and nowhere
 * else. Seventeen pages of it, identical.
 *
 * That is two of the design skill's named failures at once —"identical card
 * grids" and "large rounded-corner icons above every heading" — and it wasted
 * the one thing this product has that a generic tool site does not: six color
 * families that already mean something, and twelve photographs of real
 * businesses sitting unused in `public/photos`.
 *
 * ── THE HUE IS THE PAGE, NOT A GARNISH ──────────────────────────────────────
 *
 * The opening is now DRENCHED in the tool's group color — a full band of solid
 * `bg-module` carrying its own paired ink. A Sell tool opens burnt orange, a
 * Money tool olive, a Web tool indigo. Somebody who makes a barcode and then a
 * favicon has been shown, without a word, that those live in different parts of
 * the product; and it is the same color the app wears in the rail on day one.
 *
 * That is what the six-hue system is FOR (DESIGN.md §2). Spending it on an icon
 * chip was the timid version.
 *
 * ── AND THE ASSURANCE MOVED INTO THE BAND ───────────────────────────────────
 *
 *"Nothing is uploaded, no account, no watermark" used to be a separate white
 * strip below the fold of the heading — the least-read position on the page,
 * for the sentence that decides whether somebody types their customer's address
 * into an invoice. It is now three short lines inside the colored band, beside
 * the heading, where it is read as part of the promise rather than as small
 * print underneath it.
 */
interface Assurance {
  icon: PigglesIcon;
  title: string;
  body: string;
}

export function ToolShell({ tool, children }: { tool: PigglesTool; children: React.ReactNode }) {
  const group = toolGroup(tool);
  const photo = toolPhoto(tool);

  // The middle clause used to read "no email address". The tool now offers to
  // send you what it made, so the flat version was no longer true — and an
  // untrue reassurance is worse than none. Nothing is gated; that is the claim.
  const NO_ACCOUNT = {
    icon: faUserXmark,
    title: 'No account, ever',
    body: 'No sign-up and no trial that turns into a bill. We only take your email if you ask us to send you the result.',
  };
  const YOURS = {
    icon: faBadgeCheck,
    title: 'Yours to use',
    body: 'Nothing watermarked, nothing limited to a preview.',
  };

  /** The two tools that talk to the internet get a globe; the fifteen that do
   *  not get a laptop. The glyph carries the difference before the words do. */
  const assurances: Assurance[] = tool.leaves
    ? [{ icon: faGlobe, title: 'What leaves this page', body: tool.leaves }, NO_ACCOUNT, YOURS]
    : [
        {
          icon: faLaptop,
          title: 'It all happens here',
          body: 'Every part runs in your browser and it works with the internet off. Nothing leaves this page unless you ask us to send it to you.',
        },
        NO_ACCOUNT,
        YOURS,
      ];

  return (
    <>
      <ToolJsonLd tool={tool} />

      <div data-group={group}>
        {/* The band is a rounded section floating on the page ground, the same
 shape language as the close band at the other end of every page — so
 a tool page is book-ended by two solid blocks rather than fading in
 and out of white. */}
        {/* Above the band, not in it. A breadcrumb is the way back, not part of
            the statement — inside the color it competed with the heading it
            sits on top of. The padding mirrors the card's own so it lines up
            with the name below it rather than with the page gutter. */}
        <div className="px-4 sm:px-6">
          <nav
            aria-label="Breadcrumb"
            className="mx-auto max-w-7xl px-6 pt-8 pb-5 text-base font-semibold sm:px-10 lg:px-14"
          >
            <Link href="/tools" className="underline underline-offset-4">
              Free tools
            </Link>
            <span aria-hidden className="px-2">
              /
            </span>
            <span>{tool.name}</span>
          </nav>
        </div>

        <Section variant="panel" className="bg-module text-module-content">
          <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
            <div>
              {/* No icon chip above it. The name is the largest thing on the
 page and carries itself — root RULE #2, and the design
 skill's"large rounded-corner icons above every heading". */}
              <h1 className="text-5xl leading-[0.95] font-extrabold text-balance sm:text-6xl lg:text-7xl">
                {tool.name}
              </h1>
              <p className="mt-7 max-w-xl text-lg sm:text-xl">{tool.tagline}</p>
            </div>

            {/* Three short lines, not three cards. A list with a rule between
 items reads as one promise; three bordered boxes read as three
 features. */}
            {/* A stroke glyph beside each line, not an icon in a rounded chip
                  — the chip is the template tell, the bare stroke is a marker.
                  It inherits the band's ink, so it needs no color of its own. */}
            <dl className="divide-module-content/25 divide-y self-end">
              {assurances.map(({ icon, title, body }) => (
                <div
                  key={title}
                  className="grid grid-cols-[auto_1fr] gap-x-4 py-4 first:pt-0 last:pb-0"
                >
                  <Icon glyph={icon} aria-hidden className="row-span-2 mt-0.5 size-6" />
                  <dt className="text-base font-bold">{title}</dt>
                  <dd className="mt-1 text-base">{body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Section>

        {/* The tool. On the page ground, full width, with real air around it —
            it is the thing somebody came for. The capture card sits below it,
            inside the provider: it can only offer what is already on screen. */}
        <Section>
          <ToolResultProvider>
            {children}
            <div className="mt-8">
              <ToolEmailCapture toolSlug={tool.slug} toolName={tool.name} />
            </div>
          </ToolResultProvider>
        </Section>

        <ToolLearn tool={tool} />

        {/* The photograph. One per page, anchored to the group, so a Money tool
 shows a joiner and a Sell tool shows a market stall. A brand surface
 with no imagery reads as unfinished, and there are twelve of these in
 `public/photos` that nothing was using. */}
        <Section className="bg-base-100 border-base-300 border-y">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <Image
              src={photo.src}
              alt={photo.alt}
              width={1400}
              height={933}
              sizes="(min-width: 1024px) 46vw, 100vw"
              className="rounded-section h-auto w-full"
            />
            <div>
              <h2 className="text-4xl leading-tight font-extrabold text-balance sm:text-5xl">
                {tool.ladder.headline}
              </h2>
              <p className="mt-6 max-w-xl text-lg">{tool.ladder.body}</p>
            </div>
          </div>
        </Section>

        <ToolLadder tool={tool} />
      </div>

      <RelatedTools currentSlug={tool.slug} />

      <CloseBand
        heading="Fifteen apps, one subscription, and none of this behind a paywall."
        primary={{
          label: 'Start free for 14 days',
          href: accountUrl('signup', `tool-${tool.slug}`),
        }}
        secondary={{ label: 'See what it costs', href: '/pricing' }}
      />
    </>
  );
}
