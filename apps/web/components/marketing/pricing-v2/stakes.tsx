import { Heading, Text } from '@wizeworks/silicaui-react';
import { LEDGER, LEDGER_FOOTNOTE, SCENARIOS, STATS } from '../pricing-v1/data';

/**
 * The money beat — the page's tension, and its loudest device. Placed BEFORE
 * the switchboard so the reader FEELS what a stitched-together stack costs
 * before they build their own number. Three oversized numerals set the stakes
 * across a hairline-divided editorial row, then a confrontation lands it: a
 * torn-paper receipt of the twelve tools you'd otherwise buy (total struck in
 * red) facing one giant sparx number.
 *
 * Pure silicaui + Tailwind utilities — no custom CSS classes. The only inline
 * styles are the two geometry exceptions landing-v3/proof.tsx already blesses:
 * the receipt's `clip-path` torn edge (no Tailwind polygon utility) and the
 * barcode bar widths (a deterministic loop, not color/fill).
 *
 * The receipt total is derived from the LEDGER amounts so it can't drift: the
 * twelve competitor prices sum to $3,832 — exactly the "full platform bought
 * separately" figure the sparx answer strikes down to $411.
 */
const fmtUsd = (n: number) => `$${n.toLocaleString('en-US')}`;
const parseUsd = (s: string) => Number(s.replace(/[^0-9.]/g, ''));
const RECEIPT_TOTAL = LEDGER.reduce((sum, r) => sum + parseUsd(r.amt), 0);

/** Torn-paper bottom edge — a deterministic polygon, geometry not color, so it
 *  sits outside the "no inline style" rule (identical reasoning to proof.tsx). */
function receiptTornEdge(teeth: number): string {
  const points = ['0% 0%', '100% 0%'];
  for (let i = 0; i <= teeth; i++) {
    const x = 100 - (i / teeth) * 100;
    const y = i % 2 === 0 ? 100 : 96;
    points.push(`${x}% ${y}%`);
  }
  return `polygon(${points.join(', ')})`;
}
const RECEIPT_TORN_EDGE = receiptTornEdge(24);

/** Deterministic bar-width rhythm for the receipt barcode — a visual nod. */
const BARCODE_WIDTHS = [2, 1, 1, 3, 1, 2, 4, 1, 1, 2, 3, 1, 2, 1, 4, 1, 3, 2, 1, 1];
const BARCODE_BARS = Array.from(
  { length: 40 },
  (_, i) => BARCODE_WIDTHS[i % BARCODE_WIDTHS.length]
);

export function PricingV2Stakes() {
  return (
    <section className="px-6 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto flex max-w-7xl flex-col gap-12">
        <div className="max-w-3xl">
          <Heading
            level={2}
            size="display"
            className="text-6xl leading-[0.95] tracking-tight sm:text-7xl"
          >
            What the same stack
            <br />
            costs in pieces
            <span className="text-primary">.</span>
          </Heading>
          <Text variant="lead" className="mt-5 max-w-2xl text-2xl">
            Every module replaces a tool you&rsquo;d otherwise buy on its own. Here&rsquo;s what the
            whole pile really costs at 2026 list prices, and the one number it turns into on sparx.
          </Text>
        </div>

        <BigNumerals />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <OldWayReceipt />
          <SparxAnswer />
        </div>

        <Text variant="caption" className="max-w-4xl">
          {LEDGER_FOOTNOTE}
        </Text>
      </div>
    </section>
  );
}

function BigNumerals() {
  return (
    <div className="border-base-300 grid grid-cols-1 border-y sm:grid-cols-3">
      {STATS.map((s, i) => (
        <div
          key={s.value}
          className={[
            'border-base-300 flex flex-col gap-4 border-b py-8 last:border-b-0 sm:border-r sm:border-b-0 sm:pr-7 sm:last:border-r-0',
            i > 0 ? 'sm:pl-7' : '',
          ].join(' ')}
        >
          <span className="text-primary text-6xl leading-[0.85] font-medium tracking-[-0.04em] lg:text-7xl">
            {s.value}
            {s.suffix ? (
              <span className="text-base-content text-3xl font-normal tracking-tight">
                {s.suffix}
              </span>
            ) : null}
          </span>
          <Text className="text-base-content max-w-[30ch] text-sm">{s.label}</Text>
        </div>
      ))}
    </div>
  );
}

function OldWayReceipt() {
  return (
    <div className="bg-neutral text-neutral-content flex flex-col overflow-hidden rounded-3xl px-8 pt-9 pb-10 lg:min-h-[560px]">
      <div className="text-neutral-content/55 font-mono text-xs tracking-[0.18em]">THE OLD WAY</div>
      <Heading level={3} className="mt-2.5 mb-7 text-3xl tracking-tight text-white">
        Twelve tools. Twelve bills.
      </Heading>

      <div
        className="bg-base-100 text-base-content font-mono text-[13px] shadow-2xl lg:-rotate-1"
        style={{ clipPath: RECEIPT_TORN_EDGE }}
      >
        <div className="px-6 pt-6 pb-10">
          <div className="text-base-content border-base-300 border-b border-dashed pb-3 text-center text-[11px] tracking-[0.2em]">
            ★ YOUR STACK, STITCHED TOGETHER ★
          </div>
          {LEDGER.map((r) => (
            <div
              key={r.key}
              className="border-base-300 flex items-baseline justify-between gap-3 border-b border-dashed py-2"
            >
              <span className="text-base-content min-w-0">{r.alt}</span>
              <span className="tabular-nums">{r.amt}</span>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3 pt-4">
            <span className="text-base-content text-sm">TOTAL / MONTH</span>
            <span className="text-error text-2xl font-bold tabular-nums line-through decoration-2">
              {fmtUsd(RECEIPT_TOTAL)}
            </span>
          </div>
          <div className="border-base-300 mt-4 border-t border-dashed pt-4">
            <div className="flex h-9 items-end justify-center gap-px">
              {BARCODE_BARS.map((w, i) => (
                <span key={i} className="bg-base-content h-full" style={{ width: `${w}px` }} />
              ))}
            </div>
            <div className="text-base-content mt-2 text-center text-[10px] tracking-[0.2em]">
              before sparx
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SparxAnswer() {
  // SCENARIOS is a fixed two-entry editorial tuple: [growing site, full platform].
  const [growing, full] = SCENARIOS;
  if (!growing || !full) return null;
  return (
    <div className="bg-secondary text-secondary-content flex flex-col justify-center gap-2 rounded-3xl px-9 py-12 lg:min-h-[560px]">
      <Text className="text-secondary-content/75 text-base">
        The same twelve capabilities, on sparx
      </Text>
      <span className="text-8xl leading-[0.82] font-semibold tracking-[-0.05em] lg:text-9xl">
        {full.sparx.replace('/mo', '')}
        <span className="text-secondary-content/60 text-4xl font-normal">/mo</span>
      </span>
      <span className="bg-secondary-content/15 mt-3.5 inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-[15px] font-medium">
        <CheckIcon />
        {full.save}
      </span>
      <Text className="text-secondary-content/85 border-secondary-content/20 mt-6 border-t pt-5 text-[15px]">
        Just getting going? {growing.title} ({growing.sub}) runs {growing.sparx} instead of{' '}
        {growing.separate}. {growing.save}.
      </Text>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path d="M5 12L10 17L19 7" stroke="currentColor" strokeWidth={3} />
    </svg>
  );
}
