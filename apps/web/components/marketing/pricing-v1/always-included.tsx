import { Card, CardBody, CardTitle, Heading, Text } from '@wizeworks/silicaui-react';
import { Container, Spark } from '../primitives';
import { Reveal } from '../reveal';
import { SECTION_DISPLAY_STYLE } from '../landing-v2/heading-style';
import { INCLUDED } from './data';

// Device: a recessed STAGE shelf of eight real silicaui cards — the platform
// floor reads as one physical object set back from the reading surface, so "you
// pay for modules, this comes with all of them" lands as layout, not a claim.
export function PricingV1AlwaysIncluded() {
  return (
    <section className="mkt-stage px-[var(--gutter-page)] py-[var(--section-py-xl)]">
      <Container style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        <div className="max-w-3xl">
          <Heading level={2} size="display" style={SECTION_DISPLAY_STYLE}>
            Every plan ships with the platform
            <Spark />
          </Heading>
          <Text variant="lead" className="mt-5 max-w-xl">
            You pay for modules. Everything underneath them — the hosting, the security, the API —
            is included on every plan, from one module to all twelve.
          </Text>
        </div>

        <Reveal className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INCLUDED.map((it) => {
            const Icon = it.icon;
            return (
              <Card key={it.title}>
                <CardBody className="gap-3">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor:
                        'color-mix(in oklab, var(--color-primary) 12%, var(--color-base-100))',
                    }}
                  >
                    <Icon size={20} strokeWidth={2} color="var(--color-primary)" aria-hidden />
                  </span>
                  <CardTitle className="text-base">{it.title}</CardTitle>
                  <Text className="text-sm">{it.body}</Text>
                </CardBody>
              </Card>
            );
          })}
        </Reveal>
      </Container>
    </section>
  );
}
