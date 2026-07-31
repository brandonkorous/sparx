import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  Badge,
  Card,
  Heading,
  Text,
} from '@wizeworks/silicaui-react';
import { MODULE_HEX } from '../modules-catalog';
import type { MarketingModule } from '../primitives';
import { FEATURES } from '../pricing-v1/data';

/**
 * "Every feature, by module." — a sticky headline paired with a per-module
 * accordion (the same sticky-left / detail-right split landing-v3 uses for its
 * story and FAQ). Each row carries a module-hued dot, its price, and what it
 * replaces; opening it reveals a two-column feature grid keyed to that module's
 * own hue. The only inline style is the dynamic `MODULE_HEX` dot color.
 */
export function PricingV2Features() {
  const firstOpen = FEATURES[0]?.key;
  return (
    <section className="px-6 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          <div className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
            <Heading
              level={2}
              size="display"
              className="text-6xl leading-[0.95] tracking-tight sm:text-7xl"
            >
              Every feature,
              <br />
              by module
              <span className="text-primary">.</span>
            </Heading>
            <Text variant="lead" className="max-w-md text-2xl">
              The full list of what each module includes and what it replaces. Open any one; the
              platform underneath comes with every plan.
            </Text>
          </div>

          <Card className="bg-base-100 shadow-none">
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
                        <span className="hidden flex-1 text-sm lg:block">{m.repl}</span>
                        <span className="hidden text-sm sm:block">{m.feats.length} features</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionPanel>
                      <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 pt-1 pl-[22px] sm:grid-cols-2">
                        {m.feats.map((f) => (
                          <span key={f} className="flex items-center gap-2.5 text-base">
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
          </Card>
        </div>
      </div>
    </section>
  );
}
