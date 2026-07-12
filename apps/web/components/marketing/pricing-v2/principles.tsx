import { Badge, Card, CardBody, CardTitle, Heading, Text } from '@wizeworks/silicaui-react';
import { Reveal } from '../reveal';
import { PRINCIPLES } from '../pricing-v1/data';

/**
 * "Pricing without the asterisks." — three quiet principle cards, each led by a
 * soft-primary index badge (the same numbered-badge device landing-v3's story
 * uses for its pain points). Pure silicaui, no inline styles.
 */
export function PricingV2Principles() {
  return (
    <section className="px-6 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto flex max-w-7xl flex-col gap-12">
        <Heading
          level={2}
          size="display"
          className="text-6xl leading-[0.95] tracking-tight sm:text-7xl"
        >
          Pricing without
          <br />
          the asterisks
          <span className="text-primary">.</span>
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
      </div>
    </section>
  );
}
