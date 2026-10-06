'use client';

// The line items editor — what is actually being billed.
//
// A line item reads as a LINE: description, qty, unit price, amount, and its
// actions on one row. Only the three fields a line almost always needs are
// editable in place; everything else it CAN be (line type, a linked product,
// cost-plus-markup pricing, a discount, tax) lives one Edit button away in the
// full modal, surfaced back on the row as small badges so the line still tells
// the whole truth. A markup-priced line shows its derived price read-only —
// you re-price it in the modal, not by typing over it.
//
// The row collapses to a stacked card only when its CONTAINER is genuinely
// narrow (a split pane, a phone), via Tailwind's named container scale (@xl),
// written as literal classes so the CSS is actually generated. Adding is the
// modal, blank. Money is a live preview of the server's answer.

import { useState } from 'react';
import { Badge, Button, Input, Text, Tooltip } from '@wizeworks/silicaui-react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { MoneyInput } from '@/components/money-input';
import { LineEditorModal, type LineTypeOption } from './line-editor-modal';
import { type MarkupRuleSummary } from './line-markup';
import { linkedProductBadge } from './product-pick';
import { lineCostCents, lineMargin } from './line-margin';
import { MarginBadge } from './margin-badge';
import { computeLine, isMarkupPriced, type DraftLine } from './totals';
import { formatMoney } from './types';
import type { TradeAccount } from './trade-price';

interface LineItemsProps {
  lines: DraftLine[];
  taxRate: number;
  currency: string;
  lineTypes: LineTypeOption[];
  markupRules: MarkupRuleSummary[];
  /** The wholesale account whose own prices a picked part takes, or null. */
  tradeAccount: TradeAccount | null;
  /** Disabled once the document is locked — a finalized invoice's lines are frozen. */
  readOnly?: boolean;
  onChange: (lines: DraftLine[]) => void;
  /** Opens the markup rules screen; offered from the line editor. */
  onManageMarkupRules?: () => void;
}

// One shared column template (description flexes; the rest are sized to their
// values). Kept as ONE literal string per class so Tailwind actually emits the
// @xl container-query CSS: an interpolated `${bp}:` never gets generated.
//
// Qty is 5.5rem: a small input's padding, border and a number field's arrows
// left a 3.5rem column 19px for digits, so a wholesale 100 read "10(" (sparx
// persona issue 086). The row lays out from @xl rather than @lg so the wider
// column does not squeeze the description to a sliver at the breakpoint.
const COLUMNS =
  '@xl:grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_6.5rem_2rem_2rem] @xl:items-center @xl:gap-3';
const ROW = `flex flex-col gap-2 @xl:grid ${COLUMNS}`;
const HEADER = `hidden px-1 text-sm font-medium @xl:grid ${COLUMNS}`;

/** Caption shown beside a field only while the row is stacked (narrow container). */
function StackedLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text as="span" className="text-sm font-medium @xl:hidden">
      {children}
    </Text>
  );
}

/** The badges under a row — everything the modal owns, surfaced read-only so the
 *  row tells the whole truth about the line without opening it. */
