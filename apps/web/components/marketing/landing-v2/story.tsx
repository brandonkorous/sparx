import { Badge, Card, CardBody, CardTitle, Heading, Text } from '@wizeworks/silicaui-react';
import { Container } from '../primitives';
import { SECTION_DISPLAY_STYLE } from './heading-style';

// The "pain" beat — a sticky headline column paired with a stack of real
// silicaui Cards (Badge for the index, CardTitle/Text for copy) instead of a
// hand-rolled bordered list.

const PAINS = [
  {
    num: '01',
    title: 'Your customers live in one app. Their order lives in another.',
    body: 'Every disconnected tool is another place to search, another bill to pay, and another chance for something important to fall through.',
  },
  {
    num: '02',
    title: '"Simple" software made you the IT department.',
    body: 'Evenings go to syncing lists, patching automations, updating stock counts, and figuring out which report is actually telling the truth.',
  },
  {
    num: '03',
    title: 'Growth means bolting on another subscription — and another login.',
    body: 'Your business should get more capable as it grows, not more fragmented. sparx replaces the stack with one connected system instead.',
  },
];

export function LandingV2Story() {
  return (
    <section className="px-[var(--gutter-page)] py-[var(--section-py-xl)]">
      <Container>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          <div className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
            <Heading level={2} size="display" style={SECTION_DISPLAY_STYLE}>
              Your business grew.
              <br />
              So did the mess.
            </Heading>
            <Text variant="lead" className="max-w-sm">
              Every tool you add to keep up ends up working against you. Here&apos;s the version of
              that story most owners recognize.
            </Text>
          </div>

          <div className="flex flex-col gap-4">
            {PAINS.map((p) => (
              <Card key={p.num}>
                <CardBody>
                  <div className="flex items-start gap-5">
                    <Badge color="neutral" variant="soft" size="lg" className="shrink-0">
                      {p.num}
                    </Badge>
                    <div className="flex flex-col gap-2">
                      <CardTitle className="text-2xl">{p.title}</CardTitle>
                      <Text className="max-w-xl">{p.body}</Text>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
