import * as React from 'react';
import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';
import { Section, SectionHeader, Text } from '../primitives';
import { CopyValue } from './interactive';

interface Role {
  role: string;
  specimen: React.ReactNode;
  specs: string[];
  use: string;
}

const ROLES: Role[] = [
  {
    role: 'Display',
    specimen: (
      <span className="font-sans text-[clamp(34px,5vw,52px)] leading-[1.05] font-medium tracking-[-0.025em]">
        Everything, ignited.
      </span>
    ),
    specs: ['Geist', '500', '-0.025em'],
    use: 'Page titles, hero headings.',
  },
  {
    role: 'Heading',
    specimen: (
      <span className="font-sans text-[24px] leading-[1.25] font-medium tracking-normal">
        Activate only what you need
      </span>
    ),
    specs: ['Geist', '500', '0 tracking'],
    use: 'Section headers, card titles.',
  },
  {
    role: 'Body',
    specimen: (
      <span className="font-sans text-[17px] leading-[1.6] font-normal">
        sparx lets typography do the heavy lifting — no decorative elements, no gradients. White
        space is intentional, and every element has a reason to exist.
      </span>
    ),
    specs: ['Geist', '400', '1.6 leading'],
    use: 'Descriptive copy, supporting text.',
  },
  {
    role: 'Label',
    specimen: <span className="font-sans text-sm font-medium">Badge · metadata</span>,
    // This row used to specify 11px + 0.08em + uppercase — the micro-cap
    // treatment. It is gone brand-wide, so the specimen no longer teaches it:
    // a label is sentence case at the caption size, and weight carries it.
    specs: ['Geist', '500', 'sentence case'],
    use: 'Badges and metadata. Never above a heading.',
  },
];

export function TypeSection() {
  return (
    <Section id="type" surface="page" padding="lg">
      <div className="flex flex-col gap-12">
        <SectionHeader
          accent="var(--color-module-cms)"
          headline="Geist, doing the heavy lifting"
          lede="Geist is Vercel’s open-source interface typeface — geometric precision with editorial warmth. Hierarchy comes from size and spacing, never from heavy weights."
        />

        <div className="flex flex-col">
          {ROLES.map((r, i) => (
            <div
              key={r.role}
              className={`flex items-baseline justify-between gap-6 py-7 max-lg:flex-col ${i === 0 ? '' : 'border-base-300 border-t'}`}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-3.5">
                <Text as="span" size={13}>
                  {r.role}
                </Text>
                {r.specimen}
              </div>
              <div className="flex min-w-[220px] flex-col gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {r.specs.map((s) => (
                    <Badge key={s} variant="soft" size="sm" className="font-mono">
                      {s}
                    </Badge>
                  ))}
                </div>
                <Text as="span" size={13}>
                  {r.use}
                </Text>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Note title="Two weights only">
            400 (regular) and 500 (medium) — never 600 or 700, which feel heavy against the clean
            sparx UI. The wordmark is the one deliberate exception: it sets in a bold display face
            so its letterforms match the mark.
          </Note>
          <Note title="Fallback stack">
            <div className="flex flex-wrap items-center gap-2">
              <CopyValue value="'Geist', 'Inter', system-ui, -apple-system, sans-serif" />
              <CopyValue value="--font-mono" />
            </div>
          </Note>
        </div>
      </div>
    </Section>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <Text as="h3" size={15} weight={500}>
          {title}
        </Text>
        <Text as="div" size={14}>
          {children}
        </Text>
      </CardBody>
    </Card>
  );
}