function LineMeta({
  line,
  currency,
  typeLabel,
  costsTracked,
}: {
  line: DraftLine;
  currency: string;
  typeLabel: string | null;
  /** Some line on this document has a cost, so one without is worth pointing at. */
  costsTracked: boolean;
}) {
  // Worked out from the line's own numbers, on every line with a cost, so it
  // moves as a price is typed. It used to read only a markup line's stored
  // snapshot (sparx persona issue 086).
  const margin = lineMargin(line);
  const bits: React.ReactNode[] = [];
  if (typeLabel) {
    bits.push(
      <Badge key="type" variant="soft" size="sm">
        {typeLabel}
      </Badge>
    );
  }
  const productBadge = linkedProductBadge(line);
  if (productBadge) {
    bits.push(
      <Badge key="product" color="module" variant="soft" size="sm">
        {productBadge}
      </Badge>
    );
  }
  // Where a trade price came from. Wholesale's hue: it is that module's rule
  // setting the number, and it is the one fact on the row that explains why the
  // price is not the one on the website (issue 077).
  if (line.priceNote) {
    bits.push(
      <Badge key="price" color="module-b2b" variant="soft" size="sm">
        {line.priceNote}
      </Badge>
    );
  }
  if (line.coreCharge != null && line.coreCharge > 0) {
    bits.push(
      <Badge key="core" color="info" variant="soft" size="sm">
        + {formatMoney(line.coreCharge, currency)} core deposit each
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
  if (margin) {
    bits.push(<MarginBadge key="margin" margin={margin} currency={currency} size="sm" />);
  } else if (costsTracked && lineCostCents(line) === null && line.description.trim()) {
    // Which lines the summary's "not counted" sentence is about.
    bits.push(
      <Badge key="nocost" color="info" variant="soft" size="sm">
        No cost entered
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
    <div className="flex flex-wrap items-center gap-1.5 @xl:col-span-full @xl:pl-1">{bits}</div>
  );
}

export function LineItems({
  lines,
  taxRate,
  currency,
  lineTypes,
  markupRules,
  tradeAccount,
  readOnly,
  onChange,
  onManageMarkupRules,
}: LineItemsProps) {
  // The line being edited in the modal: an existing DraftLine, 'new', or closed.
  const [editing, setEditing] = useState<DraftLine | 'new' | null>(null);

  const update = (key: string, patch: Partial<DraftLine>) => {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const remove = (key: string) => {
    onChange(lines.filter((line) => line.key !== key));
  };

  const saveFromModal = (next: DraftLine) => {
    if (editing === 'new') {
      onChange([...lines, next]);
    } else {
      onChange(lines.map((line) => (line.key === next.key ? next : line)));
    }
    setEditing(null);
  };

  const costsTracked = lines.some((line) => lineCostCents(line) !== null);

  const typeLabelFor = (line: DraftLine): string | null => {
    if (lineTypes.length <= 1) return null;
    return lineTypes.find((t) => t.id === line.lineTypeId)?.label ?? null;
  };

  return (
    <section className="@container flex flex-col gap-2" aria-label="Line items">
      {lines.length === 0 ? (
        <Text className="text-sm">No lines yet. Add the first charge below.</Text>
      ) : (
        <>
          <div className={HEADER} aria-hidden>
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Price each</span>
            <span className="text-right">Amount</span>
            <span />
            <span />
          </div>

          <ul className="divide-base-300 flex flex-col divide-y @xl:divide-y-0">
            {lines.map((line, index) => {
              const computed = computeLine(line, taxRate);
              const position = index + 1;
              const markupPriced = isMarkupPriced(line);
              return (
                <li
                  key={line.key}
                  className={`${ROW} @xl:border-base-300 py-3 @xl:border-b @xl:py-2`}
                >
                  <div className="flex flex-col gap-1">
                    <StackedLabel>Description</StackedLabel>
                    <Input
                      color="module"
                      size="sm"
                      value={line.description}
                      disabled={readOnly}
                      aria-label={`Line ${String(position)} description`}
                      placeholder="What are you billing for?"
                      onChange={(event) => {
                        update(line.key, { description: event.target.value });
                      }}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <StackedLabel>Qty</StackedLabel>
                    <Input
                      color="module"
                      size="sm"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="decimal"
                      className="text-right tabular-nums"
                      value={line.quantity}
                      disabled={readOnly}
                      aria-label={`Line ${String(position)} quantity`}
                      onChange={(event) => {
                        update(line.key, { quantity: Number(event.target.value) || 0 });
                      }}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <StackedLabel>Price each</StackedLabel>
                    {markupPriced ? (
                      <Text
                        as="span"
                        className="tabular-nums @xl:pr-1 @xl:text-right"
                        title="Priced from cost + markup: edit to re-price"
                      >
                        {formatMoney(line.unitPrice, currency)}
                      </Text>
                    ) : (
                      <MoneyInput
                        color="module"
                        value={line.unitPrice}
                        disabled={readOnly}
                        aria-label={`Line ${String(position)} unit price`}
                        onValueChange={(unitPrice) => {
                          // A price typed over a trade price is no longer the
                          // trade price, so the line stops saying it is.
                          update(line.key, {
                            unitPrice,
                            ...(line.priceNote && unitPrice !== line.unitPrice
                              ? { priceNote: null }
                              : {}),
                          });
                        }}
                      />
                    )}
                  </div>

                  <div className="flex items-baseline justify-between gap-2 @xl:justify-end">
                    <StackedLabel>Amount</StackedLabel>
                    <Text as="span" className="tabular-nums">
                      {formatMoney(computed.lineSubtotal, currency)}
                    </Text>
                  </div>

                  {readOnly ? null : (
                    <div className="flex justify-end gap-1 @xl:contents">
                      <Tooltip content="Edit this line">
                        <Button
                          variant="ghost"
                          size="sm"
                          shape="square"
                          aria-label={`Edit line ${String(position)}`}
                          onClick={() => {
                            setEditing(line);
                          }}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Remove this line">
                        <Button
                          color="danger"
                          variant="ghost"
                          size="sm"
                          shape="square"
                          aria-label={`Remove line ${String(position)}${
                            line.description ? ` (${line.description})` : ''
                          }`}
                          onClick={() => {
                            remove(line.key);
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </Tooltip>
                    </div>
                  )}

                  <LineMeta
                    line={line}
                    currency={currency}
                    typeLabel={typeLabelFor(line)}
                    costsTracked={costsTracked}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}

      {readOnly ? null : (
        <div>
          <Button
            color="module"
            size="sm"
            onClick={() => {
              setEditing('new');
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add a line
          </Button>
        </div>
      )}

      <LineEditorModal
        open={editing !== null}
        line={editing === 'new' ? null : editing}
        lineTypes={lineTypes}
        markupRules={markupRules}
        currency={currency}
        tradeAccount={tradeAccount}
        onClose={() => {
          setEditing(null);
        }}
        onSave={saveFromModal}
        {...(onManageMarkupRules ? { onManageMarkupRules } : {})}
      />
    </section>
  );
}
