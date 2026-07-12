import { Badge, Card, CardBody, CardTitle, Heading, Text } from '@wizeworks/silicaui-react';
import { Container, Spark } from '../primitives';
import { Reveal } from '../reveal';
import { SECTION_DISPLAY_STYLE } from '../landing-v2/heading-style';
import { PRINCIPLES } from './data';

// Device: three quiet principle cards, each led by a soft-primary index badge —
// the type rhythm of the new system, shedding the production page's inline
// dot-bullet blurbs.
export function PricingV1BillingPrinciples() {
  return (
    <section className="px-[var(--gutter-page)] py-[var(--section-py-xl)]">
      <Container style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        <Heading level={2} size="display" style={SECTION_DISPLAY_STYLE}>
          Pricing without the asterisks
          <Spark />
        </Heading>

        <Reveal className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <Card key={p.num}>
              <CardBody className="gap-3">
                <Badge color="primary" variant="soft" size="lg" className="w-fit">
                  {p.num}
                </Badge>
                <CardTitle className="text-xl">{p.title}</CardTitle>
                <Text>{p.body}</Text>
              </CardBody>
            </Card>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}
