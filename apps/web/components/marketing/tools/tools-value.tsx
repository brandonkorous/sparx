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
    body: 'Storefront, commerce, CRM, CMS, email, and B2B in one place — one login, one bill. Stop renting a dozen disconnected SaaS tools and paying an integrator to wire them together.',
  },
  {
    icon: Database,
    module: 'cms',
    title: 'One source of truth',
    body: 'Every module sits on the same data layer. Orders, customers, content, and campaigns reference the same records — no sync jobs, no Zapier, no version that disagrees with the other version.',
  },
  {
    icon: ToggleRight,
    module: 'commerce',
    title: 'Pay only for what you run',
    body: 'Modules switch on independently. A CMS-only publisher, a CRM-only team, and a B2B distributor are all first-class. No tiers, no seat minimums, no paying for capability you never touch.',
  },
  {
    icon: Sparkles,
    module: 'ai',
    title: 'API-first and AI-native',
    body: 'Every feature is an API endpoint, and a first-class MCP server lets Claude, ChatGPT, or Copilot read and write your live business data in plain English. The dashboard is just one way in.',
  },
];

export function ToolsValue() {
  return (
    <Section surface="page" padding="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        <SectionHeader
          headline="The tools are free. The platform behind them runs your company"
          lede="Every tool here is built on sparx — the modular content and commerce OS. When a free utility isn't enough, the same platform carries the whole business."
          accent={getModuleColor('builder').color}
          headlineSize={38}
        />
        <div className="mkt-grid-2-1">
          {PILLARS.map((pillar) => {
            const color = getModuleColor(pillar.module);
            return (
              <div
                key={pillar.title}
                style={{
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'flex-start',
                  padding: '24px',
                  borderRadius: 'var(--radius-xl)',
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-default)',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '44px',
                    height: '44px',
                    flexShrink: 0,
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: color.tint,
                    color: color.text,
                    boxShadow: 'inset 0 0 0 1px rgba(9, 9, 11, 0.06)',
                  }}
                >
                  <pillar.icon size={22} strokeWidth={1.6} />
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <h3
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 500,
                      fontSize: '17px',
                      letterSpacing: '-0.01em',
                      color: 'var(--color-text-primary)',
                      margin: 0,
                    }}
                  >
                    {pillar.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '14.5px',
                      lineHeight: '23px',
                      color: 'var(--color-text-secondary)',
                      margin: 0,
                    }}
                  >
                    {pillar.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
