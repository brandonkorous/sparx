'use client';

// The shape of one line row, and the badges under it.
//
// Split out of line-items so each file holds one job (piggles RULE #0.5).

import { Badge, Text } from '@wizeworks/silicaui-react';
import { linkedProductBadge } from './product-pick';
import { lineCostCents, lineMargin, marginWords } from './line-margin';
import { type DraftLine } from './totals';
import { formatMoney } from './types';

// One literal column template, so Tailwind emits the @xl CSS. Qty is 5.5rem: at
// 3.5rem padding and number arrows left 19px, and 100 read "10(" (issue 086); the
// row lays out from @xl so that wider column does not squeeze the description.
const COLUMNS =
  '@xl:grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_6.5rem_2rem_2rem] @xl:items-center @xl:gap-3';
export const ROW = `flex flex-col gap-2 @xl:grid ${COLUMNS}`;
export const HEADER = `hidden px-1 text-sm font-medium @xl:grid ${COLUMNS}`;

/** The column captions over the rows, shown once the container is wide. */
export function LineHeader() {
  return (
    <div className={HEADER} aria-hidden>
      <span>Description</span>
      <span className="text-right">Qty</span>
      <span className="text-right">Price each</span>
      <span className="text-right">Amount</span>
      <span />
      <span />
    </div>
  );
}

/** Caption shown beside a field only while the row is stacked (narrow container). */
export function StackedLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text as="span" className="text-sm font-medium @xl:hidden">
      {children}
    </Text>
  );
}

interface MetaBit {
  key: string;
  /** No color for a plain fact with no meaning to carry (kind of charge, no
   *  tax): a bare badge resolves to the surface's own ink. */
  color?: 'module' | 'module-b2b' | 'warning' | 'info' | 'success' | 'danger';
  label: string;
}

/** Worked out from the line's own numbers on every line with a cost, so it moves
 *  as a price is typed; it read only a markup snapshot before (issue 086). */
function marginBit(line: DraftLine, currency: string, costsTracked: boolean): MetaBit | false {
  const margin = lineMargin(line);
  if (margin) return { key: 'margin', color: margin.tone, label: marginWords(margin, currency) };
  // Which lines the summary's "not counted" sentence is about.
  const missing = costsTracked && lineCostCents(line) === null && line.description.trim() !== '';
  return missing && { key: 'nocost', color: 'info', label: 'No cost entered' };
}

function metaBits(
  line: DraftLine,
  currency: string,
  typeLabel: string | null,
  costsTracked: boolean
): MetaBit[] {
  const core = line.coreCharge ?? 0;
  const productBadge = linkedProductBadge(line);
  const bits: (MetaBit | false)[] = [
    Boolean(typeLabel) && { key: 'type', label: typeLabel ?? '' },
    productBadge !== null && { key: 'product', color: 'module', label: productBadge },
    // Where a trade price came from. Wholesale's hue: it is that module's rule
    // setting the number, and the one fact on the row that explains why the
    // price is not the one on the website (issue 077).
    Boolean(line.priceNote) && {
      key: 'price',
      color: 'module-b2b',
      label: line.priceNote ?? '',
    },
    core > 0 && {
      key: 'core',
      color: 'info',
      label: `+ ${formatMoney(core, currency)} core deposit each`,
    },
    line.discountAmount > 0 && {
      key: 'disc',
      color: 'warning',
      label: `−${formatMoney(line.discountAmount, currency)}`,
    },
    marginBit(line, currency, costsTracked),
    !line.taxable && { key: 'notax', label: 'No tax' },
  ];
  return bits.filter((bit): bit is MetaBit => bit !== false);
}

/** The badges under a row — everything the modal owns, surfaced read-only so the
 *  row tells the whole truth about the line without opening it. */
export function LineMeta({
  line,
  currency,
  typeLabel,
  costsTracked,
}: {
  line: DraftLine;
  currency: string;
  typeLabel: string | null;
  /** Some line on the document has a cost, so one without is worth pointing at. */
  costsTracked: boolean;
}) {
  const bits = metaBits(line, currency, typeLabel, costsTracked);
  if (bits.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 @xl:col-span-full @xl:pl-1">
      {bits.map((bit) => (
        <Badge key={bit.key} {...(bit.color ? { color: bit.color } : {})} variant="soft" size="sm">
          {bit.label}
        </Badge>
      ))}
    </div>
  );
}
