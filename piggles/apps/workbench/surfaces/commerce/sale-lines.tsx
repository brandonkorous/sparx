'use client';

// What they had — the lines on the receipt, and the two ways one gets there.
//
// Pick it off her list, or type it. Both are needed and neither is the odd one
// out: a salon sells a treatment that IS on her list and a bottle of something
// that never will be, in the same minute.

import { useState } from 'react';
import { Badge, Button, Input, SearchInput, Text } from '@wizeworks/silicaui-react';
import { faPlus, faTrash } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { formatCents } from './products-data';
import { formatMoney } from './data';
import type { SaleLine, Sellable } from './sale-data';

function lineTotal(line: SaleLine): number {
  const price = Number(line.price);
  return Number.isFinite(price) ? price * line.quantity : 0;
}

export function salesTotal(lines: SaleLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
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
            onChange({ ...line, price: event.target.value });
          }}
        />
      </label>
      <span className="w-24 pb-2 text-right text-base font-medium tabular-nums">
        {formatMoney(lineTotal(line), currency)}
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
    </div>
  );
}

function SellablePicker({ items, onPick }: { items: Sellable[]; onPick: (s: Sellable) => void }) {
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const results = items
    .filter((item) => term === '' || item.name.toLowerCase().includes(term))
    .slice(0, 12);

  return (
    <div className="flex flex-col gap-2">
      <div className="max-w-sm min-w-0">
        <SearchInput
          size="sm"
          aria-label="Search what you sell"
          placeholder="Search what you sell…"
          value={search}
          onValueChange={setSearch}
        />
      </div>
      {results.length === 0 ? (
        <Text className="text-sm">
          {term
            ? `Nothing you sell is called “${search.trim()}”. Add it by hand below.`
            : 'Nothing set up to sell yet. Add what they had by hand below.'}
        </Text>
      ) : (
        <div className="border-base-300 max-h-64 overflow-y-auto rounded border p-1">
          {results.map((item) => (
            <button
              key={item.key}
              type="button"
              className="hover:bg-base-200 flex w-full items-center gap-3 rounded px-2 py-2 text-left"
              onClick={() => {
                onPick(item);
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{item.name}</span>
                {item.detail ? (
                  <Text as="span" className="block text-sm">
                    {item.detail}
                  </Text>
                ) : null}
              </span>
              {item.kind === 'service' ? (
                <Badge color="module-scheduling" variant="soft" size="sm">
                  Appointment
                </Badge>
              ) : null}
              <Text as="span" className="shrink-0 text-sm tabular-nums">
                {formatCents(item.priceCents, item.currency)}
              </Text>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SaleLines({
  lines,
  currency,
  sellables,
  onAdd,
  onChange,
  onRemove,
}: {
  lines: SaleLine[];
  currency: string;
  sellables: Sellable[];
  onAdd: (sellable: Sellable | null) => void;
  onChange: (id: string, next: SaleLine) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <FormSection
      title="What they had"
      description="Everything on this sale. Pick it off your list, or write it in — a one-off is just as real as something you sell every day."
    >
      {lines.length > 0 ? (
        <div className="flex flex-col gap-3">
          {lines.map((line) => (
            <ChosenLine
              key={line.id}
              line={line}
              currency={currency}
              onChange={(next) => {
                onChange(line.id, next);
              }}
              onRemove={() => {
                onRemove(line.id);
              }}
            />
          ))}
        </div>
      ) : null}

      <SellablePicker items={sellables} onPick={onAdd} />

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
    </FormSection>
  );
}
