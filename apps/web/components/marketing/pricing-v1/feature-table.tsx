import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  Badge,
  Heading,
  Text,
} from '@wizeworks/silicaui-react';
import { Container, Spark } from '../primitives';
import { MODULE_HEX } from '../modules-catalog';
import type { MarketingModule } from '../primitives';
import { SECTION_DISPLAY_STYLE } from '../landing-v2/heading-style';
import { FEATURES } from './data';

// Device: a real silicaui Accordion on a recessed stage shelf — one row per
// module (colored dot + name + price + what it replaces + feature count) that
// opens to a two-column feature grid keyed by the module's own hue. Replaces the
// hand-rolled <details> + raw-div list on the production page.
export function PricingV1FeatureTable() {
  const firstOpen = FEATURES[0]?.key;
  return (
    <section className="mkt-stage px-[var(--gutter-page)] py-[var(--section-py-xl)]">
      <Container style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        <div className="max-w-3xl">
          <Heading level={2} size="display" style={SECTION_DISPLAY_STYLE}>
            Every feature, by module
            <Spark />
          </Heading>
          <Text variant="lead" className="mt-5 max-w-2xl">
            The complete list — what each module includes and what it replaces. Open any module
            below; the platform underneath comes with every plan.
          </Text>
        </div>

        <Accordion defaultValue={firstOpen ? [firstOpen] : []}>
          {FEATURES.map((m) => {
            const hex = MODULE_HEX[m.key as MarketingModule];
            return (
              <AccordionItem key={m.key} value={m.key}>
                <AccordionTrigger>
                  <span className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-2 pr-3">
                    <span className="flex w-[150px] items-center gap-2.5 text-base font-medium">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: hex }}
                      />
                      {m.name}
                    </span>
                    <Badge color="primary" variant="soft">
                      {m.price}
                    </Badge>
                    <span className="text-base-content/55 hidden flex-1 text-sm lg:block">
                      {m.repl}
                    </span>
                    <span className="text-base-content/55 hidden text-sm sm:block">
                      {m.feats.length} features
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionPanel>
                  <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 pt-1 pl-[22px] sm:grid-cols-2">
                    {m.feats.map((f) => (
                      <span
                        key={f}
                        className="text-base-content/75 flex items-center gap-2.5 text-base"
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: hex }}
                        />
                        {f}
                      </span>
                    ))}
                  </div>
                </AccordionPanel>
              </AccordionItem>
            );
          })}
        </Accordion>
      </Container>
    </section>
  );
}
