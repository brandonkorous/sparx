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
// narrow (a split pane, a phone) — via Tailwind's named container scale (@lg),
// written as literal classes so the CSS is actually generated. Adding is the
// modal, blank. Money is a live preview of the server's answer.

import { useState } from 'react';
import { Badge, Button, Input, Text, Tooltip } from '@wizeworks/silicaui-react';
import { faPencil, faPlus, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { MoneyInput } from '../../components/money-input';
import { LineEditorModal, type LineTypeOption } from './line-editor-modal';
import { type MarkupRuleSummary } from './line-markup';
import { computeLine, isMarkupPriced, type DraftLine } from './totals';
import { formatMoney } from './types';

interface LineItemsProps {
  lines: DraftLine[];
  taxRate: number;
  currency: string;
  lineTypes: LineTypeOption[];
  markupRules: MarkupRuleSummary[];
  /** Disabled once the document is locked — a finalized invoice's lines are frozen. */
  readOnly?: boolean;
  onChange: (lines: DraftLine[]) => void;
}

// One shared column template (description flexes; the rest are sized to their
// values). Kept as ONE literal string per class so Tailwind actually emits the
// @lg container-query CSS — an interpolated `${bp}:` never gets generated.
const COLUMNS =
  '@lg:grid-cols-[minmax(0,1fr)_3.5rem_6.5rem_6.5rem_2rem_2rem] @lg:items-center @lg:gap-3';
const ROW = `flex flex-col gap-2 @lg:grid ${COLUMNS}`;
const HEADER = `hidden px-1 text-sm font-medium @lg:grid ${COLUMNS}`;

/** Caption shown beside a field only while the row is stacked (narrow container). */
function StackedLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text as="span" className="text-sm font-medium @lg:hidden">
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
}: {
  line: DraftLine;
  currency: string;
  typeLabel: string | null;
}) {
  const margin = line.appliedMarkup?.marginPct;
  const bits: React.ReactNode[] = [];
  if (typeLabel) {
    bits.push(
      <Badge key="type" color="neutral" variant="soft" size="sm">
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
      <Badge key="notax" color="neutral" variant="soft" size="sm">
        No tax
      </Badge>
    );
  }
  if (bits.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 @lg:col-span-full @lg:pl-1">{bits}</div>
  );
}

export function LineItems({
  lines,
  taxRate,
  currency,
  lineTypes,
  markupRules,
  readOnly,
  onChange,
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
            <span className="text-right">Unit price</span>
            <span className="text-right">Amount</span>
            <span />
            <span />
          </div>

          <ul className="divide-base-300 flex flex-col divide-y @lg:divide-y-0">
            {lines.map((line, index) => {
              const computed = computeLine(line, taxRate);
              const position = index + 1;
              const markupPriced = isMarkupPriced(line);
              return (
                <li
                  key={line.key}
                  className={`${ROW} @lg:border-base-300 py-3 @lg:border-b @lg:py-2`}
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
                    <StackedLabel>Unit price</StackedLabel>
                    {markupPriced ? (
                      <Text
                        as="span"
                        className="tabular-nums @lg:pr-1 @lg:text-right"
                        title="Priced from cost + markup — edit to re-price"
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
                          update(line.key, { unitPrice });
                        }}
                      />
                    )}
                  </div>

                  <div className="flex items-baseline justify-between gap-2 @lg:justify-end">
                    <StackedLabel>Amount</StackedLabel>
                    <Text as="span" className="tabular-nums">
                      {formatMoney(computed.lineSubtotal, currency)}
                    </Text>
                  </div>

                  {readOnly ? null : (
                    <div className="flex justify-end gap-1 @lg:contents">
                      <Tooltip content="Edit this line">
                        <Button
                          color="neutral"
                          variant="ghost"
                          size="sm"
                          shape="square"
                          aria-label={`Edit line ${String(position)}`}
                          onClick={() => {
                            setEditing(line);
                          }}
                        >
                          <Icon glyph={faPencil} className="size-4" aria-hidden />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Remove this line">
                        <Button
                          color="danger"
                          variant="ghost"
                          size="sm"
                          shape="square"
                          aria-label={`Remove line ${String(position)}${
                            line.description ? ` — ${line.description}` : ''
                          }`}
                          onClick={() => {
                            remove(line.key);
                          }}
                        >
                          <Icon glyph={faTrashCan} className="size-4" aria-hidden />
                        </Button>
                      </Tooltip>
                    </div>
                  )}

                  <LineMeta line={line} currency={currency} typeLabel={typeLabelFor(line)} />
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
            <Icon glyph={faPlus} className="size-4" aria-hidden />
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
        onClose={() => {
          setEditing(null);
        }}
        onSave={saveFromModal}
      />
    </section>
  );
}
