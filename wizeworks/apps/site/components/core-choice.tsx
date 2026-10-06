'use client';

// "Your old part": a rebuilt part bought by paying the core deposit, or by sending
// the old part first (sparx persona issue 057).
//
// Two pieces, one set of words (`lib/core-choice-copy`):
//
//   · `CoreChoice` is the React twin of the silica buy box's `corePicker`, for the
//     pages that draw `<ProductDetail>`. Paying the deposit is first and the default,
//     so nobody is held waiting on a part they did not know they had to send.
//   · `CoreLine` is what a basket line says about it: the deposit, or "Ships when your
//     old part arrives", and, where the part can be bought either way and the screen
//     lets the shopper change it, the switch.

import { useId, useState } from 'react';

import {
  CORE_CHOICE_LEGEND,
  CORE_FIRST_LINE,
  CORE_FIRST_SENTENCE,
  CORE_LINE_FIRST_LABEL,
  coreLinePayLabel,
  corePaySentence,
} from '@/lib/core-choice-copy';
import { formatMoney } from '@/lib/format';
import type { CartLine } from './cart-provider';

export function CoreChoice({
  depositCents,
  currency,
  locale,
  coreFirst,
  onChange,
}: {
  depositCents: number;
  currency: string;
  locale: string;
  coreFirst: boolean;
  onChange: (coreFirst: boolean) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-base-content text-base font-medium">{CORE_CHOICE_LEGEND}</legend>
      <label className="text-base-content flex items-center gap-2 text-base">
        <input
          type="radio"
          className="radio"
          name={name}
          value=""
          checked={!coreFirst}
          onChange={() => {
            onChange(false);
          }}
        />
        <span>{corePaySentence(depositCents, currency, locale)}</span>
      </label>
      <label className="text-base-content flex items-center gap-2 text-base">
        <input
          type="radio"
          className="radio"
          name={name}
          value="1"
          checked={coreFirst}
          onChange={() => {
            onChange(true);
          }}
        />
        <span>{CORE_FIRST_SENTENCE}</span>
      </label>
    </fieldset>
  );
}

/**
 * What one basket line says about its old part.
 *
 * `onSwitch` is passed only where changing it is safe. The checkout summary stops
 * passing it once the payment step has the total, because a switch there would change
 * a total the card is about to be charged.
 *
 * `detail` adds "paid back when you return your old part" to a deposit line, for the
 * screens with room for it.
 */
export function CoreLine({
  line,
  currency,
  onSwitch,
  detail = false,
}: {
  line: CartLine;
  currency: string;
  onSwitch?: (coreFirst: boolean) => Promise<void>;
  detail?: boolean;
}) {
  const name = useId();
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  const ships = line.coreFirst ? (
    <span className="text-base-content text-base font-semibold">{CORE_FIRST_LINE}</span>
  ) : null;

  if (line.coreChoice && onSwitch) {
    const choose = (coreFirst: boolean) => {
      if (coreFirst === line.coreFirst) return;
      setBusy(true);
      setRefused(null);
      onSwitch(coreFirst)
        .catch((err: unknown) => {
          setRefused(err instanceof Error ? err.message : 'Sorry, we couldn’t change that.');
        })
        .finally(() => {
          setBusy(false);
        });
    };
    return (
      <div className="flex flex-col gap-1.5">
        <fieldset className="flex flex-col gap-1.5" disabled={busy}>
          <legend className="text-base-content text-base font-medium">{CORE_CHOICE_LEGEND}</legend>
          <label className="text-base-content flex items-center gap-2 text-base">
            <input
              type="radio"
              className="radio radio-sm"
              name={name}
              value=""
              checked={!line.coreFirst}
              onChange={() => {
                choose(false);
              }}
            />
            <span>{coreLinePayLabel(line.coreChoice.depositCents, line.quantity, currency)}</span>
          </label>
          <label className="text-base-content flex items-center gap-2 text-base">
            <input
              type="radio"
              className="radio radio-sm"
              name={name}
              value="1"
              checked={line.coreFirst}
              onChange={() => {
                choose(true);
              }}
            />
            <span>{CORE_LINE_FIRST_LABEL}</span>
          </label>
        </fieldset>
        {ships}
        {refused ? <span className="text-warning text-sm font-semibold">{refused}</span> : null}
      </div>
    );
  }

  if (ships) return ships;
  if (line.coreChargeCents === null) return null;
  return (
    <span className="text-base-content text-sm">
      Plus {formatMoney(line.coreChargeCents, currency)} refundable core deposit
      {line.quantity > 1 ? ' each' : ''}
      {detail ? ', paid back when you return your old part' : ''}
    </span>
  );
}
