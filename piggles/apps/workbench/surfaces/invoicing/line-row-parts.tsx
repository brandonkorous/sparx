'use client';

// The shape of one line row, and the badges under it.
//
// Split out of line-items so each file holds one job (piggles RULE #0.5).

import { Badge, Text } from '@wizeworks/silicaui-react';
import { type DraftLine } from './totals';
import { formatMoney } from './types';

// One shared column template (description flexes; the rest are sized to their
// values). Kept as ONE literal string per class so Tailwind actually emits the
// @lg container-query CSS — an interpolated `${bp}:` never gets generated.
const COLUMNS =
  '@lg:grid-cols-[minmax(0,1fr)_3.5rem_6.5rem_6.5rem_2rem_2rem] @lg:items-center @lg:gap-3';
export const ROW = `flex flex-col gap-2 @lg:grid ${COLUMNS}`;
export const HEADER = `hidden px-1 text-sm font-medium @lg:grid ${COLUMNS}`;

/** Caption shown beside a field only while the row is stacked (narrow container). */
export function StackedLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text as="span" className="text-sm font-medium @lg:hidden">
      {children}
    </Text>
  );
}

/** The badges under a row — everything the modal owns, surfaced read-only so the
 *  row tells the whole truth about the line without opening it. */
export function LineMeta({
  line,
  currency,
  typeLabel,
}: {
  line: DraftLine;
  currency: string;
  typeLabel: string | null;
}) {
  const margin = line.appliedMarkup?.marginPct;
  const bits: React.ReactNode[] = [];
  // The kind of charge and "no tax" are plain facts about the line with no
  // meaning to carry, so they take no color at all rather than being named
  // grey — a bare badge resolves to the surface's own ink.
  if (typeLabel) {
    bits.push(
      <Badge key="type" variant="soft" size="sm">
        {typeLabel}
      </Badge>
    );
  }
  if (line.productId) {
    bits.push(
      <Badge key="product" color="module" variant="soft" size="sm">
        {line.productLabel ?? 'Linked product'}
      </Badge>
    );
  }
  if (line.discountAmount > 0) {
    bits.push(
      <Badge key="disc" color="warning" variant="soft" size="sm">
        −{formatMoney(line.discountAmount, currency)}
      </Badge>
    );
  }
  if (margin != null) {
    bits.push(
      <Badge key="margin" color="module" variant="soft" size="sm">
        {margin}% margin
      </Badge>
    );
  }
  if (!line.taxable) {
    bits.push(
      <Badge key="notax" variant="soft" size="sm">
        No tax
      </Badge>
    );
  }
  if (bits.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 @lg:col-span-full @lg:pl-1">{bits}</div>
  );
}
