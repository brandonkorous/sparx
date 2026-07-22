import { Card, CardBody, CardTitle, Heading, Text } from '@wizeworks/silicaui-react';
import { Container } from '../primitives';
import { SECTION_DISPLAY_STYLE } from './heading-style';

// "Less software. More company." — the receipt beat from the mockup: a bold
// colored card (secondary, rounding out the primary/accent/secondary triad
// already used earlier on the page) with a literal tilted receipt overlapping
// its bottom-right corner, plus two oversized-numeral stat cards. Line items
// mirror the vetted market-rate figures already used by the homepage's own
// stack-replacement.tsx (online store, CRM + marketing, email, CMS +
// automation) so the two sections never disagree about what a fragmented
// stack actually costs.

const RECEIPT = [
  { label: 'Online store', price: 399 },
  { label: 'CRM + marketing', price: 1600 },
  { label: 'Email platform', price: 350 },
  { label: 'CMS + automation', price: 420 },
];
const TOTAL = RECEIPT.reduce((sum, r) => sum + r.price, 0);
const fmt = (n: number) => `$${n.toLocaleString('en-US')}`;

export function LandingV2Proof() {
  return (
    <section className="mkt-ground px-page py-section-xl">
      <Container className="flex flex-col gap-14">
        <div className="max-w-3xl">
          <Heading level={2} size="display" style={SECTION_DISPLAY_STYLE}>
            Less software.
            <br />
            More company.
          </Heading>
          <Text variant="lead" className="mt-5 max-w-xl">
            sparx puts the website, commerce, customer data, marketing and operations on one shared
            foundation — so you pay for capability instead of integrations.
          </Text>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:grid-rows-2">
          <Card className="bg-secondary text-secondary-content relative overflow-hidden sm:min-h-[440px] lg:row-span-2 lg:min-h-[600px]">
            <CardBody>
              <div className="flex max-w-md flex-col gap-4">
                {/* The "The cost of disconnected tools" <Badge> that sat here was
                    removed: a badge in the slot directly above a heading is an
                    eyebrow wearing a component. The title carries itself. */}
                <CardTitle className="text-5xl leading-[0.95] sm:text-6xl lg:text-7xl">
                  Stop paying for the seams.
                </CardTitle>
                <Text>
                  Sparx puts the website, commerce, customer data, marketing and operations on one
                  shared foundation — so you pay for capability instead of integrations.
                </Text>
              </div>
            </CardBody>

            <div className="border-base-300 bg-base-100 text-base-content mx-6 mt-2 mb-6 rounded-2xl border p-6 shadow-2xl sm:absolute sm:right-6 sm:bottom-0 sm:mx-0 sm:mt-0 sm:mb-0 sm:w-[64%] sm:translate-y-2 sm:rotate-[-4deg]">
              {RECEIPT.map((r) => (
                <div
                  key={r.label}
                  className="border-base-300 flex items-center justify-between gap-4 border-b border-dashed py-2.5 text-sm"
                >
                  <span className="text-base-content">{r.label}</span>
                  <span>{fmt(r.price)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 pt-4 text-lg font-bold">
                <span>Your software stack</span>
                <span>{fmt(TOTAL)}/mo</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardBody className="gap-2">
              <span className="text-primary text-8xl leading-none font-extrabold lg:text-9xl">
                5
              </span>
              <CardTitle className="text-2xl">minutes to begin</CardTitle>
              <Text>
                Launch a site, choose the next module, and build forward without a platform
                migration later.
              </Text>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="gap-2">
              <span className="text-primary text-8xl leading-none font-extrabold lg:text-9xl">
                1
              </span>
              <CardTitle className="text-2xl">honest data layer</CardTitle>
              <Text>
                One customer, product and activity record powers every active part of your business.
              </Text>
            </CardBody>
          </Card>
        </div>
      </Container>
    </section>
  );
}
