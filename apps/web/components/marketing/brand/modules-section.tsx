import { Section, SectionHeader } from '../primitives';
import { CopyValue } from './interactive';

interface ModuleColor {
  module: string;
  colorName: string;
  hex: string;
  token: string;
  why: string;
}

const MODULES: ModuleColor[] = [
  {
    module: 'Site / Builder',
    colorName: 'Indigo',
    hex: '#6366F1',
    token: '--module-builder',
    why: 'The platform color — the site is the foundation.',
  },
  {
    module: 'Commerce',
    colorName: 'Orange',
    hex: '#F97316',
    token: '--module-commerce',
    why: 'Action, conversion, energy — every “Buy Now” ever.',
  },
  {
    module: 'CMS',
    colorName: 'Teal',
    hex: '#14B8A6',
    token: '--module-cms',
    why: 'Editorial, calm, focused — content-creation energy.',
  },
  {
    module: 'CRM',
    colorName: 'Cyan',
    hex: '#06B6D4',
    token: '--module-crm',
    why: 'Connective, relational, people-centric.',
  },
  {
    module: 'Email',
    colorName: 'Sky',
    hex: '#0EA5E9',
    token: '--module-email',
    why: 'Communication, reach, delivery.',
  },
  {
    module: 'B2B / Wholesale',
    colorName: 'Slate',
    hex: '#475569',
    token: '--module-b2b',
    why: 'Serious, industrial, business-grade.',
  },
  {
    module: 'AI / MCP',
    colorName: 'Rose',
    hex: '#EC4899',
    token: '--module-ai',
    why: 'Premium, intelligent, unexpected — different in kind.',
  },
  {
    module: 'Dropship',
    colorName: 'Emerald',
    hex: '#10B981',
    token: '--module-dropship',
    why: 'Growth, supply chain, organic.',
  },
  {
    module: 'Invoicing',
    colorName: 'Lime',
    hex: '#65A30D',
    token: '--module-invoicing',
    why: 'Getting paid — cashflow, money in.',
  },
  {
    module: 'Inventory',
    colorName: 'Amber',
    hex: '#F59E0B',
    token: '--module-inventory',
    why: 'Stock, supply, the warehouse.',
  },
  {
    module: 'Live Chat',
    colorName: 'Violet',
    hex: '#8B5CF6',
    token: '--module-chat',
    why: 'Conversational, responsive, human.',
  },
  {
    module: 'Automations',
    colorName: 'Fuchsia',
    hex: '#D946EF',
    token: '--module-automations',
    why: 'Workflows firing — work happening on its own.',
  },
  {
    module: 'SEO',
    colorName: 'Yellow',
    hex: '#EAB308',
    token: '--module-seo',
    why: 'Visibility, getting found, daylight.',
  },
];

export function ModulesSection() {
  return (
    <Section id="modules" surface="page" padding="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        <SectionHeader
          accent="var(--module-commerce)"
          headline={
            <>
              Thirteen modules.{' '}
              <span style={{ color: 'var(--color-text-tertiary)' }}>One color each</span>
            </>
          }
          lede="Every module owns a single hue, and it shows up identically in three places: the module’s marketing site, its nav item in the dashboard, and the 3px stripe on every card inside it. The stripe tells a tenant where they are without a single label."
        />

        <div className="mkt-grid-4-2-1">
          {MODULES.map((m) => (
            <div
              key={m.module}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                padding: '20px',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-default)',
                borderTop: `3px solid ${m.hex}`,
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div
                style={{
                  height: '56px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: m.hex,
                  boxShadow: 'inset 0 0 0 1px rgba(9,9,11,0.08)',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    fontSize: '15px',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {m.module}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '12.5px',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  {m.colorName}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <CopyValue value={m.hex} tone="strong" />
                <CopyValue value={m.token} />
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '12.5px',
                  lineHeight: '18px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {m.why}
              </span>
            </div>
          ))}
        </div>

        <div className="mkt-grid-2-1">
          <Callout accent="#EC4899" title="The AI / MCP exception">
            Rose stays reserved for AI / MCP even though the palette has since grown to cover the
            full spectrum. Every other AI product reached for purple, teal, or blue; rose is unused
            in B2B SaaS AI branding and signals “different in kind” — the module that thinks, not
            just functions. sparx Indigo + Rose is near-complementary, so it reads as hierarchy.
          </Callout>
          <Callout accent="#F59E0B" title="When a module color is also a semantic hue">
            Inventory’s Amber is the warning hue, so inside Inventory, stock alerts use danger/red
            to stay distinct from the module chrome. On a solid Amber or Yellow fill (Inventory,
            SEO), text and icons use dark ink — white fails AA. Warning, danger, and success keep
            their meaning on every surface, in every module.
          </Callout>
        </div>
      </div>
    </Section>
  );
}

function Callout({
  accent,
  title,
  children,
}: {
  accent: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '28px',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 'var(--radius-xl)',
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: '16px',
          color: 'var(--color-text-primary)',
          margin: 0,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '14px',
          lineHeight: '22px',
          color: 'var(--color-text-secondary)',
          margin: 0,
        }}
      >
        {children}
      </p>
    </div>
  );
}
