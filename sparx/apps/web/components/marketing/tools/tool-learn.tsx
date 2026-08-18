import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  Card,
  CardBody,
  Heading,
  Text,
} from '@wizeworks/silicaui-react';
import { Band } from '../band';
import { getModuleColor } from '../primitives';
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
    <Band tone="surface">
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <Heading level={2} size="display" className="text-4xl tracking-tight sm:text-5xl">
            {content.heading ?? 'Good to know'}
            {/* `text-primary`, not the module ink: these headings sit on a
                LIGHT band, where a module hue is a ~2.4:1 fill pretending to
                be ink. The module hue belongs on the dark hero and on fills. */}
            <span className="text-primary">.</span>
          </Heading>
          {seo?.answer ? (
            <Text variant="lead" className="max-w-3xl">
              {seo.answer}
            </Text>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {content.points.map((point) => (
            <Card key={point.title} className="bg-base-200">
              <CardBody className="gap-2">
                <Heading level={3} size={5} className="tracking-tight">
                  {point.title}
                </Heading>
                <Text className="text-md">{point.body}</Text>
              </CardBody>
            </Card>
          ))}
        </div>

        {seo?.howTo ? <HowTo name={seo.howTo.name} steps={seo.howTo.steps} color={color} /> : null}

        <div className="flex flex-col gap-3">
          <Heading level={3} size={4} className="tracking-tight">
            Frequently asked
          </Heading>
          <Accordion className="max-w-3xl">
            {content.faq.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionPanel>
                  <Text className="text-md">{item.a}</Text>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </Band>
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
      <Heading level={3} size={4} className="tracking-tight">
        {name}
      </Heading>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {steps.map((step, i) => (
          <li key={step.name} className="flex items-start gap-3.5">
            <span
              aria-hidden
              // Solid fill + its PAIRED ink. This was `${color.bg} bg-soft
              // ${color.ink}` — the hue as text over a 15% tint of itself, which
              // measured 2.43:1 here. A step number nobody can read is not a step
              // number.
              className={`${color.bg} ${color.content} text-md inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-semibold`}
            >
              {i + 1}
            </span>
            <Text className="text-md">
              <strong className="font-medium">{`${step.name}.`}</strong> {step.text}
            </Text>
          </li>
        ))}
      </ol>
    </div>
  );
}
