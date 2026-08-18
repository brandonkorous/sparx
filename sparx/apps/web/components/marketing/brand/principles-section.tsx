import { Card, CardBody } from '@wizeworks/silicaui-react';
import { Section, SectionHeader, Text } from '../primitives';

const PRINCIPLES: { n: string; title: string; body: string }[] = [
  {
    n: '01',
    title: 'Flat by default',
    body: 'No gradients, drop shadows, or blur — except a functional focus ring. Depth comes from border contrast, never from elevation.',
  },
  {
    n: '02',
    title: 'Minimal chrome',
    body: 'The UI gets out of the way of the tenant’s work. Navigation is always visible but never dominant. Empty states are helpful, not decorative.',
  },
  {
    n: '03',
    title: 'One tinted card per module',
    body: 'A module’s color surfaces as a soft tint on a single lead card per section — a color-mix wash, never a loud stripe. One tinted card is wayfinding; a wall of them is noise, so the rest of the cards stay neutral.',
  },
  {
    n: '04',
    title: 'Module isolation',
    body: 'Work inside the CMS and the accents shift to teal; switch to AI and they shift to rose. The color transition reinforces context and makes the system feel coherent.',
  },
  {
    n: '05',
    title: 'Progressive disclosure',
    body: 'Advanced features — API keys, webhooks, MCP config, B2B pricing rules — exist but stay hidden from a new tenant. The five-minute path to a live site is always clear.',
  },
  {
    n: '06',
    title: 'Mobile-first, always',
    body: 'Every surface works from a 320px phone to a 2560px monitor. Display type uses fluid clamp() scaling; layouts reflow, they never just shrink.',
  },
];

export function PrinciplesSection() {
  return (
    <Section id="principles" surface="surface" padding="lg">
      <div className="flex flex-col gap-12">
        <SectionHeader
          accent="var(--color-primary)"
          headline="Six principles that hold it together"
          lede="The brand is a set of decisions as much as a set of colors. These are the rules that make a sparx surface feel like sparx, whatever module you’re in."
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <Card key={p.n} className="bg-base-200">
              <CardBody className="flex flex-col gap-3.5">
                <Text as="span" size={12} mono>
                  {p.n}
                </Text>
                <Text as="h3" size={18} weight={500} className="tracking-[-0.01em]">
                  {p.title}
                </Text>
                <Text size={14}>{p.body}</Text>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </Section>
  );
}
