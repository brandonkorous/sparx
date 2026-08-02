import { Layers, Database, ToggleRight, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Section, SectionHeader, getModuleColor } from '../primitives';
import type { MarketingModule } from '../primitives';

/**
 * Hub value section — sits between the tools grid and the platform CTA. The
 * tools earn the visit; this makes the case for the platform behind them, in
 * the product's own language (CLAUDE.md "what this product is" + the
 * non-obvious conventions). Each pillar wears a different module color so the
 * section reads as the colorful, modular platform it describes.
 */
interface Pillar {
  icon: LucideIcon;
  module: MarketingModule;
  title: string;
  body: string;
}

const PILLARS: Pillar[] = [
  {
    icon: Layers,
    module: 'builder',
    title: 'One platform, not twelve tabs',
    body: 'Your site, content, CRM, email, commerce, and B2B live in one place — one login, one bill. Stop renting a dozen disconnected tools and paying someone to wire them together.',
  },
  {
    icon: Database,
    module: 'cms',
    title: 'One source of truth',
    body: 'Every module sits on the same data. A customer, a page, an order, a campaign — one record, read everywhere. No sync jobs, no Zapier, no version that disagrees with the other version.',
  },
  {
    icon: ToggleRight,
    module: 'commerce',
    title: 'Pay only for what you switch on',
    body: 'Modules turn on independently. Run CMS on its own, CRM on its own, or the full stack — all of it first-class. No tiers, no seat minimums, no paying for capability you never touch.',
  },
  {
    icon: Sparkles,
    module: 'ai',
    title: 'API-first and AI-native',
    body: "Every feature is an API, and a built-in MCP server lets Claude, ChatGPT, or Copilot read and write your live business data in plain English. Ask for it; it's done. The dashboard is just one way in.",
  },
];

export function ToolsValue() {
  return (
    <Section surface="page" padding="lg">
      <div className="flex flex-col gap-10">
        <SectionHeader
          headline="The tools are free. The platform behind them runs the whole business"
          lede="Every tool here is built on sparx — one platform for your website, your content, and, when you sell, your commerce. Activate the modules you need, on one login, one bill, and one data layer. Publish a content site with no checkout, run a CRM on its own, or sell to the world. It's all first-class."
          accent={getModuleColor('builder').color}
          headlineSize={38}
        />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {PILLARS.map((pillar) => {
            const color = getModuleColor(pillar.module);
            return (
              // The surface is silica's card (plugin-emitted `card`/`card-body`
              // classes — this is a Server Component, and the silicaui-react
              // barrel is `'use client'`).
              <div key={pillar.title} className="card">
                <div className="card-body flex-row items-start gap-4">
                  <span
                    aria-hidden
                    className={`ring-base-300 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${color.bg} bg-soft ${color.ink}`}
                  >
                    <pillar.icon size={22} strokeWidth={1.6} />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <h3 className="m-0 font-sans text-lg font-medium tracking-tight">
                      {pillar.title}
                    </h3>
                    <p className="text-md m-0 font-sans">{pillar.body}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
