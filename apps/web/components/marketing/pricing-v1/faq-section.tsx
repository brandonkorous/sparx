import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  Heading,
  Text,
} from '@wizeworks/silicaui-react';
import { Container, Spark } from '../primitives';
import { Reveal } from '../reveal';
import { SALES_HREF } from '../cta';
import { SECTION_DISPLAY_STYLE } from '../landing-v2/heading-style';
import { PRICING_FAQ } from './data';

// Device: the same sticky-headline + single-open accordion the homepage's FAQ
// uses, retargeted to the six real pricing objections. Emits its own FAQPage
// JSON-LD from the same items so the structured data and the prose can't diverge
// — the single highest-leverage section for landing sparx in AI answers.
export function PricingV1Faq() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: PRICING_FAQ.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  const firstOpen = PRICING_FAQ[0]?.id;

  return (
    <section
      id="faq"
      className="px-[var(--gutter-page)] py-[var(--section-py-xl)]"
      style={{ scrollMarginTop: '80px' }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Container>
        <Reveal className="grid grid-cols-1 gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          <div className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
            <Heading level={2} size="display" style={SECTION_DISPLAY_STYLE}>
              Questions about the bill
              <Spark />
            </Heading>
            <Text variant="lead" className="max-w-sm">
              Still curious? Read the platform docs, browse the API spec, or{' '}
              <a
                href={SALES_HREF}
                style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
              >
                book a 20-min call
              </a>
              . We don&rsquo;t do high-pressure demos.
            </Text>
          </div>

          <Accordion defaultValue={firstOpen ? [firstOpen] : []}>
            {PRICING_FAQ.map((item) => (
              <AccordionItem key={item.id} value={item.id}>
                <AccordionTrigger className="text-lg">{item.question}</AccordionTrigger>
                <AccordionPanel>
                  <Text>{item.answer}</Text>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </Container>
    </section>
  );
}
