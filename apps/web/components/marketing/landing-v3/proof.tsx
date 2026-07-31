import { Card, CardBody, CardTitle, Heading, Text } from '@wizeworks/silicaui-react';

/**
 * "Less software. More business." — the receipt beat. The argument is made by an
 * object rather than a chart: a torn-edged, barcode-footed slip tilted off a navy
 * card, totalling what the disconnected stack actually costs per month.
 */
const RECEIPT = [
  { label: 'Online store', price: 399 },
  { label: 'CRM + marketing', price: 1600 },
  { label: 'Email platform', price: 350 },
  { label: 'CMS + automation', price: 420 },
];
const TOTAL = RECEIPT.reduce((sum, r) => sum + r.price, 0);
const fmt = (n: number) => `$${n.toLocaleString('en-US')}`;

/**
 * Torn-paper bottom edge for the receipt slip. `clip-path` is geometry, not
 * color/fill, so it sits outside the "no hardcoded colors / no re-skinning"
 * rule (same reasoning as the MODULE_HEX inline `backgroundColor` in
 * timeline.tsx) — there's no Tailwind utility for an arbitrary polygon, and
 * this one is computed from a small deterministic loop rather than
 * hand-typed coordinates.
 */
function receiptTornEdge(teeth: number): string {
  const points = ['0% 0%', '100% 0%'];
  for (let i = 0; i <= teeth; i++) {
    const x = 100 - (i / teeth) * 100;
    const y = i % 2 === 0 ? 100 : 94;
    points.push(`${x}% ${y}%`);
  }
  return `polygon(${points.join(', ')})`;
}

const RECEIPT_TORN_EDGE = receiptTornEdge(16);

/** Deterministic bar-width rhythm for the footer barcode — a visual nod, not a real symbology. */
const BARCODE_WIDTHS = [2, 1, 1, 3, 1, 2, 4, 1, 1, 2, 3, 1, 2, 1, 4, 1, 3, 2, 1, 1];
const BARCODE_BARS = Array.from(
  { length: 56 },
  (_, i) => BARCODE_WIDTHS[i % BARCODE_WIDTHS.length]
);

export function LandingV3Proof() {
  return (
    <section className="px-6 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto flex max-w-7xl flex-col gap-14">
        <div className="max-w-3xl">
          <Heading
            level={2}
            size="display"
            className="text-6xl leading-[0.95] tracking-tight sm:text-7xl"
          >
            Less software.
            <br />
            More business.
          </Heading>
          <Text variant="lead" className="mt-5 text-2xl">
            sparx puts the website, commerce, customer data, marketing and operations on one shared
            foundation — so you pay for capability instead of integrations.
          </Text>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:grid-rows-2">
          <Card className="bg-secondary text-secondary-content relative overflow-hidden sm:min-h-[520px] lg:row-span-2 lg:min-h-[700px]">
            <CardBody>
              {/* No "The cost of disconnected tools" chip above the title. It was
                  an eyebrow — and one hand-built out of a translucent fill and
                  border, i.e. a re-skinned Badge — introducing a heading that
                  carries itself. The receipt below states the cost literally.

                  The body copy is also no longer the section lede repeated: the
                  two were the same sentence, verbatim, about 15px apart. The
                  lede makes the general claim; the card sets up the receipt. */}
              <div className="flex max-w-md flex-col gap-4">
                <CardTitle className="text-5xl leading-[0.95] sm:text-6xl lg:text-7xl">
                  Stop paying for the seams.
                </CardTitle>
                <Text className="text-secondary-content max-w-xl text-2xl">
                  Four subscriptions, four bills, four copies of the same customer — and you still
                  stitch them together by hand every week.
                </Text>
              </div>
            </CardBody>

            <div
              // No `shadow-2xl`: shadows are not a sanctioned visual device here. The
              // slip already separates from the navy card by base-tone, by its border,
              // and by the tilt — the shadow was adding nothing the geometry didn't.
              className="border-base-300 bg-base-100 text-base-content mx-6 mt-2 mb-6 border-x border-t px-6 pt-6 pb-10 font-mono text-sm sm:absolute sm:right-6 sm:bottom-0 sm:mx-0 sm:mt-0 sm:mb-0 sm:w-[60%] sm:translate-y-30 sm:rotate-[-4deg]"
              style={{ clipPath: RECEIPT_TORN_EDGE }}
            >
              <div className="text-base-content text-center text-xs tracking-[0.2em]">
                ★ YOUR STACK ★
              </div>
              <div className="border-base-300 mt-3 border-t border-dashed" />
              {RECEIPT.map((r) => (
                <div
                  key={r.label}
                  className="border-base-300 flex items-center justify-between gap-4 border-b border-dashed py-2.5"
                >
                  <span className="text-base-content">{r.label}</span>
                  <span className="tabular-nums">{fmt(r.price)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 pt-4 text-base font-bold">
                <span>TOTAL</span>
                <span className="tabular-nums">{fmt(TOTAL)}/mo</span>
              </div>
              <div className="border-base-300 mt-4 border-t border-dashed pt-4">
                <div className="flex h-8 items-end justify-center gap-px">
                  {BARCODE_BARS.map((w, i) => (
                    <span key={i} className="bg-base-content h-full" style={{ width: `${w}px` }} />
                  ))}
                </div>
                <div className="text-base-content mt-1.5 text-center text-[10px] tracking-[0.15em]">
                  before sparx
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardBody className="gap-2">
              <span className="text-primary text-8xl leading-none font-extrabold lg:text-9xl">
                5
              </span>
              <CardTitle className="text-4xl">minutes to begin</CardTitle>
              <Text className="max-w-xl text-xl">
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
              <CardTitle className="text-4xl">honest data layer</CardTitle>
              <Text className="max-w-xl text-xl">
                One customer, product and activity record powers every active part of your business.
              </Text>
            </CardBody>
          </Card>
        </div>
      </div>
    </section>
  );
}
