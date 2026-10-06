'use client';

// What they had: the lines on the receipt, and the two ways one gets there.
//
// Pick it off the list of what you sell, or write it in. Both are needed and
// neither is the odd one out: a garage sells a rebuilt injector that IS on its
// list and an afternoon's diagnosis that never will be, in the same minute.
//
// Each line also says what this customer pays and why (sale-price-note.ts), and a
// rebuilt part asks about the old part: the core deposit now, or, where the part
// offers it, the old part first and no deposit (sale-core.ts, issue 061).

import { useState } from 'react';
import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Input,
  RadioGroup,
  RadioOption,
  SearchInput,
  Text,
} from '@wizeworks/silicaui-react';
import { Plus, Trash2 } from 'lucide-react';
import { FormSection } from '../../components/form-section';
import { PaneWaiting } from '../../components/pane-waiting';
import { formatCents } from './products-data';
import { formatMoney } from './data';
import { priceNote } from './sale-price-note';
import { matchingSellables } from './sale-sellable-search';
import {
  CORE_CHOICE_LEGEND,
  CORE_DEPOSITS_ROW,
  CORE_FIRST_HINT,
  CORE_FIRST_LABEL,
  CORE_PAY_HINT,
  bringsOldPartFirst,
  coreDepositOnly,
  corePayLabel,
  lineGoods,
  type SaleTotals,
} from './sale-core';
import { useSellables, type SaleLine, type Sellable } from './sale-data';

/** "Their old part": the deposit now, or the old part first. Nothing at all on
 *  a line that takes no core. */
function OldPartChoice({
  line,
  currency,
  onChange,
}: {
  line: SaleLine;
  currency: string;
  onChange: (next: SaleLine) => void;
}) {
  const core = line.core;
  if (!core) return null;

  // One way to buy it is not a choice, so it is a sentence rather than a lone
  // radio button nobody can press away from.
  if (!core.firstOffered) {
    return (
      <Text className="w-full text-sm">
        {coreDepositOnly(core.depositCents, line.quantity, currency)}
      </Text>
    );
  }

  const legendId = `${line.id}-old-part`;
  return (
    <div className="flex w-full flex-col gap-1">
      <Text id={legendId} className="font-medium">
        {CORE_CHOICE_LEGEND}
      </Text>
      <RadioGroup
        color="module"
        aria-labelledby={legendId}
        value={bringsOldPartFirst(line) ? 'first' : 'pay'}
        onValueChange={(value) => {
          onChange({ ...line, coreFirst: value === 'first' });
        }}
      >
        <RadioOption value="pay" className="items-start py-1">
          <span className="flex flex-col gap-0.5">
            <span className="text-base font-medium">
              {corePayLabel(core.depositCents, line.quantity, currency)}
            </span>
            <span className="text-sm">{CORE_PAY_HINT}</span>
          </span>
        </RadioOption>
        <RadioOption value="first" className="items-start py-1">
          <span className="flex flex-col gap-0.5">
            <span className="text-base font-medium">{CORE_FIRST_LABEL}</span>
            <span className="text-sm">{CORE_FIRST_HINT}</span>
          </span>
        </RadioOption>
      </RadioGroup>
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
  const note = priceNote(line);
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
            // Typed on, so it stands from here. Nothing the pricing engine
            // answers later replaces it. [[feedback_honor_the_users_choice]]
            onChange({ ...line, price: event.target.value, priceTouched: true });
          }}
        />
      </label>
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
        <Trash2 className="size-4" aria-hidden />
      </Button>
      {note ? (
        // Its own full-width line, so it reads as a sentence about the row
        // rather than a fourth squeezed column in a narrow pane.
        <div className="flex w-full items-start gap-2">
          {note.typedOver ? (
            <Badge color="warning" variant="soft" size="sm">
              Not their price
            </Badge>
          ) : null}
          <Text className="text-sm">{note.text}</Text>
        </div>
      ) : null}
      <OldPartChoice line={line} currency={currency} onChange={onChange} />
    </div>
  );
}

