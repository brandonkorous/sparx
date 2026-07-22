import * as React from 'react';
import { ModuleProvider } from '@sparx/ui';
import { Section, Container, Display, getModuleColor } from '../primitives';
import type { ToolMeta } from './registry';
import { ToolLadder } from './tool-ladder';
import { ToolUpsell } from './tool-upsell';
import { ToolLearn } from './tool-learn';
import { ToolJsonLd } from './tool-jsonld';
import { RelatedTools } from './related-tools';
import { TrustRow } from './trust-row';

/**
 * Shared page frame for every tool. Server-rendered chrome (hero, ladder CTA,
 * related strip) wraps the interactive client tool passed as `children`; Nav/
 * Footer come from the root layout. The tool area is wrapped in
 * <ModuleProvider> so the controls (and the FileUpload/ColorPicker active
 * states) adopt this tool's module color — silica has no equivalent, so that
 * one @sparx/ui import stays.
 *
 * Class-based per apps/web: the hero chrome is utilities + the editorial type
 * scale.
 *
 * THE HERO IS A SOLID BRAND BAND. It fills with `primary` / `secondary` /
 * `accent` at FULL saturation (never `bg-soft`, never a gradient) paired with
 * silica's matching `*-content` foreground, so the type keeps real contrast in
 * both themes. Everything BELOW the band stays neutral — the point is one
 * confident band on top, not a tinted page.
 */

/**
 * The three brand fills, as LITERAL class pairs — Tailwind's scanner cannot see
 * an interpolated `bg-${tone}`, and the paired `*-content` token is what makes
 * the fill legible rather than a contrast gamble.
 */
const HERO_TONES = [
  'bg-primary text-primary-content',
  'bg-secondary text-secondary-content',
  'bg-accent text-accent-content',
] as const;

/**
 * Pick a hero fill from the tool's SLUG, so /tools/qr-code is the same color on
 * every render — server and client, today and next deploy. Deriving it from the
 * registry index would reshuffle every hero the moment a tool is inserted, and
 * `Math.random()` would hydration-mismatch outright.
 */
function heroTone(slug: string): string {
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return HERO_TONES[hash % HERO_TONES.length]!;
}
export function ToolShell({ tool, children }: { tool: ToolMeta; children: React.ReactNode }) {
  const color = getModuleColor(tool.module);
  const Icon = tool.icon;

  return (
    <>
      <ToolJsonLd tool={tool} />
      <main>
        {/* Rendered as a bare <section> rather than <Section surface="page">:
            the band owns its own fill, and stacking `bg-primary` on Section's
            `bg-base-200` would be two same-specificity utilities racing on
            stylesheet order. */}
        <section className={`px-page py-section-md ${heroTone(tool.slug)}`}>
          <Container>
            <div className="flex flex-col gap-6">
              <nav aria-label="Breadcrumb" className="text-small flex items-center gap-2">
                <a href="/tools" className="font-sans underline underline-offset-4">
                  Free tools
                </a>
                <span aria-hidden>/</span>
                <span className="font-sans font-medium">{tool.name}</span>
              </nav>

              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                {/* A solid neutral chip on the band, with the MODULE hue as the
                    icon ink — module identity stays a discrete element while the
                    band itself carries the brand palette. */}
                <span
                  aria-hidden
                  className={`bg-base-100 inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${color.ink}`}
                >
                  <Icon size={26} strokeWidth={1.6} />
                </span>
                <div className="flex min-w-0 flex-col gap-3.5">
                  {/* `currentColor` inherits the band's `*-content` ink; without
                      it Display stamps `text-base-content`, which is the neutral
                      page ink and unreadable here. */}
                  <Display as="h1" size={46} color="currentColor">
                    {tool.name}.
                  </Display>
                  {/* `text-hero-lede` (24px), not `text-lede` (18px): on the
                      Ember band white measures 4.13:1, so normal-size text
                      misses WCAG AA. 24px clears the large-text bar. See the
                      token's note in globals.css. */}
                  <p className="text-hero-lede m-0 max-w-[660px] font-sans">{tool.tagline}</p>
                  <TrustRow tone="oncolor" />
                </div>
              </div>
            </div>
          </Container>
        </section>

        <Section surface="surface" padding="lg">
          <ModuleProvider module={tool.module}>{children}</ModuleProvider>
        </Section>

        <ToolLearn tool={tool} />
        <ToolLadder tool={tool} />
        <ToolUpsell tool={tool} />
        <RelatedTools currentSlug={tool.slug} />
      </main>
    </>
  );
}
