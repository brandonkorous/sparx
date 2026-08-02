import * as React from 'react';
import { Badge, Heading, Text } from '@wizeworks/silicaui-react';
import { ModuleProvider } from '@sparx/ui';
import { getModule } from '@/lib/modules';
import { Band } from '../band';
import { getModuleColor } from '../primitives';
import type { ToolMeta } from './registry';
import { ToolLadder } from './tool-ladder';
import { ToolUpsell } from './tool-upsell';
import { ToolLearn } from './tool-learn';
import { ToolJsonLd } from './tool-jsonld';
import { RelatedTools } from './related-tools';
import { TrustRow } from './trust-row';

/**
 * Shared page frame for every tool. Server-rendered chrome (hero, ladder CTA,
 * related strip) wraps the interactive client tool passed as `children`; Nav and
 * Footer come from the root layout. The tool area stays wrapped in
 * `<ModuleProvider>` so its controls adopt the module hue — silica has no
 * equivalent, so that one `@sparx/ui` import stays.
 *
 * ## The hero used to pick its colour by hashing the URL
 *
 * ```js
 * function heroTone(slug) {                       // ← deleted
 *   let hash = 0;
 *   for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
 *   return HERO_TONES[hash % HERO_TONES.length];  // primary | secondary | accent
 * }
 * ```
 *
 * Every tool page got a full-bleed `primary`, `secondary` or `accent` band
 * assigned pseudo-randomly, which is decoration by definition — the hue carried
 * no information. Worse, it CONTRADICTED the rest of the page: every tool
 * declares a `module`, the hub card shows that module's badge, and
 * `ModuleProvider` paints the controls with it. Measured on /tools/qr-code the
 * band was `rgb(54,210,255)` (accent cyan) while the tool's own `--color-module`
 * was `#F97316` and its active control rendered orange. One tool, two colour
 * stories, one scroll apart.
 *
 * ## And the band could not carry normal-size text
 *
 * The file this replaces admitted as much, twice, in comments: *"white on the
 * Ember band is 4.13:1, under WCAG AA for normal-size text. 24px clears the
 * large-text bar."* The fix for an illegible surface was to size the type up
 * until it qualified for the lower threshold — which is also why every tagline
 * had to be a 24px sentence.
 *
 * ## What it is now
 *
 * The house dark hero, the same one /features, /pricing and /partners open on,
 * so eighteen tool pages read as one family instead of a three-colour lottery.
 * The module hue stays, as a HIGHLIGHT rather than a wash: it fills the icon
 * chip (a shape, so legible at any hue), names the module in a solid badge, and
 * inks the closing period. On the dark island those hues sit well clear of AA,
 * where as a full-bleed background they were the thing forcing 24px type.
 */
export function ToolShell({ tool, children }: { tool: ToolMeta; children: React.ReactNode }) {
  const color = getModuleColor(tool.module);
  const mod = getModule(tool.module);
  const Icon = tool.icon;

  return (
    <>
      <ToolJsonLd tool={tool} />
      <main>
        <Band tone="dark" flush>
          <div className="flex flex-col gap-12">
            <div className="flex flex-col gap-7">
              <nav aria-label="Breadcrumb" className="flex items-center gap-2">
                <a href="/tools" className="text-md text-primary font-medium">
                  Free tools
                </a>
                <span aria-hidden className="text-md">
                  /
                </span>
                <span className="text-md font-medium">{tool.name}</span>
              </nav>

              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                {/* Fill + its PAIRED ink, as one choice. A module hue is a FILL
                    colour — several measure ~2:1 as text — so the way to show one
                    at size is to fill a shape and write on top in its own
                    `-content`. */}
                <span
                  aria-hidden
                  className={`inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${color.bg} ${color.content}`}
                >
                  <Icon size={30} strokeWidth={1.6} />
                </span>

                <div className="flex min-w-0 flex-col items-start gap-5">
                  <Heading
                    level={1}
                    size="display"
                    className="text-5xl leading-[0.98] tracking-tight sm:text-6xl"
                  >
                    {tool.name}
                    <span className={color.ink}>.</span>
                  </Heading>
                  {/* `text-xl`, not the old `text-2xl`. That size was a contrast
                      workaround for the brand band, not a typographic decision;
                      on the dark island a normal lede is legible on its own. */}
                  <Text variant="lead" className="text-base-content max-w-2xl text-xl">
                    {tool.tagline}
                  </Text>
                  {mod ? (
                    <Badge color={`module-${tool.module}`} variant="solid" size="lg">
                      {`Part of ${mod.label}`}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>

            <TrustRow />
          </div>
        </Band>

        <Band tone="page">
          <ModuleProvider module={tool.module}>{children}</ModuleProvider>
        </Band>

        <ToolLearn tool={tool} />
        <ToolLadder tool={tool} />
        <ToolUpsell tool={tool} />
        <RelatedTools currentSlug={tool.slug} />
      </main>
    </>
  );
}