/** The sum, with the deposits on a row of their own. Drawn only when a deposit
 *  is on the sale: without one the total is the lines, and the money section
 *  below already says it. The rows and their name follow the website's checkout
 *  summary, so the till and the receipt add up the same way. */
function DepositTotals({ totals, currency }: { totals: SaleTotals; currency: string }) {
  if (totals.coreDeposits <= 0) return null;
  return (
    <dl className="border-base-300 flex flex-col gap-1 border-t pt-3">
      <div className="flex justify-between gap-3">
        <dt>Subtotal</dt>
        <dd className="tabular-nums">{formatMoney(totals.goods, currency)}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt>{CORE_DEPOSITS_ROW}</dt>
        <dd className="tabular-nums">{formatMoney(totals.coreDeposits, currency)}</dd>
      </div>
      <div className="flex justify-between gap-3 font-semibold">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatMoney(totals.total, currency)}</dd>
      </div>
    </dl>
  );
}

function SellablePicker({ onPick }: { onPick: (s: Sellable) => void }) {
  const [search, setSearch] = useState('');
  const term = search.trim();
  // The server searches what is typed, however big the catalog (issue 069).
  const { items, isPending, isError, searching, retry } = useSellables(search);
  // Name, version AND code, word by word: see sale-sellable-search.ts. Run on
  // the rows in hand too, so the list narrows on the keystroke rather than
  // waiting for the server's answer to the previous one.
  const results = matchingSellables(items, term);

  if (isError) {
    return (
      <Alert color="error">
        <AlertContent>
          <AlertTitle>Could not load what you sell</AlertTitle>
          <AlertDescription>
            This is a problem reaching the server, not a problem with this sale. You can still write
            what they had in by hand below, or try again.
          </AlertDescription>
        </AlertContent>
        <AlertActions>
          <Button size="sm" variant="outline" onClick={retry}>
            Try again
          </Button>
        </AlertActions>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="max-w-sm min-w-0">
        <SearchInput
          size="sm"
          aria-label="Search what you sell"
          placeholder="Name, version or the code on the box…"
          value={search}
          onValueChange={setSearch}
        />
      </div>
      {isPending ? (
        // Never "nothing set up to sell" while the list is still on its way: an
        // empty answer that is really an unanswered question sends somebody off
        // to write in by hand a part they already stock.
        <PaneWaiting label="Loading what you sell…" />
      ) : results.length === 0 && searching ? (
        // The same rule for a search still on its way: the part may simply be
        // past the rows already in hand.
        <PaneWaiting label="Looking through what you sell…" />
      ) : results.length === 0 ? (
        <Text className="text-sm">
          {term
            ? `Nothing you sell matches “${term}”. Try fewer words, or the code off the box. If it really is a one-off, write it in below.`
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
              {item.core ? (
                <Badge color="info" variant="soft" size="sm">
                  Core deposit {formatCents(item.core.depositCents, item.currency)}
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
  totals,
  onAdd,
  onChange,
  onRemove,
}: {
  lines: SaleLine[];
  currency: string;
  totals: SaleTotals;
  onAdd: (sellable: Sellable | null) => void;
  onChange: (id: string, next: SaleLine) => void;
  onRemove: (id: string) => void;
}) {
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
                onChange(line.id, next);
              }}
              onRemove={() => {
                onRemove(line.id);
              }}
            />
          ))}
        </div>
      ) : null}

      <DepositTotals totals={totals} currency={currency} />

      <SellablePicker onPick={onAdd} />

      <div>
        <Button
          size="sm"
          variant="outline"
          color="module"
          onClick={() => {
            onAdd(null);
          }}
        >
          <Plus className="size-4" aria-hidden />
          Write something in
        </Button>
      </div>
    </FormSection>
  );
}
