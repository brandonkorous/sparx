import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';
import { Section, SectionHeader, Text } from '../primitives';
import { CopyValue } from './interactive';

interface ModuleColor {
  module: string;
  colorName: string;
  hex: string;
  token: string;
  /** The silica color utility for this module, as a LITERAL string so Tailwind's
   *  scanner emits it (a computed `bg-module-${x}` would never be generated).
   *  Stack with `bg-soft` for the 15% wash — no hand-rolled color-mix. */
  bg: string;
  why: string;
}

const MODULES: ModuleColor[] = [
  {
    module: 'Site / Builder',
    colorName: 'Indigo',
    hex: '#6366F1',
    token: '--color-module-builder',
    bg: 'bg-module-builder',
    why: 'The site-building foundation — where every tenant starts.',
  },
  {
    module: 'Commerce',
    colorName: 'Orange',
    hex: '#F97316',
    token: '--color-module-commerce',
    bg: 'bg-module-commerce',
    why: 'Action, conversion, energy — every “Buy Now” ever.',
  },
  {
    module: 'CMS',
    colorName: 'Teal',
    hex: '#14B8A6',
    token: '--color-module-cms',
    bg: 'bg-module-cms',
    why: 'Editorial, calm, focused — content-creation energy.',
  },
  {
    module: 'CRM',
    colorName: 'Cyan',
    hex: '#06B6D4',
    token: '--color-module-crm',
    bg: 'bg-module-crm',
    why: 'Connective, relational, people-centric.',
  },
  {
    module: 'Email',
    colorName: 'Sky',
    hex: '#0EA5E9',
    token: '--color-module-email',
    bg: 'bg-module-email',
    why: 'Communication, reach, delivery.',
  },
  {
    module: 'B2B / Wholesale',
    colorName: 'Slate',
    hex: '#475569',
    token: '--color-module-b2b',
    bg: 'bg-module-b2b',
    why: 'Serious, industrial, business-grade.',
  },
  {
    module: 'AI',
    colorName: 'Pink',
    hex: '#EC4899',
    token: '--color-module-ai',
    bg: 'bg-module-ai',
    why: 'Premium, intelligent, unexpected — different in kind.',
  },
  {
    module: 'Dropship',
    colorName: 'Emerald',
    hex: '#10B981',
    token: '--color-module-dropship',
    bg: 'bg-module-dropship',
    why: 'Growth, supply chain, organic.',
  },
  {
    module: 'Invoicing',
    colorName: 'Lime',
    hex: '#65A30D',
    token: '--color-module-invoicing',
    bg: 'bg-module-invoicing',
    why: 'Getting paid — cashflow, money in.',
  },
  {
    module: 'Inventory',
    colorName: 'Amber',
    hex: '#F59E0B',
    token: '--color-module-inventory',
    bg: 'bg-module-inventory',
    why: 'Stock, supply, the warehouse.',
  },
  {
    module: 'Live Chat',
    colorName: 'Violet',
    hex: '#8B5CF6',
    token: '--color-module-chat',
    bg: 'bg-module-chat',
    why: 'Conversational, responsive, human.',
  },
  {
    module: 'Scheduling',
    colorName: 'Rose',
    hex: '#F43F5E',
    token: '--color-module-scheduling',
    bg: 'bg-module-scheduling',
    why: 'Time, rhythm, the calendar — booking and cadence.',
  },
  {
    module: 'Automations',
    colorName: 'Fuchsia',
    hex: '#D946EF',
    token: '--color-module-automations',
    bg: 'bg-module-automations',
    why: 'Workflows firing — work happening on its own.',
  },
  {
    module: 'SEO',
    colorName: 'Yellow',
    hex: '#EAB308',
    token: '--color-module-seo',
    bg: 'bg-module-seo',
    why: 'Visibility, getting found, daylight.',
  },
];

export function ModulesSection() {
  return (
    <Section id="modules" surface="page" padding="lg">
      <div className="flex flex-col gap-12">
        <SectionHeader
          accent="var(--color-module-commerce)"
          headline={
            <>
              Fourteen modules. <span className="text-ink-subtle">One color each</span>
            </>
          }
          lede="Every module owns a single hue, and it surfaces identically in three places: the module’s marketing site, its nav item in the dashboard, and a soft color-mix wash on its cards. One softly-tinted card per module tells a tenant where they are — quiet wayfinding, no loud stripe and no label required."
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => (
            // Legend exception: a module catalog is the one place a per-card tint
            // reads as a color key rather than the "wall of washes" the rule bans
            // elsewhere — every card legitimately IS its module. The wash is
            // silica's own `bg-soft` treatment stacked on the module color, not a
            // hand-rolled color-mix.
            <Card key={m.module} className={`${m.bg} bg-soft`}>
              <CardBody className="flex flex-col gap-4">
                <div className={`h-14 rounded-md ${m.bg}`} />
                <div className="flex flex-col gap-2">
                  <Text as="span" size={15} weight={500} tone="default">
                    {m.module}
                  </Text>
                  <Badge variant="soft" size="sm" className="self-start font-sans">
                    {m.colorName}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <CopyValue value={m.hex} tone="strong" />
                  <CopyValue value={m.token} />
                </div>
                <Text as="span" size={12.5}>
                  {m.why}
                </Text>
              </CardBody>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Callout bg="bg-module-ai" title="The AI exception">
            Pink stays reserved for AI even though the palette has since grown to cover the full
            spectrum. Every other AI product reached for purple, teal, or blue; pink is unused in
            B2B SaaS AI branding and signals “different in kind”. Builder Indigo + Pink is
            near-complementary, so it reads as hierarchy. (Rose is Scheduling’s hue, not AI’s — a
            neighbouring red that stays distinct because the two never share a surface.)
          </Callout>
          <Callout bg="bg-module-inventory" title="When a module color is also a semantic hue">
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

/**
 * Module-accented callout. Carries its module hue as silica's `bg-soft` wash —
 * NOT a 3px side stripe: the stripe is a retired brand device (and the single
 * most recognizable AI-generated-UI tell). `bg` is a literal utility class so
 * Tailwind's scanner emits it.
 */
function Callout({
  bg,
  title,
  children,
}: {
  bg: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={`${bg} bg-soft`}>
      <CardBody className="flex flex-col gap-3">
        <Text as="h3" size={16} weight={500} tone="default">
          {title}
        </Text>
        <Text size={14}>{children}</Text>
      </CardBody>
    </Card>
  );
}
