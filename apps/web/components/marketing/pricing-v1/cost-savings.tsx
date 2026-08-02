import { Alert, Badge, Card, CardBody, Heading, Text } from '@wizeworks/silicaui-react';
import { Container, Spark } from '../primitives';
import { Reveal } from '../reveal';
import { MODULE_HEX } from '../modules-catalog';
import type { MarketingModule } from '../primitives';
import { SECTION_DISPLAY_STYLE } from '../landing-v2/heading-style';
import { LEDGER, LEDGER_FOOTNOTE, SCENARIOS, STATS } from './data';

// Device: the money beat. Three oversized primary numerals set the stakes, a
// single ledger card lines up each module against the real 2026 price of the
// tool it replaces, and two scenario cards land the point with a
// strike-vs-sparx numeral and a green savings line — the same persuasion idiom
// proven on the switchboard's StackSummaryCard.
export function PricingV1CostSavings() {
  return (
    <section className="px-page py-section-xl">
      <Container className="flex flex-col gap-10">
        <div className="max-w-3xl">
          <Heading level={2} size="display" style={SECTION_DISPLAY_STYLE}>
            What the same stack costs in pieces
            <Spark />
          </Heading>
          <Text variant="lead" className="mt-5 max-w-2xl">
            Each module replaces a tool you&rsquo;d otherwise pay for on its own. Here&rsquo;s the
            real, published 2026 price of each — and what you keep by running them as one platform
            on one bill.
          </Text>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STATS.map((s) => (
            <Card key={s.value}>
              <CardBody className="gap-4">
                <span className="text-primary text-6xl leading-[0.9] font-medium tracking-[-0.03em] lg:text-7xl">
                  {s.value}
                  {s.suffix ? (
                    <span className="text-base-content text-3xl font-normal">{s.suffix}</span>
                  ) : null}
                </span>
                <Text className="text-sm">{s.label}</Text>
              </CardBody>
            </Card>
          ))}
        </div>

        <Ledger />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {SCENARIOS.map((sc) => (
            <ScenarioCard key={sc.title} scenario={sc} />
          ))}
        </div>

        <Text variant="caption" className="max-w-4xl">
          {LEDGER_FOOTNOTE}
        </Text>
      </Container>
    </section>
  );
}

function Ledger() {
  return (
    <Card>
      <div className="divide-base-300 flex flex-col divide-y">
        {LEDGER.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:gap-5"
          >
            <span className="flex items-center gap-3">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: MODULE_HEX[row.key as MarketingModule] }}
              />
              <span className="text-md font-medium">{row.name}</span>
              <Badge color="primary" variant="soft">
                {row.price}
              </Badge>
            </span>
            <Text as="span" className="order-last col-span-2 text-sm sm:order-none sm:col-span-1">
              → {row.alt}
            </Text>
            <span className="text-right text-lg font-medium">{row.amt}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ScenarioCard({ scenario: sc }: { scenario: (typeof SCENARIOS)[number] }) {
  return (
    <Reveal>
      {/* The featured scenario lifts on the brand hue. The old inline shadow was
          a hardcoded indigo rgba — the BUILDER module hue, not the primary it
          was paired with; `shadow-primary/15` makes the two agree. */}
      <Card
        className={`h-full ${sc.featured ? 'border-primary shadow-primary/15 shadow-[0_18px_44px]' : ''}`}
      >
        <CardBody className="gap-4">
          <div>
            <div className="text-lg font-medium">{sc.title}</div>
            <Text variant="caption" className="mt-1">
              {sc.sub}
            </Text>
          </div>

          <div className="flex flex-col gap-1">
            <Text as="span" className="text-sm">
              Bought separately
            </Text>
            <span className="text-xl line-through">{sc.separate}</span>
          </div>

          <div className="flex flex-col gap-1">
            <Text as="span" className="text-sm">
              On sparx
            </Text>
            <span className="text-primary text-5xl font-medium tracking-[-0.02em] lg:text-6xl">
              {sc.sparx.replace('/mo', '')}
              <span className="text-base-content text-2xl font-normal">/mo</span>
            </span>
          </div>

          <Alert
            color="success"
            variant="soft"
            role="status"
            className="mt-1 items-center text-sm font-medium"
          >
            <CheckIcon />
            {sc.save}
          </Alert>
        </CardBody>
      </Card>
    </Reveal>
  );
}

function CheckIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12L10 17L19 7" stroke="currentColor" strokeWidth={3} />
    </svg>
  );
}
