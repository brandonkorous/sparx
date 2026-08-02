import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  Card,
  CardBody,
} from '@wizeworks/silicaui-react';
import { Section, SectionHeader, Text, getModuleColor } from '../primitives';
import { getToolContent } from './tool-content';
import { getToolSeo } from './tool-seo';
import type { ToolMeta } from './registry';

/**
 * Per-tool "good to know" section — the visible counterpart to the structured
 * data in ToolJsonLd. Leads with a crisp, quotable answer (featured-snippet /
 * AI-overview food), then explainers, a visible numbered how-to, and an FAQ.
 * Google requires HowTo/FAQ content to be visible on the page; this provides it.
 */
export function ToolLearn({ tool }: { tool: ToolMeta }) {
  const content = getToolContent(tool.slug);
  const seo = getToolSeo(tool.slug);
  if (!content) return null;
  const color = getModuleColor(tool.module);

  return (
    <Section surface="page" padding="lg">
      <div className="flex flex-col gap-10">
        <SectionHeader
          headline={content.heading ?? 'Good to know'}
          lede={seo?.answer}
          accent={color.color}
          headlineSize={32}
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {content.points.map((point) => (
            <Card key={point.title}>
              <CardBody className="gap-2">
                <Text as="h3" size={16} weight={500}>
                  {point.title}
                </Text>
                <Text size={15}>{point.body}</Text>
              </CardBody>
            </Card>
          ))}
        </div>

        {seo?.howTo ? <HowTo name={seo.howTo.name} steps={seo.howTo.steps} color={color} /> : null}

        <div className="flex flex-col gap-3">
          <Text as="h3" size={18} weight={500}>
            Frequently asked
          </Text>
          <Accordion className="max-w-3xl">
            {content.faq.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionPanel>
                  <Text size={15}>{item.a}</Text>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </Section>
  );
}

/** Visible numbered how-to — the on-page counterpart to the HowTo JSON-LD. */
function HowTo({
  name,
  steps,
  color,
}: {
  name: string;
  steps: { name: string; text: string }[];
  color: ReturnType<typeof getModuleColor>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Text as="h3" size={18} weight={500}>
        {name}
      </Text>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {steps.map((step, i) => (
          <li key={step.name} className="flex items-start gap-3.5">
            <span
              aria-hidden
              className={`${color.bg} bg-soft ${color.ink} inline-flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full font-sans text-sm font-semibold`}
            >
              {i + 1}
            </span>
            <Text size={15}>
              <strong className="font-medium">{step.name}.</strong> {step.text}
            </Text>
          </li>
        ))}
      </ol>
    </div>
  );
}
