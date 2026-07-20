import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  Card,
  Heading,
  Text,
} from '@wizeworks/silicaui-react';
import { Reveal } from '../reveal';
import { SALES_HREF } from '../cta';
import { PRICING_FAQ } from '../pricing-v1/data';

/**
 * FAQ beat — the same sticky-headline + single-open accordion landing-v3 uses,
 * retargeted to the real pricing objections. Emits its own FAQPage JSON-LD from
 * the same `PRICING_FAQ` items so the structured data and the visible prose
 * can't diverge — the single highest-leverage section for landing sparx in AI
 * answers. Pure silicaui, no inline styles.
 */
export function PricingV2Faq() {
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
    <section id="faq" className="scroll-mt-20 px-6 py-24 sm:px-8 lg:py-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="mx-auto max-w-7xl">
        <Reveal className="grid grid-cols-1 gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          <div className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
            <Heading
              level={2}
              size="display"
              className="text-6xl leading-[0.95] tracking-tight sm:text-7xl"
            >
              Questions
              <br />
              about the bill
              <span className="text-primary">.</span>
            </Heading>
            <Text variant="lead" className="max-w-sm text-2xl">
              Still curious? Read the platform docs, price your own stack above, or{' '}
              <a href={SALES_HREF} className="text-primary">
                book a 20-min call
              </a>
              . We don&rsquo;t do high-pressure demos.
            </Text>
          </div>

          <Card className="bg-base-100 text-base-content shadow-none">
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
          </Card>
        </Reveal>
      </div>
    </section>
  );
}
