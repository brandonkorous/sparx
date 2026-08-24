'use client';

// "Made to order" — the three things a shop that MAKES the thing has to be able
// to say about it (issue 026).
//
// On Overview and not on Pricing, even though one of the three is money. A
// baker adding a celebration cake is not thinking about pricing rules; she is
// describing what the cake IS, and "it needs five days and a deposit" is part
// of that description. Splitting the three across two tabs would re-create the
// bug: she looks in one place, finds two of the answers, and concludes the
// third is not offered.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  NumberField,
  Select,
  Text,
} from '@wizeworks/silicaui-react';
import { MoneyInput } from '../../components/money-input';
import { FormSection } from '../../components/form-section';
import {
  depositSentence,
  limitSentence,
  noticeSentence,
  type ProductDeposit,
} from './made-to-order-data';

const DEPOSIT_KINDS = [
  { value: 'none', label: 'No deposit, the whole price at checkout' },
  { value: 'amount', label: 'A set amount' },
  { value: 'percent', label: 'A share of the price' },
];

export interface MadeToOrderValue {
  orderAheadDays: number | null;
  deposit: ProductDeposit;
  dailyLimit: number | null;
}

export function ProductMadeToOrder({
  value,
  currency = 'USD',
  onChange,
}: {
  value: MadeToOrderValue;
  currency?: string;
  onChange: (next: MadeToOrderValue) => void;
}) {
  const set = (patch: Partial<MadeToOrderValue>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <FormSection
      title="Made to order"
      description="For anything you have to make, bake or build before somebody can take it away. Leave all three empty for something they can buy and carry out today."
    >
      <NoticeField
        days={value.orderAheadDays}
        onChange={(orderAheadDays) => {
          set({ orderAheadDays });
        }}
      />
      <DepositField
        deposit={value.deposit}
        currency={currency}
        onChange={(deposit) => {
          set({ deposit });
        }}
      />
      <LimitField
        limit={value.dailyLimit}
        onChange={(dailyLimit) => {
          set({ dailyLimit });
        }}
      />
    </FormSection>
  );
}

/* ── notice ─────────────────────────────────────────────────────────────── */

function NoticeField({
  days,
  onChange,
}: {
  days: number | null;
  onChange: (next: number | null) => void;
}) {
  return (
    <Field>
      <FieldLabel>How much notice do you need?</FieldLabel>
      <FieldControl
        render={
          <NumberField
            label="Days of notice"
            className="max-w-[10rem]"
            min={0}
            max={365}
            value={days ?? 0}
            onValueChange={(next) => {
              onChange(cleanCount(next));
            }}
          />
        }
      />
      <FieldDescription>
        In days. Every order says which day it is due, and your website tells shoppers the earliest
        day they can collect before they buy. Leave it at 0 if there is no wait.
      </FieldDescription>
      <Echo>{noticeSentence(days)}</Echo>
    </Field>
  );
}

/* ── deposit ────────────────────────────────────────────────────────────── */

function DepositField({
  deposit,
  currency,
  onChange,
}: {
  deposit: ProductDeposit;
  currency: string;
  onChange: (next: ProductDeposit) => void;
}) {
  return (
    <Field>
      <FieldLabel>Do you take a deposit?</FieldLabel>
      <FieldControl
        render={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              color="module"
              className="max-w-xs min-w-0"
              aria-label="Deposit"
              items={DEPOSIT_KINDS}
              value={deposit.type}
              onValueChange={(next) => {
                onChange(switchKind(String(next), deposit));
              }}
            />
            {deposit.type === 'amount' ? (
              <MoneyInput
                color="module"
                aria-label="Deposit amount"
                className="max-w-[9rem]"
                value={deposit.amountCents / 100}
                onValueChange={(dollars) => {
                  onChange({ type: 'amount', amountCents: Math.round(dollars * 100) });
                }}
              />
            ) : null}
            {deposit.type === 'percent' ? (
              <NumberField
                label="Deposit percentage"
                className="max-w-[8rem]"
                min={1}
                max={100}
                value={deposit.percent}
                onValueChange={(next) => {
                  onChange({ type: 'percent', percent: clampPercent(next) });
                }}
              />
            ) : null}
          </div>
        }
      />
      <FieldDescription>
        Delivery and tax are always paid at checkout, whatever the deposit is. If the deposit comes
        to more than the price, only the price is taken.
      </FieldDescription>
      <Echo>{depositSentence(deposit, currency)}</Echo>
    </Field>
  );
}

/* ── the daily allowance ────────────────────────────────────────────────── */

function LimitField({
  limit,
  onChange,
}: {
  limit: number | null;
  onChange: (next: number | null) => void;
}) {
  return (
    <Field>
      <FieldLabel>How many can you make in a day?</FieldLabel>
      <FieldControl
        render={
          <NumberField
            label="Daily limit"
            className="max-w-[10rem]"
            min={0}
            max={100000}
            value={limit ?? 0}
            onValueChange={(next) => {
              onChange(cleanCount(next));
            }}
          />
        }
      />
      <FieldDescription>
        This is a fresh allowance every day, not a stock count. Leave it at 0 if you can make as
        many as people ask for.
      </FieldDescription>
      <Echo>{limitSentence(limit)}</Echo>
    </Field>
  );
}

/* ── shared bits ────────────────────────────────────────────────────────── */

/** The answer read back in her own words, right under the control that set it.
 *  Full ink: it is the sentence that tells her whether she got what she meant. */
function Echo({ children }: { children: string }) {
  return <Text className="text-module text-sm font-semibold">{children}</Text>;
}

/** A count where 0 and "nothing typed" both mean "no rule". A NumberField
 *  cannot hold null, so the field shows 0 and the record stores nothing —
 *  otherwise "0 days' notice" would be a promise about a number nobody set. */
function cleanCount(next: number | null): number | null {
  if (typeof next !== 'number' || Number.isNaN(next) || next <= 0) return null;
  return Math.round(next);
}

function clampPercent(next: number | null): number {
  if (typeof next !== 'number' || Number.isNaN(next)) return 1;
  return Math.min(100, Math.max(1, Math.round(next)));
}

/** Switching kind keeps the number where it makes sense and starts somewhere
 *  reasonable where it does not. A percent field opening on 0 would be a
 *  deposit that takes nothing, which the server refuses. */
function switchKind(kind: string, current: ProductDeposit): ProductDeposit {
  if (kind === 'amount') {
    return { type: 'amount', amountCents: current.type === 'amount' ? current.amountCents : 0 };
  }
  if (kind === 'percent') {
    return { type: 'percent', percent: current.type === 'percent' ? current.percent : 50 };
  }
  return { type: 'none' };
}
