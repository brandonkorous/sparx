import { ArrowRight } from 'lucide-react';
// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's unconditional `cloneElement(render, …)` then throws
// "Element type is invalid … got: undefined" during prerender.
import { Heading, Text } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Band } from '../band';
import { getModule } from '@/lib/modules';
import type { ToolMeta } from './registry';

/**
 * Per-tool upsell — sits between the ladder CTA and the "more tools" strip. The
 * ladder is the hook ("your whole site, not just its favicon"); this is the
 * proof. It pulls three real capabilities from the module's own feature list
 * (lib/modules.ts), so the copy never drifts from what actually ships, then
 * frames the module inside the wider platform.
 */
export function ToolUpsell({ tool }: { tool: ToolMeta }) {
  const mod = getModule(tool.module);
  if (!mod) return null;
  const shortLabel = mod.label.split('·')[0]!.trim();
  const features = mod.features.slice(0, 3);

  return (
    <Band tone="surface">
      <div className="flex flex-col gap-9">
        <div className="flex flex-col gap-4">
          <Heading level={2} size="display" className="text-4xl tracking-tight sm:text-5xl">
            {`What you get with sparx ${shortLabel}`}
            {/* `text-primary`, not the module ink: these headings sit on a
                LIGHT band, where a module hue is a ~2.4:1 fill pretending to
                be ink. The module hue belongs on the dark hero and on fills. */}
            <span className="text-primary">.</span>
          </Heading>
          <Text variant="lead" className="max-w-3xl">
            {mod.lede}
          </Text>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            // The surface is silica's card (the plugin-emitted `card`/`card-body`
            // classes, not the React `Card` — this is a Server Component and the
            // whole silicaui-react barrel is `'use client'`).
            <div key={feature.number} className="card bg-base-200">
              <div className="card-body gap-2.5">
                {/* The `01` / `02` / `03` mono marker that sat here is gone.
                    A numbered label introducing a heading is the eyebrow slot
                    however it is dressed (RULE #2 bans the SLOT), these three
                    features are not a sequence, and at `text-module-*` on white
                    it measured 2.8:1 anyway. */}
                <h3 className="m-0 font-sans text-lg font-medium tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-md m-0 font-sans">{feature.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-4">
          <p className="text-md m-0 max-w-[560px] font-sans">
            {shortLabel} is one module on the sparx platform — activate it alongside sites, CRM,
            CMS, email, and B2B on one data layer and one bill. Only pay for what you run.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <a
              href="/platform"
              aria-label="Explore the platform"
              className={buttonClasses({ color: tool.module, variant: 'solid', size: 'md' })}
            >
              Explore the platform
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/pricing"
              aria-label="See pricing"
              className={buttonClasses({ color: 'neutral', variant: 'outline', size: 'md' })}
            >
              See pricing
            </a>
          </div>
        </div>
      </div>
    </Band>
  );
}
