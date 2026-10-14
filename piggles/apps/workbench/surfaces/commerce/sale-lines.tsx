'use client';

// What they had — the lines on the receipt, and the two ways one gets there.
//
// Pick it off her list, or type it. Both are needed and neither is the odd one
// out: a salon sells a treatment that IS on her list and a bottle of something
// that never will be, in the same minute.
//
// Each line also says what this customer pays and why (issue 737). The sentence
// itself is `sale-price-note.ts`, beside this file, because it is pure copy and
// pure copy is the part worth pinning with a test. The picker, the old-part
// choice and the totals rows are files of their own (sparx persona issue 230).

import { Badge, Button, Input, Text } from '@wizeworks/silicaui-react';
import { faPlus, faTrash } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { formatMoney } from './data';
import { priceNote } from './sale-price-note';
import { lineGoods, type SaleTotals } from './sale-core';
import type { SaleLine, Sellable } from './sale-data';
import { OldPartChoice } from './sale-old-part-choice';
import { SellablePicker } from './sale-sellable-picker';
import { SaleTotalsRows } from './sale-totals-rows';

/** The three boxes a line is typed into. */
function LineFields({ line, onChange }: { line: SaleLine; onChange: (next: SaleLine) => void }) {
  return (
    <>
      <label className="min-w-[10rem] flex-1">
        <span className="mb-1.5 block text-base font-medium">What it was</span>
        <Input
          color="module"
          value={line.name}
          onChange={(event) => {
            onChange({ ...line, name: event.target.value });
          }}
        />
      </label>
      <label className="w-20">
        <span className="mb-1.5 block text-base font-medium">How many</span>
        <Input
          color="module"
          type="number"
          min="1"
          className="text-right tabular-nums"
          value={String(line.quantity)}
          onChange={(event) => {
            const next = Number.parseInt(event.target.value, 10);
            onChange({ ...line, quantity: Number.isFinite(next) && next > 0 ? next : 1 });
          }}
        />
      </label>
      <label className="w-28">
        <span className="mb-1.5 block text-base font-medium">Price each</span>
        <Input
          color="module"
          inputMode="decimal"
          className="text-right tabular-nums"
          value={line.price}
          onFocus={(event) => {
            event.target.select();
          }}
          onChange={(event) => {
            // Typed on, so it is hers from here. Nothing the pricing engine
            // answers later replaces it. [[feedback_honor_the_users_choice]]
            onChange({ ...line, price: event.target.value, priceTouched: true });
          }}
        />
      </label>
    </>
  );
}

/** What this customer pays for the line and why, when that is worth saying. Its
 *  own full-width line, so it reads as a sentence about the row rather than a
 *  fourth squeezed column at 360px. */
function PriceNoteRow({ line }: { line: SaleLine }) {
  const note = priceNote(line);
  if (!note) return null;
  return (
    <div className="flex w-full items-start gap-2">
      {note.typedOver ? (
        <Badge color="warning" variant="soft" size="sm">
          Not their price
        </Badge>
      ) : null}
      <Text className="text-sm">{note.text}</Text>
    </div>
  );
}

function ChosenLine({
  line,
  currency,
  onChange,
  onRemove,
}: {
  line: SaleLine;
  currency: string;
  onChange: (next: SaleLine) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border-base-300 flex flex-wrap items-end gap-3 border-b pb-3 last:border-b-0 last:pb-0">
      <LineFields line={line} onChange={onChange} />
      <span className="w-24 pb-2 text-right text-base font-medium tabular-nums">
        {formatMoney(lineGoods(line), currency)}
      </span>
      <Button
        size="sm"
        shape="square"
        variant="ghost"
        color="danger"
        aria-label={`Take ${line.name || 'this line'} off the sale`}
        onClick={onRemove}
      >
        <Icon glyph={faTrash} className="size-4" aria-hidden />
      </Button>
      <PriceNoteRow line={line} />
      <OldPartChoice line={line} currency={currency} onChange={onChange} />
    </div>
  );
}

export interface SaleLinesProps {
  lines: SaleLine[];
  currency: string;
  totals: SaleTotals;
  taxLabel: string;
  taxKnown: boolean;
  onAdd: (sellable: Sellable | null) => void;
  onChange: (id: string, next: SaleLine) => void;
  onRemove: (id: string) => void;
}

export function SaleLines({
  lines,
  currency,
  totals,
  taxLabel,
  taxKnown,
  ...edit
}: SaleLinesProps) {
  return (
    <FormSection
      title="What they had"
      description="Everything on this sale. Pick it off your list, or write it in: a one-off is just as real as something you sell every day."
    >
      {lines.length > 0 ? (
        <div className="flex flex-col gap-3">
          {lines.map((line) => (
            <ChosenLine
              key={line.id}
              line={line}
              currency={currency}
              onChange={(next) => {
                edit.onChange(line.id, next);
              }}
              onRemove={() => {
                edit.onRemove(line.id);
              }}
            />
          ))}
          <SaleTotalsRows
            totals={totals}
            currency={currency}
            taxLabel={taxLabel}
            taxKnown={taxKnown}
          />
        </div>
      ) : null}
      <SellablePicker onPick={edit.onAdd} />
      <WriteSomethingIn onAdd={edit.onAdd} />
    </FormSection>
  );
}

function WriteSomethingIn({ onAdd }: { onAdd: (sellable: Sellable | null) => void }) {
  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        color="module"
        onClick={() => {
          onAdd(null);
        }}
      >
        <Icon glyph={faPlus} className="size-4" aria-hidden />
        Write something in
      </Button>
    </div>
  );
}
